const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, DeleteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);
const apigwManagementApi = new ApiGatewayManagementApiClient({
  endpoint: `https://${process.env.WEBSOCKET_API_ID}.execute-api.${process.env.AWS_REGION}.amazonaws.com/${process.env.WEBSOCKET_STAGE}`
});

const TABLE_NAME = `music-box-connections-${process.env.NODE_ENV || 'production'}`;

// Game state stored in memory (in production, use DynamoDB or Redis)
const gameState = {
  players: new Map(),
  currentPlayer: null,
  isGameActive: false,
  round: 0,
  eliminatedPlayers: new Set()
};

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