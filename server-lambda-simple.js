const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const OpenAI = require('openai');
const fs = require('fs');
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

// Simple analyze endpoint
app.post('/api/analyze-audio-simple', upload.single('audio'), async (req, res) => {
  try {
    if (!openai) {
      await loadSecrets();
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const audioPath = req.file.path;
    
    // Use form-data approach
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', fs.createReadStream(audioPath), {
      filename: req.file.originalname || 'audio.mp3',
      contentType: req.file.mimetype || 'audio/mpeg'
    });
    form.append('model', 'whisper-1');
    form.append('response_format', 'json');

    // Make direct API call
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openai.apiKey}`,
        ...form.getHeaders()
      },
      body: form
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      return res.status(response.status).json({ error: 'Transcription failed', details: error });
    }

    const transcription = await response.json();
    
    // Clean up
    fs.unlinkSync(audioPath);

    res.json({
      transcription: transcription.text,
      success: true
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Initialize secrets on module load
loadSecrets().catch(console.error);

module.exports = app;