#!/usr/bin/env node

const { fal } = require('@fal-ai/client');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

// Reference voice URL (Zeldina from Sir Wiggleton)
const REFERENCE_VOICE_URL = 'https://v3.fal.media/files/monkey/C2_gjTrYLMk1hz9KF5vN2_output.wav';

async function getApiKey() {
  const client = new SecretsManagerClient({ region: 'us-east-1' });
  try {
    const command = new GetSecretValueCommand({ SecretId: 'music-box/fal-ai' });
    const response = await client.send(command);
    const secret = JSON.parse(response.SecretString);
    return secret.api_key;
  } catch (error) {
    console.error('Failed to get API key:', error.message);
    process.exit(1);
  }
}

function convertToTimestamps(lyrics, secondsPerLine = 4.5) {
  const lines = lyrics.split('\n').filter(line => line.trim() && !line.startsWith('['));
  let timestamp = 0;
  
  return lines.map(line => {
    const time = `${Math.floor(timestamp / 60).toString().padStart(2, '0')}:${(timestamp % 60).toFixed(2).padStart(5, '0')}`;
    const result = `[${time}]${line}`;
    timestamp += secondsPerLine;
    return result;
  }).join('\n');
}

async function testVoiceCloning() {
  console.log('🎤 Testing Voice Cloning with Zeldina Reference\n');
  console.log('Reference: Sir Wiggleton (Female voice)\n');
  
  // Test with Shoelace Romance
  const testLyrics = `[verse]
In a sneaker dark and deep
Where dirty socks do sometimes sleep
There lived a lace of brilliant white
Who dreamed of love both day and night

[chorus]
Tie me up, tie me down
I'm the loneliest lace in town
Through the eyelets I must go
But love's a thing I'll never know`;

  const timestampedLyrics = convertToTimestamps(testLyrics);
  
  try {
    console.log('1️⃣ Testing DiffRhythm WITH voice reference...');
    const startTime = Date.now();
    
    const resultWithRef = await fal.subscribe('fal-ai/diffrhythm', {
      input: {
        lyrics: timestampedLyrics,
        style_prompt: 'romantic ballad melancholy emotional, same female voice as reference',
        reference_audio_url: REFERENCE_VOICE_URL,
        music_duration: '95s'
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status !== 'IN_QUEUE') {
          console.log(`   Status: ${update.status}`);
        }
      }
    });
    
    const duration1 = Date.now() - startTime;
    console.log(`   ✅ Generated in ${(duration1 / 1000).toFixed(1)}s`);
    console.log(`   🎧 With Reference: ${resultWithRef.data?.audio?.url}\n`);
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('2️⃣ Testing DiffRhythm WITHOUT voice reference (for comparison)...');
    const startTime2 = Date.now();
    
    const resultWithoutRef = await fal.subscribe('fal-ai/diffrhythm', {
      input: {
        lyrics: timestampedLyrics,
        style_prompt: 'romantic ballad melancholy emotional female vocal',
        music_duration: '95s'
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status !== 'IN_QUEUE') {
          console.log(`   Status: ${update.status}`);
        }
      }
    });
    
    const duration2 = Date.now() - startTime2;
    console.log(`   ✅ Generated in ${(duration2 / 1000).toFixed(1)}s`);
    console.log(`   🎧 Without Reference: ${resultWithoutRef.data?.audio?.url}\n`);
    
    console.log('\n📊 RESULTS:');
    console.log('===========');
    console.log('🎯 With Zeldina Reference:', resultWithRef.data?.audio?.url);
    console.log('🎵 Without Reference:', resultWithoutRef.data?.audio?.url);
    console.log('\nListen to both and compare if the voice matches Zeldina from Sir Wiggleton!');
    
    // Save results
    const results = {
      testDate: new Date().toISOString(),
      referenceVoice: {
        name: 'Zeldina',
        url: REFERENCE_VOICE_URL,
        song: 'Sir Wiggleton'
      },
      testSong: 'Shoelace Romance',
      results: {
        withReference: {
          url: resultWithRef.data?.audio?.url,
          duration: duration1,
          requestId: resultWithRef.requestId
        },
        withoutReference: {
          url: resultWithoutRef.data?.audio?.url,
          duration: duration2,
          requestId: resultWithoutRef.requestId
        }
      }
    };
    
    require('fs').writeFileSync('voice-cloning-test-results.json', JSON.stringify(results, null, 2));
    console.log('\nResults saved to voice-cloning-test-results.json');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.body) console.error('Details:', error.body);
  }
}

async function main() {
  const apiKey = await getApiKey();
  fal.config({ credentials: apiKey });
  await testVoiceCloning();
}

main();