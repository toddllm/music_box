// Music Box Song Generator Application
class MusicBoxApp {
    constructor() {
        this.apiBaseUrl = 'https://pd08901pf7.execute-api.us-east-1.amazonaws.com/prod';
        this.currentUser = this.loadUserProfile();
        this.currentSong = null;
        this.songs = this.loadSongs();
        this.audioPlayer = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateUserInterface();
        this.renderSongLibrary();
        this.loadMusicStyles();
    }

    setupEventListeners() {
        // Song form submission
        document.getElementById('songForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.generateSong();
        });

        // Character counter for prompt
        document.getElementById('songPrompt').addEventListener('input', (e) => {
            const charCount = e.target.value.length;
            document.getElementById('charCount').textContent = charCount;
            
            if (charCount > 550) {
                document.getElementById('charCount').style.color = 'var(--warning-color)';
            } else if (charCount > 600) {
                document.getElementById('charCount').style.color = 'var(--error-color)';
            } else {
                document.getElementById('charCount').style.color = 'var(--text-muted)';
            }
        });

        // Profile modal
        document.getElementById('profileBtn').addEventListener('click', () => {
            this.openProfileModal();
        });

        document.getElementById('closeProfileModal').addEventListener('click', () => {
            this.closeProfileModal();
        });

        document.getElementById('profileForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveUserProfile();
        });

        // Avatar selection
        document.querySelectorAll('.avatar-option').forEach(option => {
            option.addEventListener('click', (e) => {
                document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
                e.target.classList.add('selected');
            });
        });

        // Audio player controls
        this.setupAudioPlayerControls();

        // Song actions
        document.getElementById('saveBtn').addEventListener('click', () => {
            this.saveSong();
        });

        document.getElementById('downloadBtn').addEventListener('click', () => {
            this.downloadSong();
        });

        document.getElementById('shareBtn').addEventListener('click', () => {
            this.shareSong();
        });

        // Library controls
        document.getElementById('librarySearch').addEventListener('input', (e) => {
            this.filterSongs(e.target.value);
        });

        document.getElementById('librarySort').addEventListener('change', (e) => {
            this.sortSongs(e.target.value);
        });

        // Modal close on backdrop click
        document.getElementById('profileModal').addEventListener('click', (e) => {
            if (e.target.id === 'profileModal') {
                this.closeProfileModal();
            }
        });
    }

    setupAudioPlayerControls() {
        const audioPlayer = document.getElementById('audioPlayer');
        const playPauseBtn = document.getElementById('playPauseBtn');
        const progressBar = document.getElementById('progressBar');
        const volumeSlider = document.getElementById('volumeSlider');
        const currentTimeEl = document.getElementById('currentTime');
        const durationEl = document.getElementById('duration');

        this.audioPlayer = audioPlayer;

        // Play/Pause button
        playPauseBtn.addEventListener('click', () => {
            if (audioPlayer.paused) {
                audioPlayer.play();
                playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
            } else {
                audioPlayer.pause();
                playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            }
        });

        // Progress bar
        audioPlayer.addEventListener('timeupdate', () => {
            if (audioPlayer.duration) {
                const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
                progressBar.value = progress;
                currentTimeEl.textContent = this.formatTime(audioPlayer.currentTime);
            }
        });

        audioPlayer.addEventListener('loadedmetadata', () => {
            durationEl.textContent = this.formatTime(audioPlayer.duration);
        });

        progressBar.addEventListener('input', () => {
            const time = (progressBar.value / 100) * audioPlayer.duration;
            audioPlayer.currentTime = time;
        });

        // Volume control
        volumeSlider.addEventListener('input', () => {
            audioPlayer.volume = volumeSlider.value / 100;
        });

        // Set initial volume
        audioPlayer.volume = 0.5;

        // Audio ended
        audioPlayer.addEventListener('ended', () => {
            playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            progressBar.value = 0;
        });
    }

    async loadMusicStyles() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/styles`);
            const data = await response.json();
            
            if (data.success && data.styles) {
                this.updateStyleOptions(data.styles);
            }
        } catch (error) {
            console.error('Failed to load music styles:', error);
        }
    }

    updateStyleOptions(styles) {
        const styleSelect = document.getElementById('songStyle');
        const currentValue = styleSelect.value;
        
        // Clear existing options except the first one
        while (styleSelect.children.length > 1) {
            styleSelect.removeChild(styleSelect.lastChild);
        }
        
        // Add new options
        styles.forEach(style => {
            const option = document.createElement('option');
            option.value = style.id;
            option.textContent = `${style.name} - ${style.description}`;
            styleSelect.appendChild(option);
        });
        
        // Restore previous selection if it exists
        if (currentValue) {
            styleSelect.value = currentValue;
        }
    }

    async generateSong() {
        const form = document.getElementById('songForm');
        const generateBtn = document.getElementById('generateBtn');
        const statusDiv = document.getElementById('generationStatus');
        const audioSection = document.getElementById('audioPlayerSection');
        
        // Get form data
        const formData = new FormData(form);
        const prompt = document.getElementById('songPrompt').value.trim();
        const style = document.getElementById('songStyle').value;
        const duration = parseInt(document.getElementById('songDuration').value);
        const title = document.getElementById('songTitle').value.trim();
        
        if (!prompt || !style) {
            this.showToast('Please fill in all required fields', 'error');
            return;
        }

        // Show generation status
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        statusDiv.style.display = 'block';
        audioSection.style.display = 'none';
        
        this.animateProgressBar();

        try {
            const response = await fetch(`${this.apiBaseUrl}/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: prompt,
                    style: style,
                    duration: duration
                })
            });

            const result = await response.json();
            
            if (result.success && result.audioUrl) {
                this.currentSong = {
                    id: Date.now().toString(),
                    title: title || `Generated Song - ${new Date().toLocaleDateString()}`,
                    prompt: prompt,
                    style: style,
                    duration: duration,
                    audioUrl: result.audioUrl,
                    createdAt: result.generatedAt || new Date().toISOString(),
                    metadata: result.metadata
                };
                
                this.loadAudioPlayer(this.currentSong);
                this.showToast('Song generated successfully!', 'success');
                
                // Show audio player
                statusDiv.style.display = 'none';
                audioSection.style.display = 'block';
                
            } else {
                throw new Error(result.error || 'Generation failed');
            }
            
        } catch (error) {
            console.error('Song generation failed:', error);
            this.showToast(`Generation failed: ${error.message}`, 'error');
            statusDiv.style.display = 'none';
        } finally {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="fas fa-sparkles"></i> Generate Song';
        }
    }

    animateProgressBar() {
        const progressFill = document.getElementById('progressFill');
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 10;
            if (progress > 90) progress = 90;
            progressFill.style.width = `${progress}%`;
            
            if (document.getElementById('generationStatus').style.display === 'none') {
                clearInterval(interval);
                progressFill.style.width = '0%';
            }
        }, 500);
    }

    loadAudioPlayer(song) {
        const audioPlayer = document.getElementById('audioPlayer');
        audioPlayer.src = song.audioUrl;
        audioPlayer.load();
        
        // Reset play button
        document.getElementById('playPauseBtn').innerHTML = '<i class="fas fa-play"></i>';
        document.getElementById('progressBar').value = 0;
    }

    saveSong() {
        if (!this.currentSong) {
            this.showToast('No song to save', 'error');
            return;
        }

        // Check if already saved
        const existingSong = this.songs.find(s => s.audioUrl === this.currentSong.audioUrl);
        if (existingSong) {
            this.showToast('Song already saved to library', 'warning');
            return;
        }

        this.songs.unshift(this.currentSong);
        this.saveSongs();
        this.renderSongLibrary();
        this.showToast('Song saved to library!', 'success');
        
        // Update save button
        const saveBtn = document.getElementById('saveBtn');
        saveBtn.innerHTML = '<i class="fas fa-check"></i> Saved';
        saveBtn.disabled = true;
        setTimeout(() => {
            saveBtn.innerHTML = '<i class="fas fa-heart"></i> Save to Library';
            saveBtn.disabled = false;
        }, 2000);
    }

    downloadSong() {
        if (!this.currentSong || !this.currentSong.audioUrl) {
            this.showToast('No song to download', 'error');
            return;
        }

        const link = document.createElement('a');
        link.href = this.currentSong.audioUrl;
        link.download = `${this.currentSong.title}.mp3`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showToast('Download started', 'success');
    }

    shareSong() {
        if (!this.currentSong) {
            this.showToast('No song to share', 'error');
            return;
        }

        const shareData = {
            title: this.currentSong.title,
            text: `Check out this song I created: "${this.currentSong.prompt}"`,
            url: this.currentSong.audioUrl
        };

        if (navigator.share) {
            navigator.share(shareData).catch(console.error);
        } else {
            // Fallback: copy URL to clipboard
            navigator.clipboard.writeText(this.currentSong.audioUrl).then(() => {
                this.showToast('Song URL copied to clipboard', 'success');
            }).catch(() => {
                this.showToast('Unable to share song', 'error');
            });
        }
    }

    renderSongLibrary() {
        const songsGrid = document.getElementById('songsGrid');
        const emptyLibrary = document.getElementById('emptyLibrary');
        
        if (this.songs.length === 0) {
            songsGrid.style.display = 'none';
            emptyLibrary.style.display = 'block';
            return;
        }
        
        songsGrid.style.display = 'grid';
        emptyLibrary.style.display = 'none';
        
        songsGrid.innerHTML = this.songs.map(song => this.createSongCard(song)).join('');
        
        // Add event listeners to song cards
        this.songs.forEach(song => {
            const card = document.getElementById(`song-${song.id}`);
            if (card) {
                card.addEventListener('click', () => this.playSongFromLibrary(song));
                
                // Control buttons
                const deleteBtn = card.querySelector('.delete-btn');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.deleteSong(song.id);
                    });
                }
            }
        });
    }

    createSongCard(song) {
        const createdDate = new Date(song.createdAt).toLocaleDateString();
        const styleTag = song.style.charAt(0).toUpperCase() + song.style.slice(1);
        
        return `
            <div class="song-card" id="song-${song.id}">
                <div class="song-card-header">
                    <div>
                        <div class="song-title">${song.title}</div>
                        <div class="song-meta">${createdDate} • ${song.duration}s</div>
                    </div>
                    <div class="song-controls">
                        <button class="song-control-btn delete-btn" title="Delete song">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="song-description">${song.prompt}</div>
                <div class="song-tags">
                    <span class="song-tag">${styleTag}</span>
                </div>
            </div>
        `;
    }

    playSongFromLibrary(song) {
        this.currentSong = song;
        this.loadAudioPlayer(song);
        
        // Show audio player section
        document.getElementById('audioPlayerSection').style.display = 'block';
        
        // Scroll to audio player
        document.getElementById('audioPlayerSection').scrollIntoView({ 
            behavior: 'smooth' 
        });
        
        this.showToast(`Now playing: ${song.title}`, 'success');
    }

    deleteSong(songId) {
        if (confirm('Are you sure you want to delete this song?')) {
            this.songs = this.songs.filter(song => song.id !== songId);
            this.saveSongs();
            this.renderSongLibrary();
            this.showToast('Song deleted', 'success');
        }
    }

    filterSongs(searchTerm) {
        const cards = document.querySelectorAll('.song-card');
        const term = searchTerm.toLowerCase();
        
        cards.forEach(card => {
            const title = card.querySelector('.song-title').textContent.toLowerCase();
            const description = card.querySelector('.song-description').textContent.toLowerCase();
            
            if (title.includes(term) || description.includes(term)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    sortSongs(sortBy) {
        switch (sortBy) {
            case 'recent':
                this.songs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                break;
            case 'title':
                this.songs.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'style':
                this.songs.sort((a, b) => a.style.localeCompare(b.style));
                break;
            case 'duration':
                this.songs.sort((a, b) => b.duration - a.duration);
                break;
        }
        this.renderSongLibrary();
    }

    openProfileModal() {
        const modal = document.getElementById('profileModal');
        const nameInput = document.getElementById('profileName');
        const emailInput = document.getElementById('profileEmail');
        
        // Pre-fill form with current user data
        nameInput.value = this.currentUser.name || '';
        emailInput.value = this.currentUser.email || '';
        
        // Select current avatar
        document.querySelectorAll('.avatar-option').forEach(option => {
            option.classList.remove('selected');
            if (option.dataset.avatar === this.currentUser.avatar) {
                option.classList.add('selected');
            }
        });
        
        modal.classList.add('active');
    }

    closeProfileModal() {
        document.getElementById('profileModal').classList.remove('active');
    }

    saveUserProfile() {
        const name = document.getElementById('profileName').value.trim();
        const email = document.getElementById('profileEmail').value.trim();
        const selectedAvatar = document.querySelector('.avatar-option.selected');
        const avatar = selectedAvatar ? selectedAvatar.dataset.avatar : '🎵';
        
        if (!name) {
            this.showToast('Please enter a display name', 'error');
            return;
        }
        
        this.currentUser = {
            name: name,
            email: email,
            avatar: avatar,
            createdAt: this.currentUser.createdAt || new Date().toISOString()
        };
        
        this.saveUserData();
        this.updateUserInterface();
        this.closeProfileModal();
        this.showToast('Profile updated!', 'success');
    }

    updateUserInterface() {
        const userName = document.getElementById('userName');
        const profileBtn = document.getElementById('profileBtn');
        
        if (this.currentUser.name) {
            userName.textContent = this.currentUser.name;
            if (this.currentUser.avatar) {
                profileBtn.innerHTML = `${this.currentUser.avatar} <span id="userName">${this.currentUser.name}</span>`;
            }
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? 'check-circle' : 
                     type === 'error' ? 'exclamation-circle' : 
                     type === 'warning' ? 'exclamation-triangle' : 'info-circle';
        
        toast.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Remove after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => container.removeChild(toast), 300);
        }, 5000);
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Local Storage Methods
    loadUserProfile() {
        const userData = localStorage.getItem('musicbox_user');
        return userData ? JSON.parse(userData) : {
            name: 'Guest',
            avatar: '🎵',
            createdAt: new Date().toISOString()
        };
    }

    saveUserData() {
        localStorage.setItem('musicbox_user', JSON.stringify(this.currentUser));
    }

    loadSongs() {
        const songsData = localStorage.getItem('musicbox_songs');
        return songsData ? JSON.parse(songsData) : [];
    }

    saveSongs() {
        localStorage.setItem('musicbox_songs', JSON.stringify(this.songs));
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MusicBoxApp();
});