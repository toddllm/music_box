const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { OpenAI } = require('openai');
const fs = require('fs').promises;
const path = require('path');

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
app.use(express.json());
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
    const transcription = await openai.audio.transcriptions.create({
      file: await fs.readFile(audioPath),
      model: "whisper-1",
      response_format: "verbose_json"
    });

    // Analyze for laughter using GPT-4o
    const laughAnalysis = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert at detecting laughter in audio transcriptions. Analyze the following transcription and determine if there is laughter present. Consider sounds like 'haha', 'hehe', giggling descriptions, or any indication of laughter. Respond with a JSON object containing 'hasLaughter' (boolean) and 'confidence' (0-100)."
        },
        {
          role: "user",
          content: `Transcription: ${transcription.text}\nSegments: ${JSON.stringify(transcription.segments)}`
        }
      ],
      response_format: { type: "json_object" }
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

// Initialize secrets on module load
loadSecrets().catch(console.error);

module.exports = app;