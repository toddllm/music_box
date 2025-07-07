const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, DeleteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { RealtimeLaughterDetector } = require('./realtime-laughter-detector');

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);
const apigwManagementApi = new ApiGatewayManagementApiClient({
  endpoint: `https://${process.env.WEBSOCKET_API_ID}.execute-api.${process.env.AWS_REGION}.amazonaws.com/${process.env.WEBSOCKET_STAGE}`
});
const secretsClient = new SecretsManagerClient({});

// Cache for secrets to avoid repeated API calls
let secretsCache = null;
let secretsCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const TABLE_NAME = `music-box-connections-${process.env.NODE_ENV || 'production'}`;

// Game state stored in memory (in production, use DynamoDB or Redis)
const gameState = {
  players: new Map(),
  currentPlayer: null,
  isGameActive: false,
  round: 0,
  eliminatedPlayers: new Set()
};

// Active laughter detectors for each connection
const activeDetectors = new Map();

// Function to get secrets from AWS Secrets Manager
async function getSecrets() {
  // Check cache first
  if (secretsCache && (Date.now() - secretsCacheTime) < CACHE_DURATION) {
    return secretsCache;
  }
  
  try {
    const command = new GetSecretValueCommand({
      SecretId: 'music_box_config'
    });
    
    const response = await secretsClient.send(command);
    const secrets = JSON.parse(response.SecretString);
    
    // Update cache
    secretsCache = secrets;
    secretsCacheTime = Date.now();
    
    console.log('[WebSocket] Secrets loaded from AWS Secrets Manager');
    return secrets;
  } catch (error) {
    console.error('[WebSocket] Failed to retrieve secrets:', error);
    throw error;
  }
}

exports.handler = async (event) => {
  const { connectionId, routeKey } = event.requestContext;
  
  try {
    switch (routeKey) {
      case '$connect':
        await handleConnect(connectionId);
        break;
      case '$disconnect':
        await handleDisconnect(connectionId);
        break;
      case '$default':
        await handleMessage(connectionId, JSON.parse(event.body));
        break;
      default:
        console.log('Unknown route:', routeKey);
    }
    
    return { statusCode: 200 };
  } catch (error) {
    console.error('WebSocket error:', error);
    return { statusCode: 500 };
  }
};

async function handleConnect(connectionId) {
  const params = {
    TableName: TABLE_NAME,
    Item: {
      connectionId,
      timestamp: Date.now()
    }
  };
  
  await ddb.send(new PutCommand(params));
  console.log('Client connected:', connectionId);
}

async function handleDisconnect(connectionId) {
  // Clean up any active laughter detector
  const detector = activeDetectors.get(connectionId);
  if (detector) {
    detector.disconnect();
    activeDetectors.delete(connectionId);
  }
  
  // Remove from DynamoDB
  const params = {
    TableName: TABLE_NAME,
    Key: { connectionId }
  };
  
  await ddb.send(new DeleteCommand(params));
  
  // Remove from game state
  gameState.players.delete(connectionId);
  
  if (connectionId === gameState.currentPlayer && gameState.isGameActive) {
    selectNextPlayer();
    await broadcastToAll('next-turn', {
      currentPlayer: gameState.currentPlayer,
      round: gameState.round
    });
  }
  
  await broadcastToAll('player-list-update', Array.from(gameState.players.values()));
  console.log('Client disconnected:', connectionId);
}

async function handleMessage(connectionId, message) {
  const { action, data } = message;
  console.log('[WebSocket] Received message:', { connectionId, action, dataKeys: Object.keys(data || {}) });
  
  switch (action) {
    case 'join-game':
      await handleJoinGame(connectionId, data);
      break;
    case 'start-game':
      await handleStartGame(connectionId);
      break;
    case 'performance-result':
      await handlePerformanceResult(connectionId, data);
      break;
    case 'startPerformance':
      await handleStartPerformance(connectionId);
      break;
    case 'audioData':
      await handleAudioData(connectionId, data);
      break;
    case 'endPerformance':
      await handleEndPerformance(connectionId);
      break;
    default:
      console.log('Unknown action:', action);
  }
}

async function handleJoinGame(connectionId, playerName) {
  if (gameState.players.size >= 10) {
    await sendToConnection(connectionId, 'game-full', {});
    return;
  }

  gameState.players.set(connectionId, {
    id: connectionId,
    name: playerName,
    isAlive: true,
    score: 0
  });

  await sendToConnection(connectionId, 'player-joined', {
    playerId: connectionId,
    players: Array.from(gameState.players.values())
  });

  await broadcastToAll('player-list-update', Array.from(gameState.players.values()));
}

async function handleStartGame(connectionId) {
  if (gameState.players.size < 2) {
    await sendToConnection(connectionId, 'not-enough-players', {});
    return;
  }

  gameState.isGameActive = true;
  gameState.round = 1;
  gameState.eliminatedPlayers.clear();
  
  // Reset all players
  gameState.players.forEach(player => {
    player.isAlive = true;
  });

  selectNextPlayer();
  await broadcastToAll('game-started', {
    currentPlayer: gameState.currentPlayer,
    round: gameState.round
  });
}

async function handlePerformanceResult(connectionId, { hasLaughter }) {
  const player = gameState.players.get(connectionId);
  
  if (hasLaughter && player) {
    player.isAlive = false;
    gameState.eliminatedPlayers.add(connectionId);
    
    await broadcastToAll('player-eliminated', {
      playerId: connectionId,
      playerName: player.name,
      reason: 'Laughed during performance!'
    });
  }

  // Check win condition
  const alivePlayers = Array.from(gameState.players.values()).filter(p => p.isAlive);
  
  if (alivePlayers.length === 1) {
    await broadcastToAll('game-over', {
      winner: alivePlayers[0]
    });
    gameState.isGameActive = false;
  } else if (alivePlayers.length === 0) {
    await broadcastToAll('game-over', {
      winner: null,
      message: 'Everyone was eliminated!'
    });
    gameState.isGameActive = false;
  } else {
    selectNextPlayer();
    await broadcastToAll('next-turn', {
      currentPlayer: gameState.currentPlayer,
      round: gameState.round
    });
  }
}

function selectNextPlayer() {
  const alivePlayers = Array.from(gameState.players.values()).filter(p => p.isAlive);
  
  if (alivePlayers.length === 0) {
    gameState.currentPlayer = null;
    return;
  }

  // Find current player index
  let currentIndex = alivePlayers.findIndex(p => p.id === gameState.currentPlayer);
  
  // Move to next player
  currentIndex = (currentIndex + 1) % alivePlayers.length;
  
  // If we've cycled through all players, increment round
  if (currentIndex === 0) {
    gameState.round++;
  }
  
  gameState.currentPlayer = alivePlayers[currentIndex].id;
}

async function sendToConnection(connectionId, event, data) {
  try {
    await apigwManagementApi.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify({ event, data })
    }));
  } catch (error) {
    if (error.statusCode === 410) {
      console.log('Connection gone:', connectionId);
      // Clean up stale connection
      await handleDisconnect(connectionId);
    } else {
      console.error('Error sending message:', error);
    }
  }
}

async function broadcastToAll(event, data) {
  const connections = await getAllConnections();
  
  const promises = connections.map(connectionId => 
    sendToConnection(connectionId, event, data)
  );
  
  await Promise.allSettled(promises);
}

async function getAllConnections() {
  const params = {
    TableName: TABLE_NAME
  };
  
  const result = await ddb.send(new ScanCommand(params));
  return result.Items.map(item => item.connectionId);
}

// Start real-time performance tracking
async function handleStartPerformance(connectionId) {
  console.log('[WebSocket] Starting performance for connection:', connectionId);
  
  const player = gameState.players.get(connectionId);
  if (!player) {
    console.error('[WebSocket] Player not found for connection:', connectionId);
    return;
  }
  
  console.log('[WebSocket] Player found:', player.name);
  
  // Get secrets from AWS Secrets Manager
  let secrets;
  try {
    secrets = await getSecrets();
  } catch (error) {
    console.error('[WebSocket] Failed to get secrets:', error);
    await sendToConnection(connectionId, 'error', { 
      message: 'Failed to retrieve configuration. Please try again.' 
    });
    return;
  }
  
  // Check if API key is available
  if (!secrets.OPENAI_API_KEY) {
    console.error('[WebSocket] OPENAI_API_KEY not found in secrets!');
    await sendToConnection(connectionId, 'error', { 
      message: 'OpenAI API key not configured. Please contact admin.' 
    });
    return;
  }
  
  console.log('[WebSocket] Creating Realtime API detector...');
  
  // Create a new Realtime API detector for this player
  const detector = new RealtimeLaughterDetector(
    secrets.OPENAI_API_KEY,
    async (result) => {
      console.log('[WebSocket] Laughter detected callback triggered:', result);
      
      // Send laughter detection back to client
      await sendToConnection(connectionId, 'laughterDetected', result);
      
      // Auto-eliminate player if laughter detected with high confidence
      if (result.confidence > 0.7) {
        console.log('[WebSocket] High confidence laughter - eliminating player');
        if (gameState.currentPlayer === connectionId) {
          await handlePerformanceResult(connectionId, { hasLaughter: true });
        }
      }
    }
  );
  
  try {
    console.log('[WebSocket] Connecting to Realtime API...');
    await detector.connect();
    activeDetectors.set(connectionId, detector);
    
    console.log('[WebSocket] Realtime API connected successfully');
    await sendToConnection(connectionId, 'performanceStarted', { status: 'tracking' });
  } catch (error) {
    console.error('[WebSocket] Failed to start Realtime API:', error);
    await sendToConnection(connectionId, 'error', { 
      message: 'Failed to start laughter detection',
      details: error.message 
    });
  }
}

// Handle incoming audio data
async function handleAudioData(connectionId, data) {
  const detector = activeDetectors.get(connectionId);
  
  if (!detector) {
    console.error('[WebSocket] No detector found for connection:', connectionId);
    return;
  }
  
  if (!detector.isConnected) {
    console.error('[WebSocket] Detector not connected for:', connectionId);
    return;
  }
  
  // Convert base64 to buffer and send to Realtime API
  const audioBuffer = Buffer.from(data.audio, 'base64');
  console.log('[WebSocket] Received audio data:', {
    connectionId,
    base64Length: data.audio.length,
    bufferLength: audioBuffer.length,
    sampleCount: audioBuffer.length / 2
  });
  
  detector.sendAudio(audioBuffer);
}

// End performance and cleanup
async function handleEndPerformance(connectionId) {
  console.log('[WebSocket] Ending performance for connection:', connectionId);
  
  const detector = activeDetectors.get(connectionId);
  
  if (detector) {
    console.log('[WebSocket] Committing audio and cleaning up detector');
    
    // Commit audio and wait briefly for final detection
    detector.commitAudio();
    
    setTimeout(() => {
      console.log('[WebSocket] Disconnecting detector for:', connectionId);
      detector.disconnect();
      activeDetectors.delete(connectionId);
    }, 1000);
  } else {
    console.log('[WebSocket] No detector found to clean up for:', connectionId);
  }
}