import { fal } from '@fal-ai/client';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

// Initialize AWS clients
const sm = new SecretsManagerClient();
const ddbClient = new DynamoDBClient();
const ddb = DynamoDBDocumentClient.from(ddbClient);
const s3 = new S3Client();

let falReady = false;
let openai = null;

// Initialize API clients with secrets
async function initServices() {
  if (falReady && openai) return;
  
  try {
    const secret = await sm.send(new GetSecretValueCommand({ 
      SecretId: 'karaoke-api-keys' 
    }));
    const secrets = JSON.parse(secret.SecretString);
    
    // Initialize Fal.ai
    fal.config({ credentials: secrets.fal_api_key });
    falReady = true;
    
    // Initialize OpenAI
    openai = new OpenAI({ apiKey: secrets.openai_api_key });
  } catch (error) {
    console.error('Failed to initialize services:', error);
    throw new Error('Service initialization failed');
  }
}

// Generate timestamped lyrics with emotion tags
async function generateLyrics(prompt, style, duration) {
  const messages = [
    {
      role: 'system',
      content: `You are a lyric writer for karaoke songs. Generate lyrics in LRC format with timestamps.
Format: [mm:ss.xx] Line of lyrics
Include emotion tags: [emotion:happy], [emotion:sad], [emotion:excited], etc.
Make lyrics fun and silly based on the prompt.
Duration should be approximately ${duration} seconds.`
    },
    {
      role: 'user',
      content: `Create karaoke lyrics about: "${prompt}" in ${style} style. Make it fun and singable!`
    }
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    temperature: 0.8,
    max_tokens: 500
  });

  return response.choices[0].message.content;
}

// Parse LRC lyrics to extract lines and timings
function parseLRCLyrics(lrcText) {
  const lines = lrcText.split('\n').filter(line => line.trim());
  const parsed = [];
  let currentEmotion = 'neutral';
  
  for (const line of lines) {
    // Check for emotion tags
    const emotionMatch = line.match(/\[emotion:(\w+)\]/);
    if (emotionMatch) {
      currentEmotion = emotionMatch[1];
      continue;
    }
    
    // Parse timestamp and text
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2})\]\s*(.*)/);
    if (match) {
      const [, minutes, seconds, centiseconds, text] = match;
      const timestamp = parseInt(minutes) * 60 + parseInt(seconds) + parseInt(centiseconds) / 100;
      parsed.push({
        timestamp,
        text,
        emotion: currentEmotion
      });
    }
  }
  
  return parsed;
}

// Generate song with DiffRhythm
async function generateSongWithVocals(lyrics, style, duration, emotion = 'happy') {
  // Prepare style prompt with emotion
  const emotionStyles = {
    happy: 'upbeat cheerful energetic',
    sad: 'melancholic slow emotional',
    excited: 'fast-paced enthusiastic dynamic',
    calm: 'peaceful relaxing gentle',
    dramatic: 'theatrical powerful epic'
  };
  
  const enhancedStyle = `${style} ${emotionStyles[emotion] || emotionStyles.happy}`;
  
  // Generate with DiffRhythm
  const result = await fal.subscribe('fal-ai/diffrhythm', {
    input: {
      lyrics: lyrics,
      style_prompt: enhancedStyle,
      music_duration: `${duration}s`,
      singer_voice: 'female', // Can be parameterized
      tempo: emotion === 'excited' ? 'fast' : 'medium'
    },
    logs: true,
    onQueueUpdate: (update) => {
      console.log('Queue update:', update);
    }
  });
  
  return result.data;
}

// Store song metadata in DynamoDB with TTL
async function storeSong(songData) {
  const id = uuidv4();
  const now = Date.now();
  const ttl = Math.floor(now / 1000) + 2592000; // 30 days
  
  const item = {
    id,
    title: songData.title || 'Generated Song',
    prompt: songData.prompt,
    style: songData.style,
    audioUrl: songData.audioUrl,
    lyrics: songData.lyrics,
    parsedLyrics: songData.parsedLyrics,
    duration: songData.duration,
    emotion: songData.emotion,
    createdAt: now,
    ttl
  };
  
  await ddb.send(new PutCommand({
    TableName: process.env.DYNAMO_TABLE,
    Item: item
  }));
  
  return item;
}

// Lambda handler
export const handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  };
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  try {
    await initServices();
    
    const path = event.path;
    
    // Generate new song endpoint
    if (path === '/generate' && event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);
      const { prompt, style = 'pop', duration = 30, emotion = 'happy' } = body;
      
      if (!prompt) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Prompt is required' })
        };
      }
      
      // Generate lyrics with timestamps
      console.log('Generating lyrics...');
      const lyrics = await generateLyrics(prompt, style, duration);
      const parsedLyrics = parseLRCLyrics(lyrics);
      
      // Generate song with vocals
      console.log('Generating song with vocals...');
      const songData = await generateSongWithVocals(lyrics, style, duration, emotion);
      
      // Store in DynamoDB
      const storedSong = await storeSong({
        title: `${style} song about ${prompt}`,
        prompt,
        style,
        audioUrl: songData.audio.url,
        lyrics,
        parsedLyrics,
        duration,
        emotion
      });
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          id: storedSong.id,
          audioUrl: storedSong.audioUrl,
          lyrics: storedSong.lyrics,
          parsedLyrics: storedSong.parsedLyrics,
          title: storedSong.title
        })
      };
    }
    
    // Get all songs endpoint
    if (path === '/songs' && event.httpMethod === 'GET') {
      const result = await ddb.send(new ScanCommand({
        TableName: process.env.DYNAMO_TABLE,
        Limit: 50
      }));
      
      // Sort by creation date
      const songs = result.Items.sort((a, b) => b.createdAt - a.createdAt);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(songs)
      };
    }
    
    // Get single song endpoint
    if (path.startsWith('/songs/') && event.httpMethod === 'GET') {
      const id = event.pathParameters?.id;
      if (!id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Song ID required' })
        };
      }
      
      const result = await ddb.send(new GetCommand({
        TableName: process.env.DYNAMO_TABLE,
        Key: { id }
      }));
      
      if (!result.Item) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Song not found' })
        };
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.Item)
      };
    }
    
    // Webhook endpoint for async processing
    if (path === '/webhook' && event.httpMethod === 'POST') {
      // Handle Fal.ai webhooks if needed
      console.log('Webhook received:', event.body);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ received: true })
      };
    }
    
    // 404 for unknown paths
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found' })
    };
    
  } catch (error) {
    console.error('Lambda error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};