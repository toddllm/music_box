const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, DeleteCommand, ScanCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { SimpleLaughterDetector } = require('./simple-laughter-detector');

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);
const secretsClient = new SecretsManagerClient({});

const TABLE_NAME = `music-box-connections-${process.env.NODE_ENV || 'production'}`;
const AUDIO_BUFFER_TABLE = `music-box-audio-buffers-${process.env.NODE_ENV || 'production'}`;

// Cache for secrets
let secretsCache = null;
let secretsCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Get API Gateway Management API client
function getApiGatewayClient(event) {
  const { domainName, stage } = event.requestContext;
  return new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`
  });
}

// Get secrets from AWS Secrets Manager
async function getSecrets() {
  if (secretsCache && (Date.now() - secretsCacheTime) < CACHE_DURATION) {
    return secretsCache;
  }
  
  try {
    const command = new GetSecretValueCommand({
      SecretId: 'music_box_config'
    });
    
    const response = await secretsClient.send(command);
    const secrets = JSON.parse(response.SecretString);
    
    secretsCache = secrets;
    secretsCacheTime = Date.now();
    
    console.log('[WebSocket] Secrets loaded from AWS Secrets Manager');
    return secrets;
  } catch (error) {
    console.error('[WebSocket] Failed to retrieve secrets:', error);
    throw error;
  }
}

// Store audio chunks in DynamoDB
async function storeAudioChunk(connectionId, audioData, chunkIndex) {
  const params = {
    TableName: AUDIO_BUFFER_TABLE,
    Item: {
      connectionId,
      chunkIndex,
      audioData,
      timestamp: Date.now(),
      ttl: Math.floor(Date.now() / 1000) + 300 // 5 minute TTL
    }
  };
  
  await ddb.send(new PutCommand(params));
}

// Get all audio chunks for a connection
async function getAudioChunks(connectionId) {
  const params = {
    TableName: AUDIO_BUFFER_TABLE,
    KeyConditionExpression: 'connectionId = :connectionId',
    ExpressionAttributeValues: {
      ':connectionId': connectionId
    }
  };
  
  try {
    const result = await ddb.send(new QueryCommand(params));
    return result.Items || [];
  } catch (error) {
    // Table might not exist yet
    return [];
  }
}

// Process accumulated audio for laughter detection
async function processAccumulatedAudio(connectionId, apiGateway) {
  console.log('[WebSocket] Processing accumulated audio for:', connectionId);
  
  try {
    // Get secrets
    const secrets = await getSecrets();
    if (!secrets.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not found');
    }
    
    // Get audio chunks
    const chunks = await getAudioChunks(connectionId);
    if (chunks.length === 0) {
      console.log('[WebSocket] No audio chunks found');
      return;
    }
    
    // Sort chunks by index and combine
    chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
    const combinedAudio = chunks.map(c => c.audioData).join('');
    
    console.log('[WebSocket] Combined audio size:', combinedAudio.length);
    
    // Detect laughter
    const detector = new SimpleLaughterDetector(secrets.OPENAI_API_KEY);
    const result = await detector.detectLaughter(combinedAudio);
    
    console.log('[WebSocket] Laughter detection result:', result);
    
    // Send result to client
    await apiGateway.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify({
        event: 'laughterDetected',
        data: {
          confidence: result.confidence / 100,
          laughterType: result.hasLaughter ? 'detected' : 'none',
          transcription: result.transcription,
          method: result.method
        }
      })
    }));
    
    // Clean up audio chunks
    for (const chunk of chunks) {
      await ddb.send(new DeleteCommand({
        TableName: AUDIO_BUFFER_TABLE,
        Key: {
          connectionId: chunk.connectionId,
          chunkIndex: chunk.chunkIndex
        }
      }));
    }
    
  } catch (error) {
    console.error('[WebSocket] Error processing audio:', error);
    await apiGateway.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify({
        event: 'error',
        data: { message: 'Failed to process audio', details: error.message }
      })
    }));
  }
}

// Modified handlers for stateless operation
async function handleStartPerformance(connectionId, apiGateway) {
  console.log('[WebSocket] Starting performance for connection:', connectionId);
  
  // Reset audio buffer counter in connection metadata
  await ddb.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { connectionId },
    UpdateExpression: 'SET audioChunkIndex = :zero, performanceStartTime = :now',
    ExpressionAttributeValues: {
      ':zero': 0,
      ':now': Date.now()
    }
  }));
  
  await apiGateway.send(new PostToConnectionCommand({
    ConnectionId: connectionId,
    Data: JSON.stringify({
      event: 'performanceStarted',
      data: { status: 'tracking' }
    })
  }));
}

async function handleAudioData(connectionId, data, apiGateway) {
  // Get current chunk index
  const connection = await ddb.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { connectionId }
  }));
  
  const chunkIndex = connection.Item?.audioChunkIndex || 0;
  
  console.log('[WebSocket] Received audio chunk', chunkIndex, 'for:', connectionId);
  
  // Store audio chunk
  await storeAudioChunk(connectionId, data.audio, chunkIndex);
  
  // Update chunk index
  await ddb.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { connectionId },
    UpdateExpression: 'SET audioChunkIndex = :newIndex',
    ExpressionAttributeValues: {
      ':newIndex': chunkIndex + 1
    }
  }));
  
  // Process every 10 chunks (about 2.5 seconds of audio)
  if ((chunkIndex + 1) % 10 === 0) {
    await processAccumulatedAudio(connectionId, apiGateway);
  }
}

async function handleEndPerformance(connectionId, apiGateway) {
  console.log('[WebSocket] Ending performance for connection:', connectionId);
  
  // Process any remaining audio
  await processAccumulatedAudio(connectionId, apiGateway);
  
  // Clean up
  const chunks = await getAudioChunks(connectionId);
  for (const chunk of chunks) {
    await ddb.send(new DeleteCommand({
      TableName: AUDIO_BUFFER_TABLE,
      Key: {
        connectionId: chunk.connectionId,
        chunkIndex: chunk.chunkIndex
      }
    }));
  }
}

// Export the stateless handlers
module.exports = {
  handleStartPerformance,
  handleAudioData,
  handleEndPerformance,
  getApiGatewayClient
};