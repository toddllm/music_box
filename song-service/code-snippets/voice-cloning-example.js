/**
 * Voice Cloning Example - Music Box with Zeldina Voice
 * This example shows how to generate songs with consistent voice using DiffRhythm
 */

const { fal } = require('@fal-ai/client');

// Constants
const ZELDINA_VOICE_URL = 'https://v3.fal.media/files/monkey/C2_gjTrYLMk1hz9KF5vN2_output.wav';
const API_ENDPOINT = 'https://pd08901pf7.execute-api.us-east-1.amazonaws.com/prod/fal/test';

/**
 * Convert markdown lyrics to timestamped format required by DiffRhythm
 * @param {string} lyrics - Lyrics with [verse] and [chorus] markers
 * @param {number} secondsPerLine - Seconds between each line (default 4.5)
 * @returns {string} Timestamped lyrics in [mm:ss.xx] format
 */
function convertToTimestamps(lyrics, secondsPerLine = 4.5) {
  const lines = lyrics.split('\n')
    .filter(line => line.trim() && !line.match(/^\[(verse|chorus|outro|bridge)\]/));
  
  let timestamp = 0;
  return lines.map(line => {
    const mins = Math.floor(timestamp / 60).toString().padStart(2, '0');
    const secs = (timestamp % 60).toFixed(2).padStart(5, '0');
    const result = `[${mins}:${secs}]${line}`;
    timestamp += secondsPerLine;
    return result;
  }).join('\n');
}

/**
 * Generate a song with Zeldina's voice using direct Fal.ai API
 */
async function generateWithZeldinaVoice() {
  // Configure Fal.ai (use your API key)
  fal.config({ credentials: process.env.FAL_API_KEY });
  
  const exampleLyrics = `[verse]
In a world of code and wonder
Where the bits and bytes all thunder
There's a voice that sings so true
Zeldina's here to sing for you

[chorus]
Oh Zeldina, voice so bright
Singing through the digital night
Every song with perfect tone
Making Music Box our home`;

  const timestampedLyrics = convertToTimestamps(exampleLyrics);
  
  console.log('🎵 Generating song with Zeldina voice...');
  console.log('⏱️  Expected time: ~100 seconds\n');
  
  try {
    const startTime = Date.now();
    
    const result = await fal.subscribe('fal-ai/diffrhythm', {
      input: {
        lyrics: timestampedLyrics,
        style_prompt: 'epic orchestral ballad, theatrical female voice like reference',
        reference_audio_url: ZELDINA_VOICE_URL,
        music_duration: '95s'
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          process.stdout.write('.');
        } else if (update.status !== 'IN_QUEUE') {
          console.log(`\nStatus: ${update.status}`);
        }
      }
    });
    
    const duration = (Date.now() - startTime) / 1000;
    
    console.log(`\n✅ Generated in ${duration.toFixed(1)} seconds`);
    console.log(`🎧 Audio URL: ${result.data.audio.url}`);
    console.log(`📝 Request ID: ${result.requestId}`);
    
    return result.data.audio.url;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

/**
 * Generate a song using the Music Box API endpoint
 */
async function generateViaAPI() {
  const requestBody = {
    model: 'fal-ai/diffrhythm',
    lyrics: `[00:00.00]Welcome to the Music Box game
[00:04.50]Where silly songs are our claim to fame
[00:09.00]Zeldina's voice will guide you through
[00:13.50]Every single song for you`,
    genres: 'whimsical fun theatrical'
    // Note: refUrl is optional, Lambda uses Zeldina by default
  };
  
  console.log('🎵 Calling Music Box API...\n');
  
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Success!');
      console.log(`🎧 Audio URL: ${data.audioUrl}`);
      console.log(`⏱️  Generation time: ${(data.duration / 1000).toFixed(1)}s`);
      console.log(`🎤 Voice reference: Zeldina (default)`);
    } else {
      console.error('❌ API Error:', data.error);
    }
    
    return data;
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    throw error;
  }
}

/**
 * Batch generate multiple songs with Zeldina voice
 */
async function batchGenerateSongs() {
  const songs = [
    {
      title: 'The Dancing Donut',
      lyrics: `[verse]
Round and sweet with sprinkles bright
Dancing in the bakery light`,
      genres: 'fun bouncy cheerful'
    },
    {
      title: 'The Sleepy Sock',
      lyrics: `[verse]
In the drawer so dark and deep
Lives a sock that loves to sleep`,
      genres: 'lullaby gentle soothing'
    }
  ];
  
  console.log(`🎵 Batch generating ${songs.length} songs with Zeldina voice...\n`);
  
  const results = await Promise.all(
    songs.map(async (song, index) => {
      console.log(`${index + 1}. Starting "${song.title}"...`);
      
      const timestamped = convertToTimestamps(song.lyrics);
      
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'fal-ai/diffrhythm',
          lyrics: timestamped,
          genres: song.genres
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log(`✅ "${song.title}" completed!`);
        return { ...song, audioUrl: data.audioUrl };
      } else {
        console.error(`❌ "${song.title}" failed:`, data.error);
        return { ...song, error: data.error };
      }
    })
  );
  
  console.log('\n📊 Batch Results:');
  results.forEach(result => {
    if (result.audioUrl) {
      console.log(`✅ ${result.title}: ${result.audioUrl}`);
    } else {
      console.log(`❌ ${result.title}: ${result.error}`);
    }
  });
  
  return results;
}

// Example usage
if (require.main === module) {
  // Uncomment the example you want to run:
  
  // generateWithZeldinaVoice();
  // generateViaAPI();
  // batchGenerateSongs();
  
  console.log('Voice Cloning Examples:');
  console.log('1. generateWithZeldinaVoice() - Direct Fal.ai API');
  console.log('2. generateViaAPI() - Music Box Lambda endpoint');
  console.log('3. batchGenerateSongs() - Multiple songs in parallel');
}

module.exports = {
  convertToTimestamps,
  generateWithZeldinaVoice,
  generateViaAPI,
  batchGenerateSongs,
  ZELDINA_VOICE_URL
};