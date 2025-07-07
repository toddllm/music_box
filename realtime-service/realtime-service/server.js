const WebSocket = require('ws');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, DeleteCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

// AWS Clients
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(ddbClient);

// Configuration
const PORT = process.env.PORT || 8080;
const SESSIONS_TABLE = process.env.SESSIONS_TABLE || 'music-box-realtime-sessions';

// Active connections and OpenAI sessions
const clientConnections = new Map(); // clientId -> { ws, openaiWs, sessionId }
const openaiConnections = new Map(); // openaiWs -> clientId

// Secrets cache
let secretsCache = null;
let secretsCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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
    
    console.log('[RealtimeService] Secrets loaded from AWS Secrets Manager');
    return secrets;
  } catch (error) {
    console.error('[RealtimeService] Failed to retrieve secrets:', error);
    throw error;
  }
}

// Create WebSocket server
const wss = new WebSocket.Server({ 
  port: PORT,
  perMessageDeflate: false // Disable compression for lower latency
});

console.log(`[RealtimeService] WebSocket server started on port ${PORT}`);

// Handle client connections
wss.on('connection', (ws, req) => {
  const clientId = uuidv4();
  console.log(`[RealtimeService] Client connected: ${clientId}`);
  
  // Store client connection
  clientConnections.set(clientId, { ws, openaiWs: null, sessionId: null });
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    clientId: clientId
  }));
  
  // Handle client messages
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      await handleClientMessage(clientId, data);
    } catch (error) {
      console.error(`[RealtimeService] Error handling client message:`, error);
      ws.send(JSON.stringify({
        type: 'error',
        error: error.message
      }));
    }
  });
  
  // Handle client disconnect
  ws.on('close', () => {
    console.log(`[RealtimeService] Client disconnected: ${clientId}`);
    cleanupClient(clientId);
  });
  
  ws.on('error', (error) => {
    console.error(`[RealtimeService] Client WebSocket error:`, error);
    cleanupClient(clientId);
  });
});

// Handle messages from clients
async function handleClientMessage(clientId, message) {
  const client = clientConnections.get(clientId);
  if (!client) return;
  
  console.log(`[RealtimeService] Client ${clientId} message:`, message.type);
  
  switch (message.type) {
    case 'startSession':
      await startOpenAISession(clientId, message.playerId);
      break;
      
    case 'audioData':
      forwardAudioToOpenAI(clientId, message.audio);
      break;
      
    case 'endSession':
      await endOpenAISession(clientId);
      break;
      
    default:
      console.log(`[RealtimeService] Unknown message type: ${message.type}`);
  }
}

// Start OpenAI Realtime API session
async function startOpenAISession(clientId, playerId) {
  const client = clientConnections.get(clientId);
  if (!client) return;
  
  // Get API key
  const secrets = await getSecrets();
  if (!secrets.OPENAI_API_KEY) {
    client.ws.send(JSON.stringify({
      type: 'error',
      error: 'OpenAI API key not configured'
    }));
    return;
  }
  
  console.log(`[RealtimeService] Starting OpenAI session for client ${clientId}`);
  
  // Connect to OpenAI Realtime API
  const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17', {
    headers: {
      'Authorization': `Bearer ${secrets.OPENAI_API_KEY}`,
      'OpenAI-Beta': 'realtime=v1'
    }
  });
  
  // Store the connection
  client.openaiWs = openaiWs;
  openaiConnections.set(openaiWs, clientId);
  
  // Handle OpenAI connection events
  openaiWs.on('open', () => {
    console.log(`[RealtimeService] Connected to OpenAI for client ${clientId}`);
    
    // Initialize session with laughter detection
    openaiWs.send(JSON.stringify({
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: `You are a game referee for a singing game where players must not laugh.
Your ONLY job is to detect when someone laughs during their audio input.

Listen carefully for:
- Actual laughter sounds (haha, hehe, giggling)
- Chuckling or snickering
- Suppressed laughter or trying to hold back laughter
- Breathing patterns that indicate amusement

When you detect laughter, immediately call the report_laughter function.
Do NOT respond with text or speech - only use the function call.
If there's no laughter, do nothing.`,
        voice: 'echo',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          enabled: true,
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500
        },
        tools: [
          {
            type: 'function',
            name: 'report_laughter',
            description: 'Report when laughter is detected in the audio',
            parameters: {
              type: 'object',
              properties: {
                confidence: {
                  type: 'number',
                  description: 'Confidence level from 0 to 1',
                  minimum: 0,
                  maximum: 1
                },
                laughter_type: {
                  type: 'string',
                  description: 'Type of laughter detected',
                  enum: ['giggling', 'loud_laughter', 'chuckling', 'suppressed', 'snickering']
                },
                timestamp_ms: {
                  type: 'number',
                  description: 'Approximate timestamp in the audio where laughter occurred'
                }
              },
              required: ['confidence', 'laughter_type']
            }
          }
        ]
      }
    }));
    
    // Notify client
    client.ws.send(JSON.stringify({
      type: 'sessionStarted',
      sessionId: clientId
    }));
  });
  
  openaiWs.on('message', (data) => {
    const message = JSON.parse(data);
    handleOpenAIMessage(clientId, message);
  });
  
  openaiWs.on('close', () => {
    console.log(`[RealtimeService] OpenAI connection closed for client ${clientId}`);
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({
        type: 'sessionEnded'
      }));
    }
  });
  
  openaiWs.on('error', (error) => {
    console.error(`[RealtimeService] OpenAI WebSocket error:`, error);
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({
        type: 'error',
        error: 'OpenAI connection error'
      }));
    }
  });
  
  // Store session in DynamoDB
  await ddb.send(new PutCommand({
    TableName: SESSIONS_TABLE,
    Item: {
      sessionId: clientId,
      playerId: playerId,
      startTime: Date.now(),
      ttl: Math.floor(Date.now() / 1000) + 3600 // 1 hour TTL
    }
  }));
}

// Handle messages from OpenAI
function handleOpenAIMessage(clientId, message) {
  const client = clientConnections.get(clientId);
  if (!client || !client.ws || client.ws.readyState !== WebSocket.OPEN) return;
  
  console.log(`[RealtimeService] OpenAI message for client ${clientId}:`, message.type);
  
  switch (message.type) {
    case 'session.created':
      client.sessionId = message.session.id;
      console.log(`[RealtimeService] OpenAI session created:`, message.session.id);
      break;
      
    case 'response.function_call_arguments.done':
      if (message.name === 'report_laughter') {
        try {
          const args = JSON.parse(message.arguments);
          console.log(`[RealtimeService] Laughter detected!`, args);
          
          // Send to client
          client.ws.send(JSON.stringify({
            type: 'laughterDetected',
            data: {
              confidence: args.confidence,
              laughterType: args.laughter_type,
              timestamp: args.timestamp_ms || Date.now()
            }
          }));
        } catch (error) {
          console.error('[RealtimeService] Error parsing function arguments:', error);
        }
      }
      break;
      
    case 'conversation.item.input_audio_transcription.completed':
      // Forward transcription to client for debugging
      client.ws.send(JSON.stringify({
        type: 'transcription',
        text: message.transcript
      }));
      break;
      
    case 'error':
      console.error('[RealtimeService] OpenAI error:', message.error);
      client.ws.send(JSON.stringify({
        type: 'error',
        error: message.error.message || 'OpenAI error'
      }));
      break;
  }
}

// Forward audio data to OpenAI
function forwardAudioToOpenAI(clientId, audioBase64) {
  const client = clientConnections.get(clientId);
  if (!client || !client.openaiWs || client.openaiWs.readyState !== WebSocket.OPEN) {
    console.error(`[RealtimeService] No OpenAI connection for client ${clientId}`);
    return;
  }
  
  // Send audio to OpenAI
  client.openaiWs.send(JSON.stringify({
    type: 'input_audio_buffer.append',
    audio: audioBase64
  }));
}

// End OpenAI session
async function endOpenAISession(clientId) {
  const client = clientConnections.get(clientId);
  if (!client) return;
  
  console.log(`[RealtimeService] Ending OpenAI session for client ${clientId}`);
  
  if (client.openaiWs && client.openaiWs.readyState === WebSocket.OPEN) {
    // Commit any remaining audio
    client.openaiWs.send(JSON.stringify({
      type: 'input_audio_buffer.commit'
    }));
    
    // Close after a delay to allow final processing
    setTimeout(() => {
      if (client.openaiWs) {
        client.openaiWs.close();
      }
    }, 1000);
  }
  
  // Update session in DynamoDB
  await ddb.send(new UpdateCommand({
    TableName: SESSIONS_TABLE,
    Key: { sessionId: clientId },
    UpdateExpression: 'SET endTime = :endTime',
    ExpressionAttributeValues: {
      ':endTime': Date.now()
    }
  }));
}

// Clean up client resources
function cleanupClient(clientId) {
  const client = clientConnections.get(clientId);
  if (!client) return;
  
  // Close OpenAI connection if exists
  if (client.openaiWs) {
    openaiConnections.delete(client.openaiWs);
    if (client.openaiWs.readyState === WebSocket.OPEN) {
      client.openaiWs.close();
    }
  }
  
  // Remove from maps
  clientConnections.delete(clientId);
}

// Health check endpoint (for ECS)
const http = require('http');
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  } else {
    res.writeHead(404);
    res.end();
  }
});

healthServer.listen(8081, () => {
  console.log('[RealtimeService] Health check server on port 8081');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[RealtimeService] SIGTERM received, shutting down gracefully');
  
  // Close all client connections
  for (const [clientId, client] of clientConnections) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.close();
    }
    cleanupClient(clientId);
  }
  
  // Close servers
  wss.close(() => {
    console.log('[RealtimeService] WebSocket server closed');
  });
  
  healthServer.close(() => {
    console.log('[RealtimeService] Health server closed');
    process.exit(0);
  });
});