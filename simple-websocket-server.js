const http = require('http');
const WebSocket = require('ws');

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Music Box WebSocket Service Ready - Connect via WebSocket');
});

// Create WebSocket server attached to HTTP server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  
  // Send welcome message
  ws.send(JSON.stringify({ 
    type: 'welcome', 
    clientId: 'test-' + Math.random().toString(36).substring(7) 
  }));
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      console.log('Received:', message.type);
      
      if (message.type === 'startSession') {
        ws.send(JSON.stringify({ 
          type: 'sessionStarted', 
          playerId: message.playerId 
        }));
      }
      
      if (message.type === 'audioData') {
        // Simulate laughter detection occasionally
        if (Math.random() < 0.1) {
          ws.send(JSON.stringify({
            type: 'laughterDetected',
            data: {
              laughterType: 'chuckling',
              confidence: Math.random(),
              timestamp: Date.now()
            }
          }));
        }
      }
      
    } catch (e) {
      console.log('Non-JSON message received');
    }
  });
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// Start server on port 8080
server.listen(8080, () => {
  console.log('HTTP+WebSocket server listening on port 8080');
});

// Health check server on port 8081
const healthServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');
});

healthServer.listen(8081, () => {
  console.log('Health check server listening on port 8081');
});