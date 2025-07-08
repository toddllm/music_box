#!/usr/bin/env node

/**
 * Convert pre-generated songs with Zeldina vocals into karaoke format
 * with turn-taking between player and AI
 */

const fs = require('fs');

// Load the vocal test results
const vocalReport = JSON.parse(fs.readFileSync('vocal-test-results/report.json', 'utf8'));

/**
 * Parse timestamped lyrics into lines with timing
 */
function parseTimestampedLyrics(timestampedLyrics) {
  const lines = timestampedLyrics.split('\n');
  const parsed = [];
  
  lines.forEach(line => {
    const match = line.match(/^\[(\d{2}):(\d{2}\.\d{2})\](.+)$/);
    if (match) {
      const minutes = parseInt(match[1]);
      const seconds = parseFloat(match[2]);
      const time = minutes * 60 + seconds;
      const text = match[3].trim();
      parsed.push({ time, text });
    }
  });
  
  return parsed;
}

/**
 * Convert a song into karaoke format with turn-taking
 */
function convertToKaraokeFormat(song) {
  const parsedLyrics = parseTimestampedLyrics(song.timestampedLyrics);
  const verses = [];
  
  // Group lines into verses (4 lines each) and assign singers
  let currentVerse = null;
  let lineCount = 0;
  let verseCount = 0;
  let isChorus = false;
  
  parsedLyrics.forEach((line, index) => {
    // Check if this is a chorus based on content
    const lowerText = line.text.toLowerCase();
    const wasChorus = isChorus;
    isChorus = lowerText.includes('oh wiggleton') || 
               lowerText.includes('tie me up') || 
               lowerText.includes('who made the sandwich') ||
               lowerText.includes('soft and strong') ||
               lowerText.includes('i believe');
    
    // Start new verse if needed
    if (!currentVerse || lineCount >= 4 || isChorus !== wasChorus) {
      if (currentVerse) {
        verses.push(currentVerse);
      }
      
      verseCount++;
      currentVerse = {
        type: isChorus ? 'chorus' : 'verse',
        number: isChorus ? Math.ceil(verseCount / 2) : verseCount,
        singer: verseCount % 2 === 1 ? 'player' : 'ai', // Alternate singers
        lines: [],
        startTime: line.time,
        duration: 0
      };
      lineCount = 0;
    }
    
    currentVerse.lines.push(line.text);
    lineCount++;
    
    // Update duration
    if (index < parsedLyrics.length - 1) {
      const nextTime = parsedLyrics[index + 1].time;
      currentVerse.duration = Math.max(currentVerse.duration, nextTime - currentVerse.startTime);
    } else {
      // Last line - estimate duration
      currentVerse.duration = Math.max(currentVerse.duration, 4.5);
    }
  });
  
  // Add last verse
  if (currentVerse) {
    verses.push(currentVerse);
  }
  
  // Create karaoke format
  return {
    id: song.id,
    title: song.title,
    genres: song.genres,
    musicUrl: song.audioUrl,
    aiVoiceUrl: song.audioUrl, // Using Zeldina voice for AI parts
    lyrics: {
      title: song.title,
      verses: verses,
      totalDuration: Math.ceil(verses[verses.length - 1].startTime + verses[verses.length - 1].duration)
    },
    prompt: song.title,
    style: song.genres.split(' ')[0],
    duration: Math.ceil(song.duration / 1000),
    generatedAt: song.generatedAt,
    hasVocals: true,
    voiceReference: 'Zeldina'
  };
}

/**
 * Save karaoke songs to database format
 */
function saveKaraokeSongs(songs) {
  const karaokeSongs = songs.map(song => convertToKaraokeFormat(song));
  
  // Save individual files
  if (!fs.existsSync('karaoke-songs')) {
    fs.mkdirSync('karaoke-songs');
  }
  
  karaokeSongs.forEach(song => {
    fs.writeFileSync(
      `karaoke-songs/${song.id}.json`,
      JSON.stringify(song, null, 2)
    );
  });
  
  // Save catalog
  const catalog = {
    generatedAt: new Date().toISOString(),
    totalSongs: karaokeSongs.length,
    voiceReference: 'Zeldina',
    songs: karaokeSongs.map(s => ({
      id: s.id,
      title: s.title,
      genres: s.genres,
      duration: s.duration,
      musicUrl: s.musicUrl,
      hasVocals: true
    }))
  };
  
  fs.writeFileSync('karaoke-songs/catalog.json', JSON.stringify(catalog, null, 2));
  
  // Create HTML snippet for embedding
  const htmlSnippet = karaokeSongs.map(song => `
    <div class="saved-song-card" data-song='${JSON.stringify({
      id: song.id,
      title: song.title,
      musicUrl: song.musicUrl,
      lyrics: song.lyrics,
      aiVoiceUrl: song.aiVoiceUrl
    })}'>
        <h4>${song.title}</h4>
        <p class="song-info">${song.genres} • ${song.duration}s • With Vocals</p>
        <button class="play-saved-btn" onclick="playSavedSong(this)">
            <i class="fas fa-play"></i> Play
        </button>
    </div>
  `).join('\n');
  
  fs.writeFileSync('karaoke-songs/songs-html.txt', htmlSnippet);
  
  return karaokeSongs;
}

// Main execution
console.log('🎵 Converting vocal songs to karaoke format...\n');

const karaokeSongs = saveKaraokeSongs(vocalReport.songs);

console.log('✅ Conversion complete!\n');
console.log('📁 Files created:');
console.log('   - karaoke-songs/*.json (individual song files)');
console.log('   - karaoke-songs/catalog.json (song catalog)');
console.log('   - karaoke-songs/songs-html.txt (HTML snippet)');
console.log('\n📊 Summary:');
karaokeSongs.forEach((song, index) => {
  const playerVerses = song.lyrics.verses.filter(v => v.singer === 'player').length;
  const aiVerses = song.lyrics.verses.filter(v => v.singer === 'ai').length;
  console.log(`${index + 1}. ${song.title}`);
  console.log(`   Player parts: ${playerVerses}, AI parts: ${aiVerses}`);
});

console.log('\n💡 Next steps:');
console.log('1. Upload song files to DynamoDB');
console.log('2. Update karaoke-app.js to load these songs');
console.log('3. Test turn-taking between player and AI');