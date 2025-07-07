#!/usr/bin/env node

// Local test script for the realtime service
const WebSocket = require('ws');

const OPENAI_WS_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';

async function testRealtimeAPI() {
  console.log('Testing OpenAI Realtime API connection...');
  
  // Get API key from environment or secrets
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Please set OPENAI_API_KEY environment variable');
    process.exit(1);
  }
  
  // Connect to OpenAI Realtime API
  const ws = new WebSocket(OPENAI_WS_URL, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'OpenAI-Beta': 'realtime=v1'
    }
  });
  
  ws.on('open', () => {
    console.log('✅ Connected to OpenAI Realtime API');
    
    // Send session configuration
    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: 'You are a test assistant. Just say hello.',
        voice: 'echo',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16'
      }
    };
    
    console.log('Sending session config...');
    ws.send(JSON.stringify(sessionConfig));
  });
  
  ws.on('message', (data) => {
    const message = JSON.parse(data);
    console.log('Received:', message.type);
    
    if (message.type === 'session.created') {
      console.log('✅ Session created successfully!');
      console.log('Session ID:', message.session.id);
      console.log('Model:', message.session.model);
      
      // Close connection after successful test
      setTimeout(() => {
        console.log('Test completed successfully!');
        ws.close();
        process.exit(0);
      }, 1000);
    }
    
    if (message.type === 'error') {
      console.error('❌ Error:', message.error);
      ws.close();
      process.exit(1);
    }
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
    process.exit(1);
  });
  
  ws.on('close', () => {
    console.log('Connection closed');
  });
}

// Run the test
testRealtimeAPI().catch(console.error);