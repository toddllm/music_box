const WebSocket = require('ws');

const ws = new WebSocket('wss://ws.softwarecompanyinabox.com/');

let audioChunks = 0;
let laughterDetections = 0;

ws.on('open', () => {
  console.log('✓ Connected to WebSocket');
  
  // Start a session
  ws.send(JSON.stringify({ 
    type: 'startSession',
    playerId: 'test-player-' + Date.now()
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  
  switch(message.type) {
    case 'welcome':
      console.log('✓ Welcome received, clientId:', message.clientId);
      break;
      
    case 'sessionStarted':
      console.log('✓ Session started');
      // Start sending mock audio data
      console.log('→ Starting to send audio data...');
      const interval = setInterval(() => {
        // Send mock audio data (base64 encoded)
        ws.send(JSON.stringify({
          type: 'audioData',
          data: Buffer.from(new Uint8Array(1024)).toString('base64')
        }));
        audioChunks++;
        
        // Stop after 20 chunks
        if (audioChunks >= 20) {
          clearInterval(interval);
          console.log(`✓ Sent ${audioChunks} audio chunks`);
          
          // End session
          ws.send(JSON.stringify({ type: 'endSession' }));
        }
      }, 100); // Send every 100ms
      break;
      
    case 'audioReceived':
      // Server acknowledged audio
      if (audioChunks % 5 === 0) {
        console.log(`→ Server acknowledged ${audioChunks} chunks`);
      }
      break;
      
    case 'laughterDetected':
      laughterDetections++;
      console.log(`🎉 Laughter detected! #${laughterDetections}`, message.data);
      break;
      
    case 'sessionEnded':
      console.log('✓ Session ended');
      console.log(`\nSummary:`);
      console.log(`- Audio chunks sent: ${audioChunks}`);
      console.log(`- Laughter detections: ${laughterDetections}`);
      console.log(`- Detection rate: ${(laughterDetections/audioChunks*100).toFixed(1)}%`);
      ws.close();
      process.exit(0);
      break;
  }
});

ws.on('error', (error) => {
  console.error('✗ Error:', error.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('Connection closed');
});

setTimeout(() => {
  console.log('✗ Test timed out');
  process.exit(1);
}, 10000);