// Karaoke Game Application
class KaraokeGame {
    constructor() {
        this.apiBaseUrl = 'https://pd08901pf7.execute-api.us-east-1.amazonaws.com/prod';
        this.currentPhase = 'songCreation';
        this.songData = null;
        this.lyricsData = null;
        this.musicPlayer = document.getElementById('musicPlayer');
        this.aiVoicePlayer = document.getElementById('aiVoicePlayer');
        this.currentVerseIndex = 0;
        this.currentLineIndex = 0;
        this.isPlaying = false;
        this.aiVocalsQueue = [];
        this.savedSongs = [];
        
        this.initializeEventListeners();
        // Load saved songs after a small delay to ensure DOM is ready
        setTimeout(() => this.loadSavedSongs(), 100);
    }
    
    initializeEventListeners() {
        // Form submission
        document.getElementById('karaokeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createKaraokeSong();
        });
        
        // Character counter
        document.getElementById('songTheme').addEventListener('input', (e) => {
            document.getElementById('themeCharCount').textContent = e.target.value.length;
        });
        
        // Game controls
        document.getElementById('playPauseBtn').addEventListener('click', () => this.togglePlayback());
        document.getElementById('restartBtn').addEventListener('click', () => this.restartSong());
        document.getElementById('playAgainBtn').addEventListener('click', () => this.resetGame());
        document.getElementById('replaySameBtn').addEventListener('click', () => this.replayCurrentSong());
        document.getElementById('backToMenu').addEventListener('click', () => {
            window.location.href = 'index.html';
        });
        
        // Volume controls
        document.getElementById('musicVolume').addEventListener('input', (e) => {
            this.musicPlayer.volume = e.target.value / 100;
        });
        
        document.getElementById('voiceVolume').addEventListener('input', (e) => {
            this.aiVoicePlayer.volume = e.target.value / 100;
        });
        
        // Music player events
        this.musicPlayer.addEventListener('timeupdate', () => this.updateLyrics());
        this.musicPlayer.addEventListener('ended', () => this.onSongEnd());
    }
    
    // Phase transitions
    showPhase(phaseName) {
        document.querySelectorAll('.game-phase').forEach(phase => {
            phase.classList.remove('active');
        });
        document.getElementById(`${phaseName}Phase`).classList.add('active');
        this.currentPhase = phaseName;
    }
    
    // Load saved songs from server
    async loadSavedSongs() {
        console.log('Loading saved songs from server...');
        try {
            // Add timestamp to bypass any caching
            const response = await fetch(`${this.apiBaseUrl}/karaoke/songs?t=${Date.now()}`);
            console.log('API Response status:', response.status);
            if (response.ok) {
                const data = await response.json();
                console.log('API Response data:', data);
                if (data.success && data.songs) {
                    this.savedSongs = data.songs;
                    console.log('Loaded songs:', this.savedSongs);
                    this.displaySavedSongs();
                }
            }
        } catch (error) {
            console.error('Failed to load saved songs:', error);
            // Fallback to localStorage if server fails
            const saved = localStorage.getItem('karaoke_saved_songs');
            this.savedSongs = saved ? JSON.parse(saved) : [];
            this.displaySavedSongs();
        }
    }
    
    // Display saved songs
    displaySavedSongs() {
        const grid = document.getElementById('savedSongsGrid');
        const noSongs = document.getElementById('noSavedSongs');
        
        console.log('Displaying saved songs:', this.savedSongs);
        console.log('Grid element:', grid);
        console.log('No songs element:', noSongs);
        
        if (this.savedSongs.length === 0) {
            grid.style.display = 'none';
            noSongs.style.display = 'block';
            return;
        }
        
        grid.style.display = 'grid';
        noSongs.style.display = 'none';
        
        const html = this.savedSongs.map((song) => {
            const title = this.escapeHtml(song.title || 'Untitled Song');
            const style = this.escapeHtml(song.style || 'unknown');
            const prompt = this.escapeHtml((song.prompt || '').substring(0, 150));
            const promptSuffix = song.prompt && song.prompt.length > 150 ? '...' : '';
            
            return `
                <div class="saved-song-card" data-id="${song.id}">
                    <div class="saved-song-title">${title}</div>
                    <div class="saved-song-details">
                        ${style} • ${song.duration}s • ${new Date(song.createdAt).toLocaleDateString()}
                    </div>
                    <div class="saved-song-theme">${prompt}${promptSuffix}</div>
                    <div class="saved-song-actions">
                        <button class="play-saved-btn" onclick="karaokeGame.playSavedSong('${song.id}')">
                            <i class="fas fa-play"></i> Play Again
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        console.log('Generated HTML:', html);
        grid.innerHTML = html;
    }
    
    // Play a saved song
    async playSavedSong(songId) {
        try {
            // Show loading state
            this.showPhase('loading');
            this.updateLoadingProgress(30);
            
            // Fetch full song data from server
            const response = await fetch(`${this.apiBaseUrl}/karaoke/songs/${songId}`);
            if (!response.ok) throw new Error('Failed to load song');
            
            const data = await response.json();
            if (!data.success || !data.song) throw new Error('Song not found');
            
            const song = data.song;
            this.updateLoadingProgress(60);
            
            this.songData = {
                musicUrl: song.musicUrl,
                lyrics: song.lyrics,
                aiVocals: song.aiVocals || [],
                prompt: song.prompt,
                style: song.style,
                duration: song.duration,
                id: song.id
            };
            this.lyricsData = song.lyrics;
            
            // Prepare AI vocals if they exist
            if (song.aiVocals && song.aiVocals.length > 0) {
                this.prepareAIVocals(song.aiVocals);
            }
            
            this.updateLoadingProgress(80);
            
            // Set song title
            document.getElementById('songTitle').textContent = this.lyricsData.title || `${song.style} Song`;
            document.getElementById('totalTime').textContent = this.formatTime(song.duration);
            
            // Load music
            this.musicPlayer.src = song.musicUrl;
            await this.waitForAudioLoad(this.musicPlayer);
            
            this.updateLoadingProgress(100);
            
            // Start performance
            setTimeout(() => {
                this.showPhase('performance');
                this.initializePerformance();
            }, 500);
            
        } catch (error) {
            console.error('Error loading saved song:', error);
            this.showToast('Failed to load song', 'error');
            this.showPhase('songCreation');
        }
    }
    
    
    // Create karaoke song
    async createKaraokeSong() {
        const theme = document.getElementById('songTheme').value;
        const style = document.getElementById('musicStyle').value;
        const duration = parseInt(document.getElementById('songLength').value);
        const playerName = document.getElementById('playerName').value;
        
        if (!theme || !style || !playerName) {
            this.showToast('Please fill in all fields', 'error');
            return;
        }
        
        this.showPhase('loading');
        this.updateLoadingProgress(0);
        
        try {
            // Step 1: Generate the song
            this.activateLoadingStep('step1');
            this.updateLoadingProgress(10);
            
            const response = await fetch(`${this.apiBaseUrl}/karaoke/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: theme, style, duration })
            });
            
            if (!response.ok) throw new Error('Failed to generate song');
            
            const data = await response.json();
            this.updateLoadingProgress(50);
            
            if (!data.success) throw new Error(data.error || 'Generation failed');
            
            // Step 2: Process lyrics
            this.activateLoadingStep('step2');
            this.updateLoadingProgress(70);
            
            this.songData = data;
            this.lyricsData = data.lyrics;
            
            // The song is now saved on the server with the returned ID
            if (data.id) {
                // Reload songs from server to show the new one
                this.loadSavedSongs();
            }
            
            // Step 3: Prepare AI vocals
            this.activateLoadingStep('step3');
            this.updateLoadingProgress(90);
            
            // Prepare AI vocal audio elements
            if (data.aiVocals && data.aiVocals.length > 0) {
                this.prepareAIVocals(data.aiVocals);
            }
            
            // Set song title
            document.getElementById('songTitle').textContent = this.lyricsData.title || `${style} Song`;
            document.getElementById('totalTime').textContent = this.formatTime(duration);
            
            // Load music
            this.musicPlayer.src = data.musicUrl;
            await this.waitForAudioLoad(this.musicPlayer);
            
            this.updateLoadingProgress(100);
            
            // Start performance after a short delay
            setTimeout(() => {
                this.showPhase('performance');
                this.initializePerformance();
            }, 500);
            
        } catch (error) {
            console.error('Error creating karaoke song:', error);
            this.showToast('Failed to create song. Please try again.', 'error');
            this.showPhase('songCreation');
        }
    }
    
    // Loading helpers
    activateLoadingStep(stepId) {
        document.querySelectorAll('.step').forEach(step => {
            step.classList.remove('active');
        });
        document.getElementById(stepId).classList.add('active');
    }
    
    updateLoadingProgress(percent) {
        document.getElementById('creationProgress').style.width = `${percent}%`;
    }
    
    // AI Vocal preparation
    prepareAIVocals(aiVocals) {
        this.aiVocalsQueue = aiVocals.map(vocal => ({
            ...vocal,
            audio: this.createAudioFromBase64(vocal.audio),
            played: false
        }));
    }
    
    createAudioFromBase64(base64Audio) {
        const audio = new Audio();
        audio.src = `data:audio/mpeg;base64,${base64Audio}`;
        audio.preload = 'auto';
        return audio;
    }
    
    // Performance initialization
    initializePerformance() {
        this.currentVerseIndex = 0;
        this.currentLineIndex = 0;
        this.displayInitialLyrics();
    }
    
    displayInitialLyrics() {
        if (this.lyricsData && this.lyricsData.verses.length > 0) {
            const firstVerse = this.lyricsData.verses[0];
            this.updateLyricsDisplay(firstVerse.lines[0], firstVerse.lines[1] || '');
            this.updateSingerIndicator(firstVerse.singer);
        }
    }
    
    // Playback controls
    togglePlayback() {
        if (this.isPlaying) {
            this.pauseSong();
        } else {
            this.playSong();
        }
    }
    
    async playSong() {
        try {
            await this.musicPlayer.play();
            this.isPlaying = true;
            document.querySelector('#playPauseBtn i').className = 'fas fa-pause';
        } catch (error) {
            console.error('Error playing song:', error);
            this.showToast('Failed to play song', 'error');
        }
    }
    
    pauseSong() {
        this.musicPlayer.pause();
        this.aiVoicePlayer.pause();
        this.isPlaying = false;
        document.querySelector('#playPauseBtn i').className = 'fas fa-play';
    }
    
    restartSong() {
        this.musicPlayer.currentTime = 0;
        this.aiVoicePlayer.pause();
        this.currentVerseIndex = 0;
        this.currentLineIndex = 0;
        
        // Reset AI vocals
        this.aiVocalsQueue.forEach(vocal => {
            vocal.played = false;
            if (vocal.audio) {
                vocal.audio.pause();
                vocal.audio.currentTime = 0;
            }
        });
        
        this.displayInitialLyrics();
        if (this.isPlaying) {
            this.playSong();
        }
    }
    
    // Lyrics synchronization
    updateLyrics() {
        const currentTime = this.musicPlayer.currentTime;
        document.getElementById('currentTime').textContent = this.formatTime(currentTime);
        
        if (!this.lyricsData || !this.lyricsData.verses) return;
        
        // Find current verse
        let currentVerse = null;
        let nextVerse = null;
        
        for (let i = 0; i < this.lyricsData.verses.length; i++) {
            const verse = this.lyricsData.verses[i];
            if (currentTime >= verse.startTime && currentTime < verse.startTime + verse.duration) {
                currentVerse = verse;
                nextVerse = this.lyricsData.verses[i + 1];
                break;
            }
        }
        
        if (currentVerse) {
            // Calculate which line we're on
            const verseProgress = (currentTime - currentVerse.startTime) / currentVerse.duration;
            const lineIndex = Math.floor(verseProgress * currentVerse.lines.length);
            
            if (lineIndex !== this.currentLineIndex || currentVerse !== this.currentVerse) {
                this.currentLineIndex = lineIndex;
                this.currentVerse = currentVerse;
                
                const currentLine = currentVerse.lines[lineIndex] || '';
                const nextLine = currentVerse.lines[lineIndex + 1] || 
                               (nextVerse ? nextVerse.lines[0] : 'End of song');
                
                this.updateLyricsDisplay(currentLine, nextLine);
                this.updateSingerIndicator(currentVerse.singer);
                
                // Play AI vocal if it's an AI verse
                if (currentVerse.singer === 'ai') {
                    this.playAIVocal(currentVerse);
                }
            }
        }
    }
    
    updateLyricsDisplay(currentLine, nextLine) {
        const currentLyricsEl = document.getElementById('currentLyrics');
        const upcomingLyricsEl = document.getElementById('upcomingLyrics');
        
        currentLyricsEl.innerHTML = `<p class="lyric-line active">${currentLine}</p>`;
        upcomingLyricsEl.innerHTML = `<p class="lyric-line">${nextLine}</p>`;
    }
    
    updateSingerIndicator(singer) {
        const playerSide = document.getElementById('playerSide');
        const aiSide = document.getElementById('aiSide');
        
        if (singer === 'player') {
            playerSide.classList.add('active');
            aiSide.classList.remove('active');
            document.getElementById('currentSinger').textContent = 'You';
        } else {
            aiSide.classList.add('active');
            playerSide.classList.remove('active');
            document.getElementById('currentSinger').textContent = 'AI Singer';
        }
    }
    
    playAIVocal(verse) {
        const vocalData = this.aiVocalsQueue.find(
            v => v.verseId === `${verse.type}_${verse.number}` && !v.played
        );
        
        if (vocalData && vocalData.audio) {
            vocalData.audio.volume = this.aiVoicePlayer.volume;
            vocalData.audio.play().catch(error => {
                console.error('Error playing AI vocal:', error);
            });
            vocalData.played = true;
        }
    }
    
    // Song end handling
    onSongEnd() {
        this.isPlaying = false;
        document.querySelector('#playPauseBtn i').className = 'fas fa-play';
        this.showPhase('results');
        this.displayResults();
    }
    
    displayResults() {
        document.getElementById('performanceRating').textContent = 'Amazing Performance!';
        document.getElementById('songCreated').textContent = this.lyricsData?.title || 'Your Song';
    }
    
    // Replay current song
    replayCurrentSong() {
        if (!this.songData || !this.lyricsData) {
            this.showToast('No song to replay', 'error');
            return;
        }
        
        // Reset playback state
        this.currentVerseIndex = 0;
        this.currentLineIndex = 0;
        this.isPlaying = false;
        
        // Reset AI vocals
        if (this.songData.aiVocals && this.songData.aiVocals.length > 0) {
            this.prepareAIVocals(this.songData.aiVocals);
        }
        
        // Reset music player
        this.musicPlayer.currentTime = 0;
        this.aiVoicePlayer.pause();
        
        // Go back to performance phase
        this.showPhase('performance');
        this.initializePerformance();
    }
    
    // Reset game
    resetGame() {
        this.songData = null;
        this.lyricsData = null;
        this.currentVerseIndex = 0;
        this.currentLineIndex = 0;
        this.aiVocalsQueue = [];
        
        document.getElementById('karaokeForm').reset();
        document.getElementById('themeCharCount').textContent = '0';
        
        this.showPhase('songCreation');
    }
    
    // Utility functions
    waitForAudioLoad(audio) {
        return new Promise((resolve, reject) => {
            if (audio.readyState >= 3) {
                resolve();
            } else {
                audio.addEventListener('canplaythrough', resolve, { once: true });
                audio.addEventListener('error', reject, { once: true });
            }
        });
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.getElementById('toastContainer').appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.karaokeGame = new KaraokeGame();
});