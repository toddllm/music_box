// Singing Synthesis Experiment Lambda
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const axios = require('axios');

const secretsClient = new SecretsManagerClient({ region: 'us-east-1' });

// Store API keys
let openaiKey = null;
let elevenLabsKey = null;
let elevenLabsVoiceId = null;

async function initializeServices() {
  if (openaiKey && elevenLabsKey) return;
  
  try {
    // Get ElevenLabs credentials
    const elevenCommand = new GetSecretValueCommand({ SecretId: 'music-box/elevenlabs' });
    const elevenResponse = await secretsClient.send(elevenCommand);
    const elevenSecret = JSON.parse(elevenResponse.SecretString);
    elevenLabsKey = elevenSecret.api_key;
    elevenLabsVoiceId = elevenSecret.voice_id;
    
    // Try to get OpenAI key if available
    try {
      const openaiCommand = new GetSecretValueCommand({ SecretId: 'music-box/openai' });
      const openaiResponse = await secretsClient.send(openaiCommand);
      const openaiSecret = JSON.parse(openaiResponse.SecretString);
      openaiKey = openaiSecret.api_key;
    } catch (error) {
      console.log('OpenAI key not found, will use other services');
    }
    
    console.log('Services initialized');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    throw new Error('Service initialization failed');
  }
}

// Experiment 1: ElevenLabs with musical parameters
async function elevenLabsSinging(text, style = 'melodic') {
  try {
    console.log('ElevenLabs singing synthesis:', { text, style });
    
    // Try different voice settings for more musical output
    const voiceSettings = {
      stability: style === 'ballad' ? 0.8 : 0.5,
      similarity_boost: 0.7,
      style: style === 'upbeat' ? 0.8 : 0.4,
      use_speaker_boost: true
    };
    
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}`,
      {
        text: text,
        model_id: "eleven_multilingual_v2", // Latest model
        voice_settings: voiceSettings
      },
      {
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': elevenLabsKey,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );
    
    const audioBase64 = Buffer.from(response.data).toString('base64');
    return {
      success: true,
      audio: audioBase64,
      service: 'elevenlabs',
      model: 'eleven_multilingual_v2',
      settings: voiceSettings
    };
  } catch (error) {
    console.error('ElevenLabs synthesis failed:', error.response?.data || error);
    return {
      success: false,
      error: error.message,
      service: 'elevenlabs'
    };
  }
}

// Experiment 2: OpenAI TTS with different voices
async function openaiSinging(text, voice = 'alloy') {
  if (!openaiKey) {
    return {
      success: false,
      error: 'OpenAI API key not configured',
      service: 'openai'
    };
  }
  
  try {
    console.log('OpenAI TTS synthesis:', { text, voice });
    
    const response = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      {
        model: 'tts-1-hd', // High quality model
        input: text,
        voice: voice, // alloy, echo, fable, onyx, nova, shimmer
        response_format: 'mp3',
        speed: 1.0
      },
      {
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );
    
    const audioBase64 = Buffer.from(response.data).toString('base64');
    return {
      success: true,
      audio: audioBase64,
      service: 'openai',
      model: 'tts-1-hd',
      voice: voice
    };
  } catch (error) {
    console.error('OpenAI synthesis failed:', error.response?.data || error);
    return {
      success: false,
      error: error.message,
      service: 'openai'
    };
  }
}

// Experiment 3: Suno AI (if we add the API key)
async function sunoSinging(text, style = 'pop') {
  // Suno AI is a dedicated music/singing AI
  // We would need to add their API key to secrets manager
  return {
    success: false,
    error: 'Suno AI not yet configured',
    service: 'suno',
    note: 'Suno AI specializes in singing synthesis but requires separate API access'
  };
}

// Main Lambda handler
exports.handler = async (event) => {
  console.log('Singing experiment request:', JSON.stringify(event, null, 2));
  
  try {
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
    };

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers,
        body: ''
      };
    }

    await initializeServices();
    
    const body = event.body ? JSON.parse(event.body) : {};
    const path = event.path || event.rawPath || '';
    
    // Route: Test all singing methods
    if (path.includes('singing/test-all')) {
      const { text = "La la la, I'm singing a happy song!", style = "melodic" } = body;
      
      const results = await Promise.allSettled([
        elevenLabsSinging(text, style),
        openaiSinging(text, 'alloy'),
        openaiSinging(text, 'nova'),
        openaiSinging(text, 'shimmer'),
        sunoSinging(text, style)
      ]);
      
      const outputs = results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason });
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          text: text,
          style: style,
          results: outputs
        })
      };
    }
    
    // Route: Test specific service
    if (path.includes('singing/test')) {
      const { text, service = 'elevenlabs', style = 'melodic', voice = 'alloy' } = body;
      
      if (!text) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Text is required'
          })
        };
      }
      
      let result;
      switch (service) {
        case 'elevenlabs':
          result = await elevenLabsSinging(text, style);
          break;
        case 'openai':
          result = await openaiSinging(text, voice);
          break;
        case 'suno':
          result = await sunoSinging(text, style);
          break;
        default:
          result = { success: false, error: 'Unknown service' };
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result)
      };
    }
    
    // Route: Get available services
    if (path.includes('singing/services')) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          services: [
            {
              id: 'elevenlabs',
              name: 'ElevenLabs',
              available: true,
              models: ['eleven_multilingual_v2'],
              styles: ['melodic', 'ballad', 'upbeat']
            },
            {
              id: 'openai',
              name: 'OpenAI TTS',
              available: !!openaiKey,
              models: ['tts-1-hd'],
              voices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']
            },
            {
              id: 'suno',
              name: 'Suno AI',
              available: false,
              note: 'Specialized singing AI - requires API access'
            }
          ]
        })
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Endpoint not found'
      })
    };

  } catch (error) {
    console.error('Lambda error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};