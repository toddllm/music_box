// Client library for connecting to the Music Box Realtime Service

class MusicBoxRealtimeClient {
  constructor(serviceUrl, onLaughterDetected) {
    this.serviceUrl = serviceUrl;
    this.ws = null;
    this.clientId = null;
    this.isConnected = false;
    this.isSessionActive = false;
    this.onLaughterDetected = onLaughterDetected;
    this.audioContext = null;
    this.scriptProcessor = null;
    this.stream = null;
  }

  // Connect to the realtime service
  connect() {
    return new Promise((resolve, reject) => {
      console.log('[RealtimeClient] Connecting to:', this.serviceUrl);
      
      this.ws = new WebSocket(this.serviceUrl);
      
      this.ws.onopen = () => {
        console.log('[RealtimeClient] Connected to service');
        this.isConnected = true;
      };
      
      this.ws.onmessage = (event) => {
        try {
          // Handle blob data
          if (event.data instanceof Blob) {
            console.log('[RealtimeClient] Received blob data, ignoring for JSON parsing');
            return;
          }
          
          const message = JSON.parse(event.data);
          this.handleMessage(message);
          
          if (message.type === 'welcome') {
            this.clientId = message.clientId;
            resolve();
          }
        } catch (error) {
          console.error('[RealtimeClient] Error parsing message:', error, 'Data:', event.data);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('[RealtimeClient] WebSocket error:', error);
        reject(error);
      };
      
      this.ws.onclose = () => {
        console.log('[RealtimeClient] Disconnected from service');
        this.isConnected = false;
        this.isSessionActive = false;
        this.stopAudioStreaming();
      };
    });
  }

  // Handle messages from the service
  handleMessage(message) {
    console.log('[RealtimeClient] Received:', message);
    
    switch (message.type) {
      case 'welcome':
        console.log('[RealtimeClient] Client ID:', message.clientId);
        break;
        
      case 'sessionStarted':
        console.log('[RealtimeClient] Session started');
        this.isSessionActive = true;
        break;
        
      case 'sessionEnded':
        console.log('[RealtimeClient] Session ended');
        this.isSessionActive = false;
        this.stopAudioStreaming();
        break;
        
      case 'audioReceived':
        // Server acknowledgment of audio data
        if (!this.audioAckCount) this.audioAckCount = 0;
        this.audioAckCount++;
        if (this.audioAckCount % 10 === 0) {
          console.log(`[RealtimeClient] Server acknowledged ${this.audioAckCount} audio chunks`);
        }
        break;
        
      case 'laughterDetected':
        console.log('[RealtimeClient] 🎉 Laughter detected!', message.data);
        if (this.onLaughterDetected) {
          this.onLaughterDetected(message.data);
        }
        break;
        
      case 'transcription':
        console.log('[RealtimeClient] Transcription:', message.text);
        break;
        
      case 'error':
        console.error('[RealtimeClient] Error:', message.error);
        break;
    }
  }

  // Start a performance session
  async startPerformance(playerId) {
    if (!this.isConnected) {
      throw new Error('Not connected to realtime service');
    }
    
    console.log('[RealtimeClient] Starting performance for player:', playerId);
    
    // Start OpenAI session
    this.sendMessage({
      type: 'startSession',
      playerId: playerId
    });
    
    // Start audio streaming
    await this.startAudioStreaming();
  }

  // Start streaming audio from microphone
  async startAudioStreaming() {
    try {
      // Get microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      
      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });
      
      const source = this.audioContext.createMediaStreamSource(this.stream);
      
      // Create script processor for audio streaming
      const bufferSize = 4096;
      this.scriptProcessor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
      
      this.scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
        if (!this.isSessionActive) return;
        
        const inputBuffer = audioProcessingEvent.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        
        // Convert Float32Array to Int16Array (PCM16)
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Convert to base64 and send
        const base64Audio = btoa(String.fromCharCode.apply(null, new Uint8Array(pcm16.buffer)));
        
        // Log every 10th chunk to avoid spam
        if (!this.audioChunkCount) this.audioChunkCount = 0;
        this.audioChunkCount++;
        if (this.audioChunkCount % 10 === 0) {
          console.log(`[RealtimeClient] Sending audio chunk #${this.audioChunkCount}, size: ${base64Audio.length} bytes`);
        }
        
        this.sendMessage({
          type: 'audioData',
          audio: base64Audio
        });
      };
      
      source.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);
      
      console.log('[RealtimeClient] Audio streaming started');
      
    } catch (error) {
      console.error('[RealtimeClient] Error starting audio:', error);
      throw error;
    }
  }

  // Stop audio streaming
  stopAudioStreaming() {
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    console.log('[RealtimeClient] Audio streaming stopped');
  }

  // End the performance session
  endPerformance() {
    if (!this.isConnected) return;
    
    console.log('[RealtimeClient] Ending performance');
    
    // Stop audio first
    this.stopAudioStreaming();
    
    // End OpenAI session
    this.sendMessage({
      type: 'endSession'
    });
    
    this.isSessionActive = false;
  }

  // Send message to service
  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  // Disconnect from service
  disconnect() {
    if (this.ws) {
      this.endPerformance();
      this.ws.close();
      this.ws = null;
    }
  }
}