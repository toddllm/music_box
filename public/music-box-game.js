// Music Box Game with Real Laughter Detection
// Uses the realtime WebSocket service for AI-powered laughter detection

class MusicBoxGame {
  constructor() {
    this.realtimeClient = null;
    this.gameState = {
      playerId: null,
      playerName: '',
      isPerforming: false,
      gameMode: 'single', // 'single' or 'multiplayer'
      performanceStartTime: null,
      laughterDetections: [],
      gameStatus: 'waiting' // 'waiting', 'performing', 'eliminated', 'won'
    };
    
    this.elements = {
      loginScreen: document.getElementById('login-screen'),
      lobbyScreen: document.getElementById('lobby-screen'),
      gameScreen: document.getElementById('game-screen'),
      playerName: document.getElementById('player-name'),
      joinBtn: document.getElementById('join-btn'),
      startGameBtn: document.getElementById('start-game-btn'),
      recordBtn: document.getElementById('record-btn'),
      gameStatus: document.getElementById('game-status'),
      recordingStatus: document.getElementById('recording-status'),
      performanceArea: document.getElementById('performance-area'),
      waitingArea: document.getElementById('waiting-area'),
      currentPlayerDisplay: document.getElementById('current-player-display'),
      alivePlayersDiv: document.getElementById('alive-players')
    };
    
    this.init();
  }

  init() {
    // Event listeners
    this.elements.joinBtn.addEventListener('click', () => this.joinGame());
    this.elements.startGameBtn.addEventListener('click', () => this.startGame());
    this.elements.recordBtn.addEventListener('click', () => this.togglePerformance());
    
    // Enter key for player name
    this.elements.playerName.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.joinGame();
    });
    
    // Add single player mode button
    this.addSinglePlayerButton();
  }

  addSinglePlayerButton() {
    const singlePlayerBtn = document.createElement('button');
    singlePlayerBtn.textContent = 'Single Player Practice';
    singlePlayerBtn.className = 'btn-secondary';
    singlePlayerBtn.style.marginTop = '10px';
    singlePlayerBtn.addEventListener('click', () => this.startSinglePlayerMode());
    this.elements.joinBtn.parentNode.appendChild(singlePlayerBtn);
  }

  showScreen(screenName) {
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.remove('active');
    });
    document.getElementById(`${screenName}-screen`).classList.add('active');
  }

  async joinGame() {
    const name = this.elements.playerName.value.trim();
    if (!name) {
      alert('Please enter your name');
      return;
    }
    
    this.gameState.playerName = name;
    this.gameState.playerId = `player-${Date.now()}`;
    
    // For now, just go to lobby (multiplayer will be implemented later)
    this.showScreen('lobby');
    this.elements.startGameBtn.textContent = 'Start Single Player Game';
    
    // Show only this player in lobby
    const playersList = document.getElementById('players-list');
    playersList.innerHTML = `<div class="player-item">${name} (You)</div>`;
  }

  startSinglePlayerMode() {
    const name = this.elements.playerName.value.trim();
    if (!name) {
      alert('Please enter your name');
      return;
    }
    
    this.gameState.playerName = name;
    this.gameState.playerId = `player-${Date.now()}`;
    this.gameState.gameMode = 'single';
    
    this.startGame();
  }

  async startGame() {
    this.showScreen('game');
    this.gameState.gameStatus = 'performing';
    
    // Initialize realtime client
    try {
      this.realtimeClient = new MusicBoxRealtimeClient(
        'wss://ws.softwarecompanyinabox.com/',
        (laughterData) => this.handleLaughterDetection(laughterData)
      );
      
      await this.realtimeClient.connect();
      console.log('[Game] Connected to laughter detection service');
      
      this.startPerformance();
    } catch (error) {
      console.error('[Game] Failed to connect to laughter detection:', error);
      this.elements.gameStatus.innerHTML = `
        <div class="error">Failed to connect to laughter detection service. Please try again.</div>
      `;
    }
  }

  startPerformance() {
    this.elements.performanceArea.classList.remove('hidden');
    this.elements.waitingArea.classList.add('hidden');
    
    this.elements.gameStatus.innerHTML = `
      <h2>🎤 Your Performance</h2>
      <p>Sing without laughing to win!</p>
      <div class="performance-timer">Time: <span id="timer">0:00</span></div>
    `;
    
    this.elements.currentPlayerDisplay.innerHTML = `
      <div class="current-player">
        <strong>${this.gameState.playerName}</strong> is performing
      </div>
    `;
    
    this.elements.recordingStatus.innerHTML = `
      <div class="status-ready">Ready to start! Click the microphone to begin.</div>
    `;
  }

  async togglePerformance() {
    if (!this.gameState.isPerforming) {
      // Start performance
      await this.startRecording();
    } else {
      // Stop performance
      this.stopRecording();
    }
  }

  async startRecording() {
    try {
      this.gameState.isPerforming = true;
      this.gameState.performanceStartTime = Date.now();
      this.gameState.laughterDetections = [];
      
      // Start realtime session
      await this.realtimeClient.startPerformance(this.gameState.playerId);
      
      // Update UI
      this.elements.recordBtn.textContent = '🛑 Stop Performance';
      this.elements.recordBtn.className = 'btn-stop';
      this.elements.recordingStatus.innerHTML = `
        <div class="status-recording">
          🎤 Recording... Sing without laughing!
          <div class="laughter-count">Laughter detections: <span id="laughter-count">0</span></div>
        </div>
      `;
      
      // Start timer
      this.startTimer();
      
      console.log('[Game] Performance started');
    } catch (error) {
      console.error('[Game] Failed to start recording:', error);
      this.elements.recordingStatus.innerHTML = `
        <div class="status-error">Failed to start recording. Please check microphone permissions.</div>
      `;
    }
  }

  stopRecording() {
    this.gameState.isPerforming = false;
    
    // Stop realtime session
    if (this.realtimeClient) {
      this.realtimeClient.endPerformance();
    }
    
    // Stop timer
    this.stopTimer();
    
    // Calculate performance results
    const performanceDuration = Date.now() - this.gameState.performanceStartTime;
    const laughterCount = this.gameState.laughterDetections.length;
    
    // Update UI
    this.elements.recordBtn.textContent = '🎤 Start New Performance';
    this.elements.recordBtn.className = 'btn-record';
    
    this.showPerformanceResults(performanceDuration, laughterCount);
  }

  showPerformanceResults(duration, laughterCount) {
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    let resultHTML = `
      <div class="performance-results">
        <h3>🎭 Performance Complete!</h3>
        <div class="result-stats">
          <div class="stat">
            <span class="stat-label">Duration:</span>
            <span class="stat-value">${timeStr}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Laughter Detected:</span>
            <span class="stat-value">${laughterCount} times</span>
          </div>
        </div>
    `;
    
    if (laughterCount === 0) {
      resultHTML += `
        <div class="result-success">
          🏆 Perfect! No laughter detected!
        </div>
      `;
    } else {
      resultHTML += `
        <div class="result-warning">
          😅 Oops! Laughter was detected ${laughterCount} time${laughterCount !== 1 ? 's' : ''}
        </div>
      `;
      
      // Show laughter details
      if (this.gameState.laughterDetections.length > 0) {
        resultHTML += '<div class="laughter-details"><h4>Laughter Detections:</h4><ul>';
        this.gameState.laughterDetections.forEach((detection, index) => {
          const timeFromStart = Math.floor((detection.timestamp - this.gameState.performanceStartTime) / 1000);
          resultHTML += `
            <li>
              ${timeFromStart}s: ${detection.laughterType} 
              (${Math.round(detection.confidence * 100)}% confidence, ${detection.intensity})
            </li>
          `;
        });
        resultHTML += '</ul></div>';
      }
    }
    
    resultHTML += `
        <button class="btn-primary" onclick="game.startNewGame()">Try Again</button>
      </div>
    `;
    
    this.elements.recordingStatus.innerHTML = resultHTML;
  }

  handleLaughterDetection(laughterData) {
    console.log('[Game] Laughter detected:', laughterData);
    
    // Add to detections list
    this.gameState.laughterDetections.push({
      ...laughterData,
      timestamp: Date.now()
    });
    
    // Update UI
    const countElement = document.getElementById('laughter-count');
    if (countElement) {
      countElement.textContent = this.gameState.laughterDetections.length;
    }
    
    // Show laughter notification
    this.showLaughterNotification(laughterData);
  }

  showLaughterNotification(laughterData) {
    const notification = document.createElement('div');
    notification.className = 'laughter-notification';
    notification.innerHTML = `
      <div class="notification-content">
        😂 Laughter Detected!
        <div class="detection-details">
          ${laughterData.laughterType} (${Math.round(laughterData.confidence * 100)}%)
        </div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      if (this.gameState.isPerforming && this.gameState.performanceStartTime) {
        const elapsed = Date.now() - this.gameState.performanceStartTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        const timerElement = document.getElementById('timer');
        if (timerElement) {
          timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  startNewGame() {
    // Reset game state
    this.gameState.laughterDetections = [];
    this.gameState.isPerforming = false;
    this.gameState.performanceStartTime = null;
    
    // Reset UI
    this.startPerformance();
  }

  disconnect() {
    if (this.realtimeClient) {
      this.realtimeClient.disconnect();
      this.realtimeClient = null;
    }
    this.stopTimer();
  }
}

// Initialize game when page loads
let game;
document.addEventListener('DOMContentLoaded', () => {
  game = new MusicBoxGame();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (game) {
    game.disconnect();
  }
});