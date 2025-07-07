// Serverless Song Generation Lambda Function
const { fal } = require('@fal-ai/client');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

// Initialize outside handler for connection reuse
let falInitialized = false;
const secretsClient = new SecretsManagerClient({ region: 'us-east-1' });

async function initializeFal() {
  if (falInitialized) return;
  
  try {
    const command = new GetSecretValueCommand({ SecretId: 'music-box/fal-ai' });
    const response = await secretsClient.send(command);
    const secret = JSON.parse(response.SecretString);
    
    // Configure fal client with credentials
    fal.config({ credentials: secret.api_key });
    falInitialized = true;
    
    console.log('Fal.ai client initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Fal.ai:', error);
    throw new Error('Fal.ai initialization failed');
  }
}

function formatPrompt(userPrompt, style = 'pop', duration = 30) {
  // The API expects prompts in a specific format
  // Use ## to mark accompaniment sections
  return userPrompt;
}

async function generateSong(prompt, style = 'pop', duration = 30, referenceAudioUrl = null) {
  try {
    // Initialize Fal.ai client if not already done
    await initializeFal();
    
    console.log('Generating song with prompt:', prompt);
    
    // Build request data for cassetteai/music-generator
    const requestData = {
      prompt: `${style} music: ${prompt}`,  // Include style in prompt
      duration: duration || 30  // duration in seconds (up to 180)
    };

    console.log('Calling Fal.ai API with:', requestData);

    // Use fal.subscribe to generate the song with cassetteai/music-generator
    const result = await fal.subscribe('cassetteai/music-generator', {
      input: requestData,
      logs: true,
      onQueueUpdate: (update) => {
        console.log('Queue update:', update.status);
      }
    });

    console.log('Generation complete:', result);

    return {
      success: true,
      audioUrl: result.data?.audio_file?.url || result.data?.audio?.url || result.audio?.url,
      prompt,
      style,
      duration,
      generatedAt: new Date().toISOString(),
      metadata: {
        requestId: result.requestId || 'unknown',
        model: 'cassetteai/music-generator'
      }
    };

  } catch (error) {
    console.error('Song generation failed:', error);
    console.error('Error details:', JSON.stringify(error.body || error, null, 2));
    return {
      success: false,
      error: error.message,
      prompt,
      generatedAt: new Date().toISOString(),
      details: error.body?.detail || error.message
    };
  }
}

// Main Lambda handler
exports.handler = async (event) => {
  console.log('Song generation request:', JSON.stringify(event, null, 2));
  
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

    // Parse request body
    const body = event.body ? JSON.parse(event.body) : {};
    const { prompt, style = 'pop', duration = 30, referenceAudioUrl = null } = body;

    // Route based on path
    const path = event.path || event.rawPath || '';

    if (path.includes('health')) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'healthy',
          service: 'song-generation',
          timestamp: new Date().toISOString()
        })
      };
    }

    if (path.includes('styles')) {
      const styles = [
        { id: 'pop', name: 'Pop', description: 'Upbeat and catchy' },
        { id: 'rock', name: 'Rock', description: 'Energetic and powerful' },
        { id: 'jazz', name: 'Jazz', description: 'Smooth and sophisticated' },
        { id: 'classical', name: 'Classical', description: 'Orchestral and elegant' },
        { id: 'electronic', name: 'Electronic', description: 'Digital and modern' },
        { id: 'folk', name: 'Folk', description: 'Acoustic and traditional' },
        { id: 'country', name: 'Country', description: 'Rural and storytelling' },
        { id: 'blues', name: 'Blues', description: 'Soulful and emotional' },
        { id: 'reggae', name: 'Reggae', description: 'Relaxed and rhythmic' },
        { id: 'hip-hop', name: 'Hip-Hop', description: 'Rhythmic and urban' }
      ];

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, styles })
      };
    }

    if (path.includes('generate')) {
      if (!prompt) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Prompt is required'
          })
        };
      }

      if (prompt.length > 600) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Prompt must be 600 characters or less'
          })
        };
      }

      const result = await generateSong(prompt, style, duration, referenceAudioUrl);
      
      return {
        statusCode: result.success ? 200 : 500,
        headers,
        body: JSON.stringify(result)
      };
    }

    // Default response for unknown paths
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
        error: 'Internal server error'
      })
    };
  }
};