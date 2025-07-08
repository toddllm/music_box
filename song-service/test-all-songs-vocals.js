#!/usr/bin/env node

const fs = require('fs');

const API_URL = 'https://pd08901pf7.execute-api.us-east-1.amazonaws.com/prod/fal/test';

// Convert markdown lyrics to timestamped format
function convertToTimestamps(lyrics, secondsPerLine = 4.5) {
  const lines = lyrics.split('\n').filter(line => line.trim() && !line.startsWith('[verse]') && !line.startsWith('[chorus]') && !line.startsWith('[outro]'));
  let timestamp = 0;
  
  return lines.map(line => {
    const time = `${Math.floor(timestamp / 60).toString().padStart(2, '0')}:${(timestamp % 60).toFixed(2).padStart(5, '0')}`;
    const result = `[${time}]${line}`;
    timestamp += secondsPerLine;
    return result;
  }).join('\n');
}

const songs = [
  {
    id: 'spoon-ballad-vocals',
    title: 'The Epic Ballad of Sir Wiggleton (With Vocals)',
    genres: 'epic orchestral heroic male vocal anthem',
    lyricsMarkdown: `[verse]
In the kitchen of King Arthur's greatest knight
Lived a spoon of silver, shining bright
Sir Wiggleton was his noble name
Destined for culinary fame!

[chorus]
Oh Wiggleton, brave Wiggleton
Your handle gleams in morning sun
From cereal bowls to royal stew
There's no one quite as stirring as you!

[verse]
He stirred the soup with valor true
He mixed the batter, through and through
No bowl too deep, no pot too wide
Sir Wiggleton stirred with knightly pride!`
  },
  {
    id: 'shoelace-romance-vocals',
    title: 'The Tragic Romance of the Lonely Shoelace (With Vocals)',
    genres: 'romantic ballad melancholy female vocal emotional',
    lyricsMarkdown: `[verse]
In a sneaker dark and deep
Where dirty socks do sometimes sleep
There lived a lace of brilliant white
Who dreamed of love both day and night

[chorus]
Tie me up, tie me down
I'm the loneliest lace in town
Through the eyelets I must go
But love's a thing I'll never know`
  },
  {
    id: 'sandwich-mystery-vocals',
    title: 'The Mysterious Case of the Singing Sandwich (With Vocals)',
    genres: 'jazz noir mystery detective male vocal swing',
    lyricsMarkdown: `[verse]
It was a Tuesday, dark and cold
When the strangest tale was told
In Delilah's Deli down the street
Something happened most elite

[chorus]
Who made the sandwich sing?
What a most peculiar thing!
Bread and meat in harmony
Singing in sweet melody!`
  },
  {
    id: 'captain-tissue-vocals',
    title: 'The Incredible Journey of Captain Tissue (With Vocals)',
    genres: 'superhero march triumphant male vocal action epic',
    lyricsMarkdown: `[verse]
In a bathroom cabinet high
Where the cleaning supplies lie
Lived a tissue box so brave
Captain Tissue, soft and suave!

[chorus]
Soft and strong, white and true
Captain Tissue's there for you!
Pull one out, then pull some more
Comfort knocking at your door!`
  },
  {
    id: 'pumpkin-tummy-vocals',
    title: 'The Great Pumpkin\'s Tummy Symphony (With Vocals)',
    genres: 'whimsical bouncy magical children vocal fun',
    lyricsMarkdown: `[verse]
In the pumpkin patch so grand and wide
Lives a pumpkin with enormous pride
His tummy's big, his tummy's round
The biggest belly that can be found!

[chorus]
I believe! I believe!
In the pumpkin's tummy dream!
Bum bum bum tum tum tum!
Greatest tummy under sun!`
  }
];

async function testSong(song) {
  console.log(`\n🎵 Testing: ${song.title}`);
  console.log(`   Genres: ${song.genres}`);
  
  // Convert to timestamps
  const timestampedLyrics = convertToTimestamps(song.lyricsMarkdown);
  console.log(`   Timestamped lines: ${timestampedLyrics.split('\n').length}`);
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'fal-ai/diffrhythm',
        lyrics: timestampedLyrics,
        genres: song.genres
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data && data.success) {
      console.log(`   ✅ Success! Generated in ${(data.duration / 1000).toFixed(1)}s`);
      console.log(`   🎧 Audio: ${data.audioUrl}`);
      
      // Save result
      const result = {
        ...song,
        audioUrl: data.audioUrl,
        requestId: data.requestId,
        generatedAt: new Date().toISOString(),
        duration: data.duration,
        timestampedLyrics: timestampedLyrics
      };
      
      if (!fs.existsSync('vocal-test-results')) {
        fs.mkdirSync('vocal-test-results');
      }
      
      fs.writeFileSync(
        `vocal-test-results/${song.id}.json`, 
        JSON.stringify(result, null, 2)
      );
      
      return result;
    } else {
      console.log(`   ❌ Failed: ${data.error}`);
      return null;
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return null;
  }
}

async function generateReport(results) {
  const successful = results.filter(r => r !== null);
  
  const report = {
    testDate: new Date().toISOString(),
    totalSongs: songs.length,
    successful: successful.length,
    failed: songs.length - successful.length,
    averageTime: successful.length > 0 
      ? (successful.reduce((sum, r) => sum + r.duration, 0) / successful.length / 1000).toFixed(1)
      : 0,
    songs: successful
  };
  
  fs.writeFileSync('vocal-test-results/report.json', JSON.stringify(report, null, 2));
  
  console.log('\n\n📊 SMOKE TEST REPORT');
  console.log('===================');
  console.log(`Total Songs: ${report.totalSongs}`);
  console.log(`Successful: ${report.successful}`);
  console.log(`Failed: ${report.failed}`);
  console.log(`Average Time: ${report.averageTime}s`);
  console.log('\nResults saved in vocal-test-results/');
}

async function main() {
  console.log('🎮 Music Box Vocal Generation Smoke Test');
  console.log('Using DiffRhythm with Timestamped Lyrics');
  console.log('========================================\n');
  
  const results = [];
  
  // Test each song
  for (const song of songs) {
    const result = await testSong(song);
    results.push(result);
    
    // Wait 2 seconds between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Generate report
  await generateReport(results);
}

// Run if called directly
if (require.main === module) {
  main();
}