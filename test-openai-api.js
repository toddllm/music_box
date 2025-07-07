#!/usr/bin/env node

// Test OpenAI API access using AWS Secrets Manager
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const WebSocket = require('ws');

const secretsClient = new SecretsManagerClient({ region: 'us-east-1' });

async function getSecrets() {
  try {
    const command = new GetSecretValueCommand({
      SecretId: 'music_box_config'
    });
    
    const response = await secretsClient.send(command);
    return JSON.parse(response.SecretString);
  } catch (error) {
    console.error('Failed to retrieve secrets:', error.message);
    process.exit(1);
  }
}

async function testOpenAIRealtimeAPI() {
  console.log('🔍 Getting OpenAI API key from AWS Secrets Manager...');
  
  const secrets = await getSecrets();
  if (!secrets.OPENAI_API_KEY) {
    console.error('❌ OpenAI API key not found in secrets');
    process.exit(1);
  }
  
  console.log('✅ Retrieved API key successfully');
  console.log('🔗 Connecting to OpenAI Realtime API...');
  
  const wsUrl = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';
  
  const ws = new WebSocket(wsUrl, {
    headers: {
      'Authorization': `Bearer ${secrets.OPENAI_API_KEY}`,
      'OpenAI-Beta': 'realtime=v1'
    }
  });
  
  let sessionCreated = false;
  
  ws.on('open', () => {
    console.log('✅ Connected to OpenAI Realtime API');
    
    // Initialize session with laughter detection
    const sessionConfig = {
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
    };
    
    console.log('📤 Sending session configuration...');
    ws.send(JSON.stringify(sessionConfig));
  });
  
  ws.on('message', (data) => {
    const message = JSON.parse(data);
    console.log('📥 Received:', message.type);
    
    switch (message.type) {
      case 'session.created':
        sessionCreated = true;
        console.log('✅ Session created successfully!');
        console.log('   Session ID:', message.session.id);
        console.log('   Model:', message.session.model);
        console.log('   Modalities:', message.session.modalities);
        console.log('   Tools:', message.session.tools?.length || 0);
        break;
        
      case 'session.updated':
        console.log('✅ Session updated with laughter detection configuration');
        console.log('   Tools configured:', message.session.tools?.map(t => t.name));
        
        // Test completed successfully
        setTimeout(() => {
          console.log('');
          console.log('🎉 OpenAI Realtime API test completed successfully!');
          console.log('✅ API key is valid');
          console.log('✅ Connection established');
          console.log('✅ Session configured for laughter detection');
          ws.close();
        }, 1000);
        break;
        
      case 'error':
        console.error('❌ OpenAI API Error:', message.error);
        ws.close();
        process.exit(1);
        break;
        
      default:
        console.log('   Details:', message.type);
    }
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
    if (error.message.includes('401')) {
      console.error('   This usually means the API key is invalid or expired');
    }
    process.exit(1);
  });
  
  ws.on('close', () => {
    if (sessionCreated) {
      console.log('🔌 Connection closed successfully');
      process.exit(0);
    } else {
      console.error('❌ Connection closed before session was created');
      process.exit(1);
    }
  });
  
  // Timeout after 30 seconds
  setTimeout(() => {
    console.error('❌ Test timed out');
    ws.close();
    process.exit(1);
  }, 30000);
}

// Run the test
console.log('🧪 Testing OpenAI Realtime API connectivity...');
testOpenAIRealtimeAPI().catch((error) => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});