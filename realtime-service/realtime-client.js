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
      this.ws = new WebSocket('wss://api.openai.com/v1/realtime', {
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
        const event = JSON.parse(data.toString());
        this.handleEvent(event);
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
        instructions: `You are a laughter detection system for a game where players must sing without laughing. 
        Listen carefully to the audio stream for any form of laughter, giggling, chuckling, or similar sounds. 
        When you detect laughter, immediately call the report_laughter function.
        Do NOT respond with text or audio, only use the function when laughter is detected.`,
        voice: 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 200
        },
        tools: [{
          type: 'function',
          name: 'report_laughter',
          description: 'Report when laughter is detected in the audio stream',
          parameters: {
            type: 'object',
            properties: {
              detected: { 
                type: 'boolean',
                description: 'Whether laughter was detected'
              },
              confidence: { 
                type: 'number', 
                minimum: 0, 
                maximum: 1,
                description: 'Confidence level of detection'
              },
              laughterType: { 
                type: 'string', 
                enum: ['giggling', 'chuckling', 'loud_laughter', 'snickering'],
                description: 'Type of laughter detected'
              },
              intensity: { 
                type: 'string', 
                enum: ['subtle', 'moderate', 'intense'],
                description: 'Intensity of the laughter'
              }
            },
            required: ['detected', 'confidence', 'laughterType', 'intensity']
          }
        }],
        tool_choice: 'auto'
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