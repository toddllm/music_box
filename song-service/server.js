// Song Generation Service Server
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { SongGenerator } from './song-generator.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize song generator
const songGenerator = new SongGenerator();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Configure multer for file uploads (for reference audio)
const upload = multer({ 
  dest: '/tmp/uploads/',
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const health = await songGenerator.healthCheck();
    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

// Generate song endpoint
app.post('/api/generate-song', async (req, res) => {
  try {
    console.log('[Server] Song generation request:', req.body);

    const {
      prompt,
      style = 'pop',
      duration = 30,
      referenceAudioUrl = null
    } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required'
      });
    }

    const result = await songGenerator.generateSong({
      prompt,
      style,
      duration,
      referenceAudioUrl
    });

    console.log('[Server] Generation result:', result.success ? 'Success' : 'Failed');

    res.json(result);

  } catch (error) {
    console.error('[Server] Error generating song:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate song for game context
app.post('/api/generate-game-song', async (req, res) => {
  try {
    console.log('[Server] Game song generation request:', req.body);

    const gameContext = req.body;
    const result = await songGenerator.generateSongForGame(gameContext);

    console.log('[Server] Game song generation result:', result.success ? 'Success' : 'Failed');

    res.json(result);

  } catch (error) {
    console.error('[Server] Error generating game song:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Upload reference audio endpoint
app.post('/api/upload-reference', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file provided'
      });
    }

    // In a real implementation, you'd upload this to S3 or similar
    // For now, just return a placeholder URL
    const audioUrl = `https://placeholder.com/uploads/${req.file.filename}`;

    res.json({
      success: true,
      audioUrl,
      filename: req.file.originalname,
      size: req.file.size
    });

  } catch (error) {
    console.error('[Server] Error uploading reference audio:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get sample songs
app.get('/api/sample-songs', async (req, res) => {
  try {
    const samples = await songGenerator.getSampleSongs();
    res.json({
      success: true,
      songs: samples
    });
  } catch (error) {
    console.error('[Server] Error getting sample songs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// List available styles
app.get('/api/styles', (req, res) => {
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

  res.json({
    success: true,
    styles
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('[Server] Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`[Server] Song generation service listening on port ${PORT}`);
  
  // Initialize song generator on startup
  songGenerator.initialize().catch(error => {
    console.error('[Server] Failed to initialize song generator:', error);
  });
});