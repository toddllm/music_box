// Song Generation Service using Fal.ai Minimax Music API
import * as fal from '@fal-ai/client';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

export class SongGenerator {
  constructor() {
    this.falClient = null;
    this.secretsClient = new SecretsManagerClient({ region: 'us-east-1' });
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Get Fal.ai API key from AWS Secrets Manager
      const apiKey = await this.getFalApiKey();
      
      // Configure Fal.ai client
      fal.config({
        credentials: apiKey
      });
      
      this.falClient = fal;
      this.initialized = true;
      console.log('[SongGenerator] Initialized successfully');
    } catch (error) {
      console.error('[SongGenerator] Failed to initialize:', error);
      throw error;
    }
  }

  async getFalApiKey() {
    try {
      // Try to get from AWS Secrets Manager first
      const command = new GetSecretValueCommand({ SecretId: 'music-box/fal-ai' });
      const response = await this.secretsClient.send(command);
      const secret = JSON.parse(response.SecretString);
      return secret.api_key;
    } catch (error) {
      console.error('[SongGenerator] Failed to get API key from Secrets Manager:', error);
      
      // Fallback to environment variable
      if (process.env.FAL_KEY) {
        console.log('[SongGenerator] Using API key from environment variable');
        return process.env.FAL_KEY;
      }
      
      throw new Error('No Fal.ai API key available. Please set FAL_KEY environment variable or store in AWS Secrets Manager');
    }
  }

  async generateSong(options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const {
      prompt,
      referenceAudioUrl = null,
      style = 'pop',
      duration = 30 // Default 30 seconds
    } = options;

    if (!prompt) {
      throw new Error('Prompt is required for song generation');
    }

    if (prompt.length > 600) {
      throw new Error('Prompt must be 600 characters or less');
    }

    try {
      console.log('[SongGenerator] Generating song with prompt:', prompt);
      
      const requestData = {
        prompt: this.formatPrompt(prompt, style, duration)
      };

      // Add reference audio if provided
      if (referenceAudioUrl) {
        requestData.reference_audio_url = referenceAudioUrl;
      }

      console.log('[SongGenerator] Request data:', requestData);

      const result = await this.falClient.subscribe('fal-ai/minimax-music', {
        input: requestData,
        logs: true,
        onQueueUpdate: (update) => {
          console.log('[SongGenerator] Queue update:', update.status);
        }
      });

      console.log('[SongGenerator] Generation complete:', result);

      return {
        success: true,
        audioUrl: result.audio?.url,
        prompt: prompt,
        generatedAt: new Date().toISOString(),
        duration: duration,
        style: style,
        metadata: {
          requestId: result.request_id || 'unknown',
          model: 'fal-ai/minimax-music'
        }
      };

    } catch (error) {
      console.error('[SongGenerator] Generation failed:', error);
      
      return {
        success: false,
        error: error.message,
        prompt: prompt,
        generatedAt: new Date().toISOString()
      };
    }
  }

  formatPrompt(userPrompt, style = 'pop', duration = 30) {
    // Format the prompt for better music generation
    const styleDescriptions = {
      'pop': 'upbeat pop music',
      'rock': 'energetic rock music',
      'jazz': 'smooth jazz music',
      'classical': 'orchestral classical music',
      'electronic': 'electronic dance music',
      'folk': 'acoustic folk music',
      'country': 'country music',
      'blues': 'blues music',
      'reggae': 'reggae music',
      'hip-hop': 'hip-hop music'
    };

    const styleDesc = styleDescriptions[style] || 'music';
    
    return `Create ${styleDesc} (${duration} seconds): ${userPrompt}`;
  }

  async generateSongForGame(gameContext = {}) {
    const {
      playerName = 'Player',
      theme = 'funny',
      difficulty = 'easy',
      customPrompt = null
    } = gameContext;

    let prompt;

    if (customPrompt) {
      prompt = customPrompt;
    } else {
      // Generate game-appropriate prompts based on theme and difficulty
      const gamePrompts = {
        funny: [
          'A silly song about a dancing banana',
          'Funny song about a cat who thinks it\'s a dog',
          'Comedic tune about trying to sing without laughing',
          'Amusing song about a rubber chicken orchestra'
        ],
        challenge: [
          'A song with lots of tongue twisters',
          'Music with funny sound effects and silly words',
          'A tune that makes you want to giggle',
          'Song with ridiculous rhymes and puns'
        ],
        custom: [
          `A personalized song for ${playerName}`,
          'An original composition for the music box game',
          'A unique melody for this performance'
        ]
      };

      const prompts = gamePrompts[theme] || gamePrompts.funny;
      prompt = prompts[Math.floor(Math.random() * prompts.length)];
    }

    // Adjust duration based on difficulty
    const durations = {
      easy: 20,
      medium: 30,
      hard: 45
    };

    const duration = durations[difficulty] || 30;

    return await this.generateSong({
      prompt,
      style: 'pop',
      duration
    });
  }

  async getSampleSongs() {
    // Return some pre-generated sample songs for quick testing
    return [
      {
        id: 'sample1',
        title: 'Happy Tune',
        prompt: 'A cheerful and upbeat song',
        style: 'pop',
        duration: 30,
        // This would be a real generated URL in production
        audioUrl: null,
        isGenerated: false
      },
      {
        id: 'sample2', 
        title: 'Silly Song',
        prompt: 'A funny song about dancing animals',
        style: 'pop',
        duration: 25,
        audioUrl: null,
        isGenerated: false
      }
    ];
  }

  // Health check method
  async healthCheck() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      return { status: 'healthy', initialized: this.initialized };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }
}

export default SongGenerator;