// Fal.ai Singing Models Lambda
const { fal } = require('@fal-ai/client');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

let ready = false;
const secretsClient = new SecretsManagerClient({ region: 'us-east-1' });

async function initFal() {
  if (ready) return;
  
  try {
    // Get Fal.ai API key from existing secret
    const command = new GetSecretValueCommand({ SecretId: 'music-box/fal-ai' });
    const response = await secretsClient.send(command);
    const secret = JSON.parse(response.SecretString);
    
    fal.config({ credentials: secret.api_key });
    ready = true;
    console.log('Fal.ai initialized for singing models');
  } catch (error) {
    console.error('Failed to initialize Fal.ai:', error);
    throw new Error('Fal.ai initialization failed');
  }
}

// Lambda handler
exports.handler = async (event) => {
  console.log('Fal singing request:', JSON.stringify(event, null, 2));
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
  };

  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers,
        body: ''
      };
    }

    await initFal();
    
    const body = JSON.parse(event.body || '{}');
    const { model, lyrics, genres, refUrl, audioUrl, start, end, tags } = body;
    
    console.log('Processing request for model:', model);
    
    // Validate model
    const validModels = ['fal-ai/yue', 'fal-ai/diffrhythm', 'fal-ai/ace-step/audio-inpaint'];
    if (!validModels.includes(model)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Invalid model. Choose from: ' + validModels.join(', ')
        })
      };
    }
    
    // Build per-model input
    const input = {};
    
    // Model-specific inputs based on API documentation
    if (model === 'fal-ai/yue') {
      // YuE REQUIRES both lyrics AND genres
      if (!lyrics || !genres) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'YuE requires both lyrics (with [verse] and [chorus]) and genres'
          })
        };
      }
      
      // Validate lyrics have required sections
      if (!lyrics.includes('[verse]') || !lyrics.includes('[chorus]')) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'YuE requires lyrics with at least one [verse] and one [chorus] section'
          })
        };
      }
      
      input.lyrics = lyrics;
      input.genres = genres; // Space-separated, e.g. "upbeat disco funky"
      
    } else if (model === 'fal-ai/diffrhythm') {
      // DiffRhythm requires timestamped lyrics for vocals
      if (!lyrics) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'DiffRhythm requires timestamped lyrics for vocal generation'
          })
        };
      }
      
      // Check if lyrics have timestamps
      const hasTimestamps = /^\[\d{2}:\d{2}(?:\.\d{2})?\]/.test(lyrics.trim());
      if (!hasTimestamps) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'DiffRhythm requires timestamped lyrics like [00:00.00] for vocals. Without timestamps, it generates instrumentals only.'
          })
        };
      }
      
      input.lyrics = lyrics;
      input.style_prompt = genres || 'vocal-forward pop';
      
      // Use Zeldina voice reference by default for consistent female voice
      const ZELDINA_VOICE_URL = 'https://v3.fal.media/files/monkey/C2_gjTrYLMk1hz9KF5vN2_output.wav';
      input.reference_audio_url = refUrl || ZELDINA_VOICE_URL;
      
      console.log('Using voice reference:', refUrl ? 'Custom URL' : 'Zeldina (default)');
    }
    
    if (model === 'fal-ai/ace-step/audio-inpaint') {
      if (!audioUrl || start === undefined || end === undefined) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Audio inpaint requires audioUrl, start, and end times'
          })
        };
      }
      input.audio_url = audioUrl;
      input.start_time = Number(start);
      input.end_time = Number(end);
      if (tags) input.tags = tags;
    }
    
    console.log('Calling Fal.ai with input:', input);
    
    // Call Fal.ai
    const startTime = Date.now();
    const result = await fal.subscribe(model, {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        console.log('Queue update:', update);
      }
    });
    
    const duration = Date.now() - startTime;
    console.log(`Generation completed in ${duration}ms`);
    
    // Extract audio URL based on model output structure
    let outputAudioUrl;
    if (result.data?.audio?.url) {
      outputAudioUrl = result.data.audio.url;
    } else if (result.data?.audio_file?.url) {
      outputAudioUrl = result.data.audio_file.url;
    } else if (result.data?.output_url) {
      outputAudioUrl = result.data.output_url;
    } else {
      console.error('Unexpected result structure:', result);
      throw new Error('Could not find audio URL in result');
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        requestId: result.requestId,
        audioUrl: outputAudioUrl,
        model: model,
        duration: duration,
        input: input
      })
    };
    
  } catch (error) {
    console.error('Lambda error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        details: error.response?.data || error.body?.detail || error.message
      })
    };
  }
};