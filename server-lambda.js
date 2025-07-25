const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { OpenAI, toFile } = require('openai');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

// Node.js 20 has native File support, no polyfill needed

const secretsManager = new SecretsManagerClient({});
const app = express();

let openai;

// Function to load secrets from AWS Secrets Manager
async function loadSecrets() {
  try {
    const secretName = process.env.SECRET_NAME || 'music_box_config';
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const data = await secretsManager.send(command);
    
    if (data.SecretString) {
      const secrets = JSON.parse(data.SecretString);
      
      // Set environment variables from secrets
      process.env.OPENAI_API_KEY = secrets.OPENAI_API_KEY;
      process.env.SESSION_SECRET = secrets.SESSION_SECRET;
      
      // Initialize OpenAI client
      openai = new OpenAI({
        apiKey: secrets.OPENAI_API_KEY
      });
    }
  } catch (error) {
    console.error('Error loading secrets:', error);
    throw error;
  }
}

const upload = multer({ 
  dest: '/tmp/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Serve socket.io client library
app.get('/socket.io/socket.io.js', (req, res) => {
  const socketIoPath = path.join(__dirname, 'node_modules', 'socket.io', 'client-dist', 'socket.io.js');
  res.sendFile(socketIoPath);
});

app.get('/socket.io/socket.io.min.js', (req, res) => {
  const socketIoPath = path.join(__dirname, 'node_modules', 'socket.io', 'client-dist', 'socket.io.min.js');
  res.sendFile(socketIoPath);
});

// Game state (simplified for Lambda)
const gameState = {
  players: new Map(),
  currentPlayer: null,
  isGameActive: false,
  round: 0,
  eliminatedPlayers: new Set()
};

// API Routes
app.post('/api/analyze-audio', upload.single('audio'), async (req, res) => {
  try {
    if (!openai) {
      await loadSecrets();
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const audioPath = req.file.path;
    
    // Transcribe audio using Whisper
    console.log('File info:', {
      path: audioPath,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
    
    // Try different approaches based on file type
    console.log('Reading file...');
    const audioBuffer = await fs.readFile(audioPath);
    
    // For debugging: save first few bytes
    console.log('First 20 bytes:', audioBuffer.slice(0, 20).toString('hex'));
    
    // Create the file object using different approaches
    let audioFile;
    try {
      // Approach 1: Direct buffer with toFile
      audioFile = await toFile(
        audioBuffer,
        req.file.originalname || 'audio.mp3',
        { type: req.file.mimetype || 'audio/mpeg' }
      );
    } catch (err) {
      console.error('toFile failed:', err.message);
      // Fallback: Use stream
      const stream = fsSync.createReadStream(audioPath);
      audioFile = await toFile(stream, req.file.originalname || 'audio.mp3');
    }
    
    console.log('Sending to OpenAI...');
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      response_format: "verbose_json"
    });

    // Analyze for laughter using GPT-4o-mini for faster response
    const laughAnalysis = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert at detecting laughter in audio transcriptions. Analyze the following transcription and determine if there is laughter present. Consider sounds like 'haha', 'hehe', giggling descriptions, or any indication of laughter. Respond with a JSON object containing 'hasLaughter' (boolean) and 'confidence' (0-100)."
        },
        {
          role: "user",
          content: `Transcription: ${transcription.text}`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 100,
      temperature: 0.3
    });

    const result = JSON.parse(laughAnalysis.choices[0].message.content);
    
    // Clean up uploaded file
    await fs.unlink(audioPath);

    res.json({
      transcription: transcription.text,
      hasLaughter: result.hasLaughter,
      confidence: result.confidence
    });

  } catch (error) {
    console.error('Error analyzing audio:', error);
    res.status(500).json({ error: 'Failed to analyze audio' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Base64 audio analysis endpoint (more reliable for Lambda)
app.post('/api/analyze-audio-base64', async (req, res) => {
  try {
    if (!openai) {
      await loadSecrets();
    }

    const { audioData, mimeType } = req.body;
    
    if (!audioData) {
      return res.status(400).json({ error: 'No audio data provided' });
    }

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audioData, 'base64');
    
    // Use OpenAI's toFile helper
    const file = await toFile(audioBuffer, 'audio.webm', { type: mimeType || 'audio/webm' });
    
    // Transcribe audio using Whisper
    console.log('Starting Whisper transcription...');
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      response_format: "verbose_json"
    });
    
    console.log('Whisper transcription result:', {
      text: transcription.text,
      duration: transcription.duration,
      language: transcription.language,
      segments: transcription.segments?.map(s => ({
        text: s.text,
        start: s.start,
        end: s.end,
        tokens: s.tokens?.slice(0, 5) // First 5 tokens for debug
      }))
    });

    // Enhanced prompt for better laughter detection
    const systemPrompt = `You are an expert at detecting laughter and vocal expressions in audio transcriptions.

Analyze the transcription for ANY signs of laughter, including:
- Explicit laughter words: "haha", "hehe", "hoho", "hahaha", "lol"
- Phonetic laughter: "ha", "he", "ah ah", "eh eh"
- Repeated vowel sounds that indicate laughter: "aaa", "eee", "ahaha"
- Breathing patterns: heavy breathing between words
- Giggling indicators: repeated short sounds
- Any vocalization that doesn't form real words but indicates amusement

The transcription might capture laughter as repeated letters or sounds.

Respond with a JSON object containing:
- hasLaughter (boolean): true if ANY form of laughter is detected
- confidence (0-100): how confident you are
- laughterType (string): type of laughter detected (e.g., "giggling", "loud laughter", "chuckling")
- explanation (string): brief explanation of what you detected`;

    const userPrompt = `Transcription: "${transcription.text}"
Duration: ${transcription.duration} seconds
Segments: ${JSON.stringify(transcription.segments?.map(s => s.text) || [])}

Is there any laughter or laughing sounds in this transcription?`;

    console.log('Sending to GPT-4o-mini for analysis...');
    const laughAnalysis = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 200,
      temperature: 0.3
    });

    const result = JSON.parse(laughAnalysis.choices[0].message.content);
    console.log('GPT-4o-mini analysis result:', result);

    res.json({
      transcription: transcription.text,
      hasLaughter: result.hasLaughter,
      confidence: result.confidence,
      laughterType: result.laughterType,
      explanation: result.explanation,
      debug: {
        duration: transcription.duration,
        language: transcription.language,
        segmentCount: transcription.segments?.length || 0,
        model: 'gpt-4o-mini',
        audioLength: audioBuffer.length
      }
    });

  } catch (error) {
    console.error('Error analyzing audio:', error);
    res.status(500).json({ error: 'Failed to analyze audio', details: error.message });
  }
});

// Debug endpoint
app.post('/api/debug-audio', upload.single('audio'), async (req, res) => {
  try {
    if (!openai) {
      await loadSecrets();
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Read file and check actual content
    const fileBuffer = await fs.readFile(req.file.path);
    const fileInfo = {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      actualSize: fileBuffer.length,
      path: req.file.path,
      first20Hex: fileBuffer.slice(0, 20).toString('hex'),
      last20Hex: fileBuffer.slice(-20).toString('hex')
    };

    // Try direct transcription with the file
    try {
      // Use the exact approach that works locally
      const { toFile } = require('openai');
      const audioFile = await toFile(
        fsSync.createReadStream(req.file.path),
        req.file.originalname
      );
      
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1"
      });
      
      fileInfo.transcription = transcription.text;
      fileInfo.success = true;
    } catch (err) {
      fileInfo.transcriptionError = err.message;
      fileInfo.errorDetails = err.response?.data || err.error || 'Unknown error';
    }

    // Clean up file
    await fs.unlink(req.file.path);

    res.json(fileInfo);
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Initialize secrets on module load
loadSecrets().catch(console.error);

module.exports = app;