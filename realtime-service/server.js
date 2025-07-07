// server.js
import http from 'http';
import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { RealtimeClient } from './realtime-client.js';

const PORT = process.env.PORT || 8080;

// Store OpenAI API key
let apiKey = null;
const secretsClient = new SecretsManagerClient({ region: 'us-east-1' });

// Store active Realtime API connections per client
const realtimeConnections = new Map();

async function getApiKey() {
  if (apiKey) return apiKey;
  
  try {
    const command = new GetSecretValueCommand({ SecretId: 'fertilia/openai' });
    const response = await secretsClient.send(command);
    const secret = JSON.parse(response.SecretString);
    apiKey = secret.api_key;
    console.log('[Server] OpenAI API key retrieved successfully');
    return apiKey;
  } catch (error) {
    console.error('[Server] Failed to get API key from Secrets Manager:', error);
    // Use environment variable as fallback
    if (process.env.OPENAI_API_KEY) {
      apiKey = process.env.OPENAI_API_KEY;
      console.log('[Server] Using API key from environment variable');
      return apiKey;
    }
    throw new Error('No OpenAI API key available');
  }
}

// Initialize API key on startup
getApiKey().catch(console.error);

/**
 * Lightweight health check for ALB.
 * (TargetGroup is already looking at /health on 8081; keep both if you like.)
 */
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200);
    res.end('ok');
  } else {
    res.writeHead(404);
    res.end();
  }
});
healthServer.listen(8081);

/**
 * Shared HTTP server for WebSocket upgrade.
 * We _could_ just pass a raw TCP socket to ws,
 * but using http lets us keep one listener.
 */
const server = http.createServer((req, res) => {
  // Handle non-WebSocket HTTP requests
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    service: 'Music Box Realtime WebSocket Service',
    status: 'ready',
    protocol: 'WSS',
    connections: wss.clients.size,
    timestamp: new Date().toISOString()
  }));
});

const wss = new WebSocketServer({ server, path: '/' });

wss.on('connection', (ws, req) => {
  const id = randomUUID();
  console.log(JSON.stringify({ evt: 'ws_open', id, ip: req.socket.remoteAddress }));

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    clientId: id,
    message: 'Connected to Music Box Realtime Service',
    protocol: 'WSS',
    timestamp: Date.now()
  }));

  ws.on('message', async (data, isBinary) => {
    try {
      if (isBinary) {
        // Handle binary data (audio)
        console.log(JSON.stringify({ evt: 'binary_data', id, size: data.length }));
        ws.send(JSON.stringify({ type: 'processing', message: 'Audio received' }));
        return;
      }

      // Handle JSON messages
      const message = JSON.parse(data.toString());
      console.log(JSON.stringify({ evt: 'message', id, type: message.type }));

      switch (message.type) {
        case 'startSession':
          // Create Realtime API connection for this client
          try {
            const key = await getApiKey();
            const realtimeClient = new RealtimeClient(key);
            
            // Set up laughter detection handler
            realtimeClient.on('laughter.detected', (data) => {
              console.log(JSON.stringify({ 
                evt: 'laughter_detected', 
                id, 
                data 
              }));
              
              ws.send(JSON.stringify({
                type: 'laughterDetected',
                data: {
                  ...data,
                  timestamp: Date.now()
                }
              }));
            });

            realtimeClient.on('error', (error) => {
              console.error(`[Server] Realtime API error for ${id}:`, error);
            });

            await realtimeClient.connect();
            realtimeConnections.set(id, realtimeClient);
            
            ws.send(JSON.stringify({
              type: 'sessionStarted',
              playerId: message.playerId,
              timestamp: Date.now()
            }));
          } catch (error) {
            console.error(`[Server] Failed to start session for ${id}:`, error);
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Failed to initialize laughter detection',
              timestamp: Date.now()
            }));
          }
          break;

        case 'audioData':
          // Log audio data reception
          console.log(JSON.stringify({ 
            evt: 'audio_received', 
            id, 
            dataLength: message.data ? message.data.length : 0,
            timestamp: Date.now() 
          }));
          
          // Send acknowledgment immediately
          ws.send(JSON.stringify({
            type: 'audioReceived',
            timestamp: Date.now()
          }));
          
          // Forward audio to Realtime API
          const realtimeClient = realtimeConnections.get(id);
          if (realtimeClient && (message.data || message.audio)) {
            realtimeClient.sendAudio(message.data || message.audio);
          }
          break;

        case 'endSession':
          // Clean up Realtime API connection
          const clientToEnd = realtimeConnections.get(id);
          if (clientToEnd) {
            clientToEnd.disconnect();
            realtimeConnections.delete(id);
          }
          
          ws.send(JSON.stringify({
            type: 'sessionEnded',
            timestamp: Date.now()
          }));
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;

        default:
          // Echo for testing
          ws.send(JSON.stringify({
            type: 'echo',
            original: message,
            timestamp: Date.now()
          }));
      }

    } catch (err) {
      console.error(JSON.stringify({ evt: 'error', id, msg: err.message }));
      ws.send(JSON.stringify({ 
        type: 'error', 
        error: err.message,
        timestamp: Date.now()
      }));
    }
  });

  ws.on('close', (code, reason) => {
    console.log(JSON.stringify({ evt: 'ws_close', id, code, reason: reason.toString() }));
    
    // Clean up Realtime API connection
    const realtimeClient = realtimeConnections.get(id);
    if (realtimeClient) {
      realtimeClient.disconnect();
      realtimeConnections.delete(id);
    }
  });

  ws.on('error', (error) =>
    console.log(JSON.stringify({ evt: 'ws_error', id, error: error.message }))
  );
});

server.listen(PORT, () =>
  console.log(JSON.stringify({ 
    evt: 'server_start', 
    port: PORT, 
    health_port: 8081,
    timestamp: new Date().toISOString()
  }))
);