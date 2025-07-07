import WebSocket from 'ws';
import { EventEmitter } from 'events';

export class RealtimeClient extends EventEmitter {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
    this.ws = null;
    this.sessionId = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      });

      this.ws.on('open', () => {
        console.log('[RealtimeClient] Connected to OpenAI Realtime API');
        this.sendSessionUpdate();
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const event = JSON.parse(data.toString());
          console.log('[RealtimeClient] Received event:', event.type, event.error ? event.error : '');
          this.handleEvent(event);
        } catch (error) {
          console.error('[RealtimeClient] Failed to parse message:', data.toString());
        }
      });

      this.ws.on('error', (error) => {
        console.error('[RealtimeClient] WebSocket error:', error);
        this.emit('error', error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('[RealtimeClient] Disconnected from OpenAI');
        this.emit('close');
      });
    });
  }

  sendSessionUpdate() {
    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: `You are a laughter detection system. Listen for any laughter, giggling, chuckling, or similar sounds. When detected, call the report_laughter function.`,
        voice: 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 200
        },
        tools: [{
          type: 'function',
          name: 'report_laughter',
          description: 'Report when laughter is detected',
          parameters: {
            type: 'object',
            properties: {
              detected: { type: 'boolean' },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              laughterType: { 
                type: 'string', 
                enum: ['giggling', 'chuckling', 'loud_laughter', 'snickering']
              },
              intensity: { 
                type: 'string', 
                enum: ['subtle', 'moderate', 'intense']
              }
            },
            required: ['detected', 'confidence', 'laughterType', 'intensity']
          }
        }]
      }
    };

    this.ws.send(JSON.stringify(sessionConfig));
  }

  handleEvent(event) {
    switch (event.type) {
      case 'session.created':
        this.sessionId = event.session.id;
        console.log('[RealtimeClient] Session created:', this.sessionId);
        this.emit('session.created', event);
        break;
        
      case 'session.updated':
        console.log('[RealtimeClient] Session updated successfully');
        break;

      case 'response.function_call_arguments.done':
        if (event.name === 'report_laughter') {
          try {
            const args = JSON.parse(event.arguments);
            console.log('[RealtimeClient] Laughter detected:', args);
            this.emit('laughter.detected', args);
          } catch (error) {
            console.error('[RealtimeClient] Error parsing function call:', error);
          }
        }
        break;

      case 'error':
        console.error('[RealtimeClient] API error:', JSON.stringify(event.error, null, 2));
        this.emit('error', event.error);
        break;

      case 'input_audio_buffer.speech_started':
        console.log('[RealtimeClient] Speech started');
        break;

      case 'input_audio_buffer.speech_stopped':
        console.log('[RealtimeClient] Speech stopped');
        break;
    }
  }

  sendAudio(audioData) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[RealtimeClient] WebSocket not connected');
      return;
    }

    // Send audio append event
    const event = {
      type: 'input_audio_buffer.append',
      audio: audioData // base64 encoded PCM16 audio
    };

    this.ws.send(JSON.stringify(event));
  }

  createResponse() {
    // Trigger a response generation to check for laughter
    const event = {
      type: 'response.create'
    };
    this.ws.send(JSON.stringify(event));
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}