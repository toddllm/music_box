// Realtime API Laughter Detection for Music Box
// Uses OpenAI's Realtime API with function calling for accurate laughter detection

const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

class RealtimeLaughterDetector {
  constructor(apiKey, onLaughterDetected) {
    this.apiKey = apiKey;
    this.ws = null;
    this.sessionId = null;
    this.onLaughterDetected = onLaughterDetected;
    this.isConnected = false;
    this.audioBuffer = [];
    this.conversationId = null;
  }

  // Connect to OpenAI Realtime API
  async connect() {
    const wsUrl = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';
    
    this.ws = new WebSocket(wsUrl, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    this.ws.on('open', () => {
      console.log('[Realtime API] WebSocket connected to OpenAI');
      console.log('[Realtime API] Initializing session with laughter detection instructions...');
      this.isConnected = true;
      this.initializeSession();
    });

    this.ws.on('message', (data) => {
      const message = JSON.parse(data);
      this.handleMessage(message);
    });

    this.ws.on('error', (error) => {
      console.error('[Realtime API] WebSocket error:', error);
    });

    this.ws.on('close', () => {
      console.log('[Realtime API] Disconnected from OpenAI');
      this.isConnected = false;
    });
  }

  // Initialize session with laughter detection function
  initializeSession() {
    // Create session with function calling enabled
    this.sendMessage({
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
        voice: 'echo', // We don't need voice output
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
    });
  }

  // Handle incoming messages from Realtime API
  handleMessage(message) {
    console.log('[Realtime API] Received message:', {
      type: message.type,
      ...(message.type === 'error' && { error: message.error }),
      ...(message.type === 'session.created' && { session: message.session }),
      ...(message.type === 'session.updated' && { session: message.session }),
      ...(message.type === 'response.function_call_arguments.done' && { 
        name: message.name,
        arguments: message.arguments 
      }),
      ...(message.type === 'conversation.item.input_audio_transcription.completed' && {
        transcript: message.transcript
      }),
      fullMessage: message
    });

    switch (message.type) {
      case 'session.created':
        this.sessionId = message.session.id;
        console.log('[Realtime API] Session created successfully:', {
          sessionId: this.sessionId,
          model: message.session.model,
          modalities: message.session.modalities,
          voice: message.session.voice,
          tools: message.session.tools?.length || 0
        });
        break;
        
      case 'session.updated':
        console.log('[Realtime API] Session updated:', {
          sessionId: message.session.id,
          tools: message.session.tools?.map(t => t.name) || []
        });
        break;

      case 'conversation.created':
        this.conversationId = message.conversation.id;
        break;

      case 'response.function_call_arguments.done':
        // Function call completed
        console.log('[Realtime API] Function call completed:', {
          functionName: message.name,
          rawArguments: message.arguments
        });
        
        if (message.name === 'report_laughter') {
          try {
            const args = JSON.parse(message.arguments);
            console.log('[Realtime API] 🎉 LAUGHTER DETECTED!', {
              confidence: args.confidence,
              type: args.laughter_type,
              timestamp: args.timestamp_ms,
              transcription: this.lastTranscription
            });
            
            if (this.onLaughterDetected) {
              this.onLaughterDetected({
                confidence: args.confidence,
                laughterType: args.laughter_type,
                timestamp: args.timestamp_ms || Date.now(),
                transcription: this.lastTranscription
              });
            }
          } catch (error) {
            console.error('[Realtime API] Error parsing function arguments:', error);
          }
        }
        break;

      case 'conversation.item.input_audio_transcription.completed':
        // Store transcription for reference
        this.lastTranscription = message.transcript;
        console.log('[Realtime API] Audio transcribed:', {
          transcript: this.lastTranscription,
          length: this.lastTranscription?.length || 0
        });
        break;

      case 'error':
        console.error('[Realtime API] Error:', message.error);
        break;
        
      default:
        console.log('[Realtime API] Unhandled message type:', message.type);
    }
  }

  // Send audio data (PCM16, 16kHz, mono)
  sendAudio(audioBuffer) {
    if (!this.isConnected) {
      console.error('[Realtime API] Not connected - cannot send audio');
      return;
    }

    // Convert audio buffer to base64
    const base64Audio = audioBuffer.toString('base64');
    
    console.log('[Realtime API] Sending audio chunk:', {
      bufferLength: audioBuffer.length,
      base64Length: base64Audio.length,
      sampleSize: audioBuffer.length / 2, // 16-bit samples
      durationMs: (audioBuffer.length / 2 / 16000) * 1000 // Convert to milliseconds
    });

    this.sendMessage({
      type: 'input_audio_buffer.append',
      audio: base64Audio
    });
  }

  // Commit audio buffer (signals end of user input)
  commitAudio() {
    if (!this.isConnected) {
      console.error('[Realtime API] Cannot commit audio - not connected');
      return;
    }

    console.log('[Realtime API] Committing audio buffer for processing');
    this.sendMessage({
      type: 'input_audio_buffer.commit'
    });
  }

  // Send message to Realtime API
  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[Realtime API] Sending message:', {
        type: message.type,
        ...(message.type === 'input_audio_buffer.append' && { audioLength: message.audio?.length || 0 }),
        ...(message.type === 'session.update' && { hasTools: message.session?.tools?.length > 0 })
      });
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('[Realtime API] Cannot send message - WebSocket not open');
    }
  }

  // Disconnect from API
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// This module is imported by websocket.js which handles Lambda integration
// The activeDetectors Map is managed in websocket.js

module.exports = { RealtimeLaughterDetector };