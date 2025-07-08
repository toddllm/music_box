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
  console.log('🎵 Testing DiffRhythm with proper lyrics formatting...\n');
  
  // Try with timestamps for better vocal alignment
  const lyricsWithTimestamps = `[00:00] In the kitchen of King Arthur's greatest knight
[00:04] Lived a spoon of silver, shining bright
[00:08] Sir Wiggleton was his noble name
[00:12] Destined for culinary fame!

[00:16] Oh Wiggleton, brave Wiggleton
[00:20] Your handle gleams in morning sun
[00:24] From cereal bowls to royal stew
[00:28] There's no one quite as stirring as you!`;

  // Also try without timestamps
  const lyricsMarkdown = `[verse]
In the kitchen of King Arthur's greatest knight
Lived a spoon of silver, shining bright
Sir Wiggleton was his noble name
Destined for culinary fame!

[chorus]
Oh Wiggleton, brave Wiggleton
Your handle gleams in morning sun
From cereal bowls to royal stew
There's no one quite as stirring as you!`;

  try {
    console.log('Test 1: With timestamps...');
    let startTime = Date.now();
    
    const result1 = await fal.subscribe('fal-ai/diffrhythm', {
      input: {
        lyrics: lyricsWithTimestamps,
        style_prompt: 'epic orchestral ballad with clear vocals, heroic anthem'
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status !== 'IN_QUEUE') {
          console.log('Status:', update.status);
        }
      }
    });
    
    console.log(`✅ Generated in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    console.log('Audio URL:', result1.data?.audio?.url || result1.data?.output_url);
    
    console.log('\nTest 2: With markdown structure...');
    startTime = Date.now();
    
    const result2 = await fal.subscribe('fal-ai/diffrhythm', {
      input: {
        lyrics: lyricsMarkdown,
        style_prompt: 'epic ballad with strong lead vocals, orchestral, heroic'
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status !== 'IN_QUEUE') {
          console.log('Status:', update.status);
        }
      }
    });
    
    console.log(`✅ Generated in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    console.log('Audio URL:', result2.data?.audio?.url || result2.data?.output_url);
    
    // Try with more vocal-focused style prompts
    console.log('\nTest 3: Vocal-focused style...');
    startTime = Date.now();
    
    const result3 = await fal.subscribe('fal-ai/diffrhythm', {
      input: {
        lyrics: lyricsMarkdown,
        style_prompt: 'vocal-forward pop ballad, clear lead singer, minimal instruments'
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status !== 'IN_QUEUE') {
          console.log('Status:', update.status);
        }
      }
    });
    
    console.log(`✅ Generated in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    console.log('Audio URL:', result3.data?.audio?.url || result3.data?.output_url);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.body) {
      console.error('Details:', error.body);
    }
  }
}

async function main() {
  const apiKey = await getApiKey();
  fal.config({ credentials: apiKey });
  await testDiffRhythmWithTimestamps();
}

main();