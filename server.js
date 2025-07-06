require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const session = require('express-session');
const multer = require('multer');
const { OpenAI } = require('openai');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'default-secret',
  resave: false,
  saveUninitialized: true
}));

// Game state
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

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log('New player connected:', socket.id);

  socket.on('join-game', (playerName) => {
    if (gameState.players.size >= (process.env.MAX_PLAYERS || 10)) {
      socket.emit('game-full');
      return;
    }

    gameState.players.set(socket.id, {
      id: socket.id,
      name: playerName,
      isAlive: true,
      score: 0
    });

    socket.emit('player-joined', {
      playerId: socket.id,
      players: Array.from(gameState.players.values())
    });

    io.emit('player-list-update', Array.from(gameState.players.values()));
  });

  socket.on('start-game', () => {
    if (gameState.players.size < 2) {
      socket.emit('not-enough-players');
      return;
    }

    gameState.isGameActive = true;
    gameState.round = 1;
    gameState.eliminatedPlayers.clear();
    
    // Reset all players
    gameState.players.forEach(player => {
      player.isAlive = true;
    });

    selectNextPlayer();
    io.emit('game-started', {
      currentPlayer: gameState.currentPlayer,
      round: gameState.round
    });
  });

  socket.on('submit-performance', async (audioData) => {
    if (socket.id !== gameState.currentPlayer) {
      socket.emit('not-your-turn');
      return;
    }

    // Process will be handled by the API endpoint
    // This is just to track turn completion
    socket.emit('performance-received');
  });

  socket.on('performance-result', ({ hasLaughter }) => {
    const player = gameState.players.get(socket.id);
    
    if (hasLaughter && player) {
      player.isAlive = false;
      gameState.eliminatedPlayers.add(socket.id);
      
      io.emit('player-eliminated', {
        playerId: socket.id,
        playerName: player.name,
        reason: 'Laughed during performance!'
      });
    }

    // Check win condition
    const alivePlayers = Array.from(gameState.players.values()).filter(p => p.isAlive);
    
    if (alivePlayers.length === 1) {
      io.emit('game-over', {
        winner: alivePlayers[0]
      });
      gameState.isGameActive = false;
    } else if (alivePlayers.length === 0) {
      io.emit('game-over', {
        winner: null,
        message: 'Everyone was eliminated!'
      });
      gameState.isGameActive = false;
    } else {
      selectNextPlayer();
      io.emit('next-turn', {
        currentPlayer: gameState.currentPlayer,
        round: gameState.round
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    gameState.players.delete(socket.id);
    
    if (socket.id === gameState.currentPlayer && gameState.isGameActive) {
      selectNextPlayer();
      io.emit('next-turn', {
        currentPlayer: gameState.currentPlayer,
        round: gameState.round
      });
    }
    
    io.emit('player-list-update', Array.from(gameState.players.values()));
  });
});

function selectNextPlayer() {
  const alivePlayers = Array.from(gameState.players.values()).filter(p => p.isAlive);
  
  if (alivePlayers.length === 0) {
    gameState.currentPlayer = null;
    return;
  }

  // Find current player index
  let currentIndex = alivePlayers.findIndex(p => p.id === gameState.currentPlayer);
  
  // Move to next player
  currentIndex = (currentIndex + 1) % alivePlayers.length;
  
  // If we've cycled through all players, increment round
  if (currentIndex === 0) {
    gameState.round++;
  }
  
  gameState.currentPlayer = alivePlayers[currentIndex].id;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Music Box game server running on port ${PORT}`);
});