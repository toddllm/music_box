// server.js
import http from 'http';
import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';

const PORT = process.env.PORT || 8080;

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
          ws.send(JSON.stringify({
            type: 'sessionStarted',
            playerId: message.playerId,
            timestamp: Date.now()
          }));
          break;

        case 'audioData':
          // Mock laughter detection for testing
          if (Math.random() < 0.03) { // 3% chance to simulate laughter
            ws.send(JSON.stringify({
              type: 'laughterDetected',
              data: {
                confidence: 0.6 + Math.random() * 0.4,
                laughterType: ['chuckling', 'giggling', 'loud_laughter', 'snickering'][Math.floor(Math.random() * 4)],
                intensity: ['subtle', 'moderate', 'intense'][Math.floor(Math.random() * 3)],
                timestamp: Date.now()
              }
            }));
          }
          break;

        case 'endSession':
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

  ws.on('close', (code, reason) =>
    console.log(JSON.stringify({ evt: 'ws_close', id, code, reason: reason.toString() }))
  );

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