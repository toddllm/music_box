// Karaoke Game Lambda Function with Lyrics and Voice Synthesis
const { fal } = require('@fal-ai/client');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Initialize outside handler for connection reuse
let falInitialized = false;
let elevenLabsKey = null;
let elevenLabsVoiceId = null;
const secretsClient = new SecretsManagerClient({ region: 'us-east-1' });

// Initialize DynamoDB
const dynamoDbClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoDbClient);
const tableName = process.env.DYNAMODB_TABLE_NAME;

async function initializeServices() {
  if (falInitialized && elevenLabsKey) return;
  
  try {
    // Initialize Fal.ai
    if (!falInitialized) {
      const falCommand = new GetSecretValueCommand({ SecretId: 'music-box/fal-ai' });
      const falResponse = await secretsClient.send(falCommand);
      const falSecret = JSON.parse(falResponse.SecretString);
      fal.config({ credentials: falSecret.api_key });
      falInitialized = true;
      console.log('Fal.ai client initialized successfully');
    }
    
    // Initialize ElevenLabs
    if (!elevenLabsKey) {
      const elevenCommand = new GetSecretValueCommand({ SecretId: 'music-box/elevenlabs' });
      const elevenResponse = await secretsClient.send(elevenCommand);
      const elevenSecret = JSON.parse(elevenResponse.SecretString);
      elevenLabsKey = elevenSecret.api_key;
      elevenLabsVoiceId = elevenSecret.voice_id;
      console.log('ElevenLabs initialized successfully');
    }
  } catch (error) {
    console.error('Failed to initialize services:', error);
    throw new Error('Service initialization failed');
  }
}

// Generate lyrics based on song prompt and style
async function generateLyrics(prompt, style, duration) {
  try {
    console.log('Generating lyrics for:', { prompt, style, duration });
    
    // Use Fal.ai to generate lyrics with a text model
    const lyricsPrompt = `Write song lyrics for a ${duration}-second ${style} song about: ${prompt}. 
    Format the output as JSON with this structure:
    {
      "title": "Song Title",
      "verses": [
        {
          "type": "verse",
          "number": 1,
          "singer": "player",
          "lines": ["Line 1", "Line 2", "Line 3", "Line 4"],
          "startTime": 0,
          "duration": 8
        },
        {
          "type": "chorus",
          "number": 1,
          "singer": "ai",
          "lines": ["Chorus line 1", "Chorus line 2"],
          "startTime": 8,
          "duration": 8
        }
      ]
    }
    Alternate between "player" and "ai" singers for different verses. Make sure total duration matches ${duration} seconds.`;

    // For now, generate sample lyrics (you can integrate with a text generation API)
    const lyrics = generateSampleLyrics(prompt, style, duration);
    
    return lyrics;
  } catch (error) {
    console.error('Lyrics generation failed:', error);
    throw error;
  }
}

// Generate sample lyrics based on prompt
function generateSampleLyrics(prompt, style, duration) {
  const verseCount = Math.floor(duration / 15); // Roughly 15 seconds per verse/chorus pair
  const verses = [];
  
  // Create alternating verses and choruses
  for (let i = 0; i < verseCount; i++) {
    // Verse
    verses.push({
      type: 'verse',
      number: i + 1,
      singer: i % 2 === 0 ? 'player' : 'ai',
      lines: generateVerseLines(prompt, style, i + 1),
      startTime: i * 15,
      duration: 8
    });
    
    // Chorus
    if (i < verseCount - 1 || duration > 20) {
      verses.push({
        type: 'chorus',
        number: Math.floor(i / 2) + 1,
        singer: i % 2 === 0 ? 'ai' : 'player',
        lines: generateChorusLines(prompt, style),
        startTime: i * 15 + 8,
        duration: 7
      });
    }
  }
  
  return {
    title: `${style.charAt(0).toUpperCase() + style.slice(1)} Song`,
    verses,
    totalDuration: duration
  };
}

function generateVerseLines(prompt, style, verseNumber) {
  // Generate contextual lyrics based on prompt
  const themes = prompt.toLowerCase().split(' ');
  const lines = [];
  
  if (themes.includes('birthday') || themes.includes('happy')) {
    lines.push(
      "Today's a special celebration",
      "Joy and laughter fill the air",
      "Friends and family gather 'round",
      "Happiness is everywhere"
    );
  } else if (themes.includes('love') || themes.includes('heart')) {
    lines.push(
      "In your eyes I see the stars",
      "Every moment feels so right",
      "Together we can touch the sky",
      "Dancing in the moonlight"
    );
  } else {
    // Generic lyrics
    lines.push(
      `This ${style} melody flows through time`,
      "Every note tells our story",
      "Music brings us all together",
      "In this moment of glory"
    );
  }
  
  return lines;
}

function generateChorusLines(prompt, style) {
  const themes = prompt.toLowerCase().split(' ');
  
  if (themes.includes('birthday') || themes.includes('happy')) {
    return [
      "Celebrate, celebrate, this wonderful day",
      "Let the music guide our way"
    ];
  } else if (themes.includes('love') || themes.includes('heart')) {
    return [
      "Love will find a way, through the night and day",
      "In your arms I want to stay"
    ];
  } else {
    return [
      `Feel the ${style} rhythm in your soul`,
      "Let the music take control"
    ];
  }
}

// Synthesize AI voice for specific verses
async function synthesizeVoice(text, voiceSettings = {}) {
  try {
    console.log('Synthesizing voice for text:', text);
    
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}`,
      {
        text: text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: voiceSettings.stability || 0.5,
          similarity_boost: voiceSettings.similarity_boost || 0.5,
          style: voiceSettings.style || 0.5,
          use_speaker_boost: true
        }
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
    
    // Convert audio buffer to base64
    const audioBase64 = Buffer.from(response.data).toString('base64');
    
    return {
      success: true,
      audio: audioBase64,
      contentType: 'audio/mpeg'
    };
  } catch (error) {
    console.error('Voice synthesis failed:', error.response?.data || error);
    throw error;
  }
}

// Generate complete karaoke package
async function generateKaraokePackage(prompt, style, duration) {
  const startTime = Date.now();
  try {
    await initializeServices();
    console.log(`Starting generation at ${new Date().toISOString()}`);
    
    // 1. Generate the instrumental music
    console.log('Generating instrumental music...');
    const musicResult = await fal.subscribe('cassetteai/music-generator', {
      input: {
        prompt: `${style} instrumental karaoke backing track: ${prompt}`,
        duration: duration || 30
      },
      logs: true,
      onQueueUpdate: (update) => {
        console.log('Music generation update:', update.status);
      }
    });
    
    // 2. Generate lyrics with timing
    console.log('Generating lyrics...');
    const lyrics = await generateLyrics(prompt, style, duration);
    
    // 3. Synthesize AI vocals for AI verses
    console.log('Synthesizing AI vocals...');
    const aiVocals = [];
    for (const verse of lyrics.verses) {
      if (verse.singer === 'ai') {
        const text = verse.lines.join('. ');
        const vocal = await synthesizeVoice(text, {
          stability: 0.6,
          similarity_boost: 0.7,
          style: 0.4
        });
        aiVocals.push({
          verseId: `${verse.type}_${verse.number}`,
          startTime: verse.startTime,
          duration: verse.duration,
          audio: vocal.audio
        });
      }
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`Generation completed in ${totalTime}ms (${totalTime/1000}s)`);
    
    return {
      success: true,
      musicUrl: musicResult.data?.audio_file?.url || musicResult.data?.audio?.url,
      lyrics: lyrics,
      aiVocals: aiVocals,
      prompt,
      style,
      duration,
      generatedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Karaoke package generation failed:', error);
    return {
      success: false,
      error: error.message,
      details: error.response?.data || error.body?.detail || error.message
    };
  }
}

// Main Lambda handler
exports.handler = async (event) => {
  console.log('Karaoke request:', JSON.stringify(event, null, 2));
  
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
    const path = event.path || event.rawPath || '';

    // Route: Generate karaoke package
    if (path.includes('karaoke/generate')) {
      const { prompt, style = 'pop', duration = 30 } = body;
      
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
      
      const result = await generateKaraokePackage(prompt, style, duration);
      
      // Save the song to DynamoDB if successful
      if (result.success && tableName) {
        try {
          // We need to wait for the ID to be generated
          await saveSongToDb(result);
        } catch (error) {
          console.error('Failed to save song to DB:', error);
          // Don't fail the request if save fails
        }
      }
      
      return {
        statusCode: result.success ? 200 : 500,
        headers,
        body: JSON.stringify(result)
      };
    }
    
    // Route: Generate lyrics only
    if (path.includes('karaoke/lyrics')) {
      const { prompt, style = 'pop', duration = 30 } = body;
      
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
      
      await initializeServices();
      const lyrics = await generateLyrics(prompt, style, duration);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          lyrics
        })
      };
    }
    
    // Route: Synthesize voice only
    if (path.includes('karaoke/voice')) {
      const { text, voiceSettings = {} } = body;
      
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
      
      await initializeServices();
      const result = await synthesizeVoice(text, voiceSettings);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result)
      };
    }

    // Route: Get all songs
    if (path.includes('karaoke/songs') && event.httpMethod === 'GET' && !event.pathParameters?.id) {
      try {
        const result = await getAllSongs();
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(result)
        };
      } catch (error) {
        console.error('Error getting songs:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Failed to retrieve songs'
          })
        };
      }
    }
    
    // Route: Get single song by ID
    if (path.includes('karaoke/songs/') && event.httpMethod === 'GET' && event.pathParameters?.id) {
      try {
        const songId = event.pathParameters.id;
        const result = await getSongById(songId);
        
        if (!result.success) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'Song not found'
            })
          };
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(result)
        };
      } catch (error) {
        console.error('Error getting song:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Failed to retrieve song'
          })
        };
      }
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
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};

// DynamoDB Functions
async function saveSongToDb(songData) {
  try {
    const songId = uuidv4();
    const timestamp = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days TTL
    
    const item = {
      id: songId,
      createdAt: timestamp,
      ttl: ttl,
      prompt: songData.prompt,
      style: songData.style,
      duration: songData.duration,
      title: songData.lyrics?.title || 'Untitled Song',
      musicUrl: songData.musicUrl,
      lyrics: songData.lyrics,
      aiVocals: songData.aiVocals || []
    };
    
    await docClient.send(new PutCommand({
      TableName: tableName,
      Item: item
    }));
    
    // Add the ID to the response
    songData.id = songId;
    console.log('Song saved to DynamoDB:', songId);
    
  } catch (error) {
    console.error('Error saving song to DynamoDB:', error);
    // Don't fail the request if save fails
  }
}

async function getAllSongs() {
  try {
    // Scan with limit to get recent songs
    const response = await docClient.send(new ScanCommand({
      TableName: tableName,
      Limit: 20,
      ProjectionExpression: 'id, createdAt, title, prompt, #s, #d',
      ExpressionAttributeNames: {
        '#s': 'style',
        '#d': 'duration'
      }
    }));
    
    // Sort by createdAt descending
    const songs = response.Items || [];
    songs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    return {
      success: true,
      songs: songs
    };
  } catch (error) {
    console.error('Error getting all songs:', error);
    throw error;
  }
}

async function getSongById(songId) {
  try {
    const response = await docClient.send(new GetCommand({
      TableName: tableName,
      Key: { id: songId }
    }));
    
    if (!response.Item) {
      return { success: false };
    }
    
    return {
      success: true,
      song: response.Item
    };
  } catch (error) {
    console.error('Error getting song by ID:', error);
    throw error;
  }
}