const WebSocket = require('ws');

const ws = new WebSocket('wss://ws.softwarecompanyinabox.com/');

ws.on('open', () => {
  console.log('✓ Connected to WebSocket');
  ws.send(JSON.stringify({ type: 'ping' }));
});

ws.on('message', (data) => {
  console.log('✓ Received:', data.toString());
  if (data.toString().includes('welcome')) {
    setTimeout(() => {
      console.log('→ Sending ping...');
      ws.send(JSON.stringify({ type: 'ping' }));
    }, 1000);
  } else {
    setTimeout(() => {
      console.log('✓ Test complete, closing connection');
      ws.close();
      process.exit(0);
    }, 1000);
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