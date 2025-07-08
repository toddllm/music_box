const { fal } = require('@fal-ai/client');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

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

async function testDiffRhythmWithTimestamps() {
  console.log('🎵 Testing DiffRhythm with PROPER TIMESTAMPS for vocals...\n');
  
  // Convert spoon ballad to timestamped format
  const timestampedLyrics = `[00:00.00]In the kitchen of King Arthur's greatest knight
[00:04.50]Lived a spoon of silver, shining bright
[00:09.00]Sir Wiggleton was his noble name
[00:13.50]Destined for culinary fame!
[00:18.00]Oh Wiggleton, brave Wiggleton
[00:22.50]Your handle gleams in morning sun
[00:27.00]From cereal bowls to royal stew
[00:31.50]There's no one quite as stirring as you!
[00:36.00]He stirred the soup with valor true
[00:40.50]He mixed the batter, through and through
[00:45.00]No bowl too deep, no pot too wide
[00:49.50]Sir Wiggleton stirred with knightly pride!`;

  const input = {
    lyrics: timestampedLyrics,
    style_prompt: 'epic orchestral ballad with clear male vocals heroic anthem',
    music_duration: '95s' // Only '95s' or '285s' are allowed
  };

  console.log('Timestamped Lyrics:', input.lyrics);
  console.log('\nStyle:', input.style_prompt);
  
  try {
    console.log('\nStarting DiffRhythm request...');
    const startTime = Date.now();
    
    const result = await fal.subscribe('fal-ai/diffrhythm', {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status !== 'IN_QUEUE') {
          console.log(`Status: ${update.status}`);
        }
      }
    });
    
    const duration = Date.now() - startTime;
    console.log(`\n✅ Generated in ${(duration / 1000).toFixed(1)}s`);
    
    const audioUrl = result.data?.audio?.url;
    console.log('Audio URL:', audioUrl);
    console.log('Request ID:', result.requestId);
    
    return { audioUrl, requestId: result.requestId, duration };
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.body) console.error('Details:', error.body);
    return null;
  }
}

async function main() {
  const apiKey = await getApiKey();
  fal.config({ credentials: apiKey });
  
  const result = await testDiffRhythmWithTimestamps();
  
  if (result) {
    console.log('\n🎧 RESULT:');
    console.log('Listen to the song with vocals at:');
    console.log(result.audioUrl);
    console.log('\nKey insight: DiffRhythm REQUIRES timestamps for vocals!');
    console.log('Without timestamps = instrumental only');
    console.log('With timestamps = full vocals');
  }
}

main();