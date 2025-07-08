#!/usr/bin/env node

const fs = require('fs');

const API_URL = 'https://pd08901pf7.execute-api.us-east-1.amazonaws.com/prod/fal/test';
const songs = JSON.parse(fs.readFileSync('music-box-test-songs.json', 'utf8')).songs;

async function testSong(song) {
  console.log(`\n🎵 Testing: ${song.title}`);
  console.log(`   Genres: ${song.genres}`);
  console.log(`   Lyrics preview: ${song.lyrics.substring(0, 100)}...`);
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'fal-ai/diffrhythm',
        lyrics: song.lyrics,
        genres: song.genres
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log(`   ✅ Success! Generated in ${(data.duration / 1000).toFixed(1)}s`);
      console.log(`   🎧 Audio: ${data.audioUrl}`);
      
      // Save result
      fs.writeFileSync(
        `test-results/${song.id}.json`, 
        JSON.stringify({
          ...song,
          audioUrl: data.audioUrl,
          requestId: data.requestId,
          generatedAt: new Date().toISOString(),
          duration: data.duration
        }, null, 2)
      );
    } else {
      console.log(`   ❌ Failed: ${data.error}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
}

async function testAllSongs() {
  console.log('🎮 Music Box Songs Test Suite');
  console.log('============================');
  
  // Create results directory
  if (!fs.existsSync('test-results')) {
    fs.mkdirSync('test-results');
  }
  
  // Test each song with a delay between them
  for (const song of songs) {
    await testSong(song);
    // Wait 2 seconds between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n✨ All tests complete!');
  console.log('Results saved in test-results/ directory');
}

// If specific song ID provided, test just that one
const songId = process.argv[2];
if (songId) {
  const song = songs.find(s => s.id === songId);
  if (song) {
    testSong(song);
  } else {
    console.log(`Song ID not found: ${songId}`);
    console.log('Available IDs:', songs.map(s => s.id).join(', '));
  }
} else {
  testAllSongs();
}