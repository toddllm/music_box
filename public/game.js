// WebSocket connection setup
let socket;
const WEBSOCKET_URL = 'wss://w4c66zvhz0.execute-api.us-east-1.amazonaws.com/production';

function initializeWebSocket() {
  socket = new WebSocket(WEBSOCKET_URL);
  
  socket.onopen = () => {
    console.log('WebSocket connected');
  };
  
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleWebSocketMessage(message.event, message.data);
  };
  
  socket.onclose = () => {
    console.log('WebSocket disconnected');
    setTimeout(initializeWebSocket, 3000); // Reconnect after 3 seconds
  };
  
  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

function sendWebSocketMessage(action, data) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ action, data }));
  }
}

function handleWebSocketMessage(event, data) {
  switch (event) {
    case 'player-joined':
      gameState.playerId = data.playerId;
      showScreen('lobby');
      updatePlayersList(data.players);
      break;
    case 'player-list-update':
      updatePlayersList(data);
      break;
    case 'game-full':
      alert('Game is full! Please try again later.');
      break;
    case 'not-enough-players':
      alert('Need at least 2 players to start the game!');
      break;
    case 'game-started':
      showScreen('game');
      updateGameDisplay(data);
      break;
    case 'next-turn':
      updateGameDisplay(data);
      break;
    case 'player-eliminated':
      showNotification(`${data.playerName} was eliminated! ${data.reason}`);
      updatePlayersStatus();
      break;
    case 'game-over':
      showScreen('gameOver');
      if (data.winner) {
        winnerDisplay.innerHTML = `🏆 ${data.winner.name} wins! 🏆`;
      } else {
        winnerDisplay.innerHTML = data.message || 'No winner!';
      }
      break;
    case 'not-your-turn':
      alert('It\'s not your turn!');
      break;
  }
}

// Initialize WebSocket connection
initializeWebSocket();
let gameState = {
    playerId: null,
    playerName: null,
    isRecording: false,
    mediaRecorder: null,
    audioChunks: [],
    audioContext: null,
    analyser: null
};

// Screen elements
const screens = {
    login: document.getElementById('login-screen'),
    lobby: document.getElementById('lobby-screen'),
    game: document.getElementById('game-screen'),
    gameOver: document.getElementById('game-over-screen')
};

// UI elements
const playerNameInput = document.getElementById('player-name');
const joinBtn = document.getElementById('join-btn');
const startGameBtn = document.getElementById('start-game-btn');
const recordBtn = document.getElementById('record-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const playersList = document.getElementById('players-list');
const gameStatus = document.getElementById('game-status');
const currentPlayerDisplay = document.getElementById('current-player-display');
const performanceArea = document.getElementById('performance-area');
const waitingArea = document.getElementById('waiting-area');
const recordingStatus = document.getElementById('recording-status');
const winnerDisplay = document.getElementById('winner-display');
const alivePlayers = document.getElementById('alive-players');
const eliminatedPlayers = document.getElementById('eliminated-players');

// Event listeners
joinBtn.addEventListener('click', joinGame);
playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinGame();
});
startGameBtn.addEventListener('click', () => sendWebSocketMessage('start-game', {}));
recordBtn.addEventListener('click', toggleRecording);
playAgainBtn.addEventListener('click', () => location.reload());

// WebSocket events are handled in handleWebSocketMessage function above

// Functions
function joinGame() {
    const name = playerNameInput.value.trim();
    if (name.length < 2) {
        alert('Please enter a name with at least 2 characters!');
        return;
    }
    gameState.playerName = name;
    sendWebSocketMessage('join-game', name);
}

function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
}

function updatePlayersList(players) {
    playersList.innerHTML = players.map(player => 
        `<div class="player-item ${player.id === gameState.playerId ? 'current' : ''}">${player.name}</div>`
    ).join('');
}

function updateGameDisplay(data) {
    gameStatus.textContent = `Round ${data.round}`;
    
    if (data.currentPlayer === gameState.playerId) {
        currentPlayerDisplay.textContent = 'Your turn to sing!';
        performanceArea.classList.remove('hidden');
        waitingArea.classList.add('hidden');
        startAudioVisualization();
    } else {
        currentPlayerDisplay.textContent = `Waiting for player's performance...`;
        performanceArea.classList.add('hidden');
        waitingArea.classList.remove('hidden');
    }
}

function updatePlayersStatus() {
    // Players status is automatically updated via WebSocket messages
}

async function toggleRecording() {
    if (!gameState.isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Use lower quality for smaller file size
            const options = {
                mimeType: 'audio/webm;codecs=opus',
                audioBitsPerSecond: 16000
            };
            
            gameState.mediaRecorder = new MediaRecorder(stream, options);
            gameState.audioChunks = [];

            gameState.mediaRecorder.ondataavailable = (event) => {
                gameState.audioChunks.push(event.data);
            };

            gameState.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(gameState.audioChunks, { type: 'audio/webm' });
                await submitPerformance(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            gameState.mediaRecorder.start();
            gameState.isRecording = true;
            recordBtn.textContent = '⏹️ Stop Recording';
            recordBtn.classList.add('recording');
            recordingStatus.textContent = 'Recording... Sing your heart out!';

            // Auto-stop after 30 seconds
            setTimeout(() => {
                if (gameState.isRecording) {
                    toggleRecording();
                }
            }, 30000);

        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Unable to access microphone. Please check your permissions.');
        }
    } else {
        gameState.mediaRecorder.stop();
        gameState.isRecording = false;
        recordBtn.textContent = '🎤 Start Recording';
        recordBtn.classList.remove('recording');
        recordingStatus.textContent = 'Processing your performance...';
    }
}

async function submitPerformance(audioBlob) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'performance.webm');

    try {
        const response = await fetch('/api/analyze-audio', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        
        if (result.hasLaughter) {
            showNotification(`Oh no! Laughter detected (${result.confidence}% confidence)! You're eliminated!`);
        } else {
            showNotification('Great performance! No laughter detected!');
        }

        sendWebSocketMessage('performance-result', { hasLaughter: result.hasLaughter });
        recordingStatus.textContent = '';

    } catch (error) {
        console.error('Error submitting performance:', error);
        alert('Failed to analyze performance. Please try again.');
    }
}

function startAudioVisualization() {
    if (!gameState.audioContext) {
        gameState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        gameState.analyser = gameState.audioContext.createAnalyser();
        gameState.analyser.fftSize = 256;
    }

    const visualizer = document.getElementById('audio-visualizer');
    visualizer.innerHTML = '';

    // Create visualization bars
    for (let i = 0; i < 32; i++) {
        const bar = document.createElement('div');
        bar.className = 'visualizer-bar';
        bar.style.height = '5px';
        visualizer.appendChild(bar);
    }
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        padding: 1rem 2rem;
        border-radius: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);