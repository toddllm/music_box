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

async function testYuECorrectly() {
  console.log('🎵 Testing YuE with CORRECT format...\n');
  
  // YuE REQUIRES genres AND verse/chorus structure
  const input = {
    lyrics: `[verse]
In the kitchen of King Arthur's greatest knight
Lived a spoon of silver, shining bright
Sir Wiggleton was his noble name
Destined for culinary fame!

[chorus]
Oh Wiggleton, brave Wiggleton
Your handle gleams in morning sun
From cereal bowls to royal stew
There's no one quite as stirring as you!`,
    genres: 'epic orchestral heroic male vocal' // REQUIRED - space separated
  };

  console.log('Input:', JSON.stringify(input, null, 2));
  
  try {
    console.log('\nStarting YuE request...');
    const startTime = Date.now();
    
    const result = await fal.subscribe('fal-ai/yue', {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        console.log(`Queue: ${update.status} @ position ${update.queue_position || 'processing'}`);
      }
    });
    
    const duration = Date.now() - startTime;
    console.log(`\n✅ YuE completed in ${(duration / 1000).toFixed(1)}s`);
    
    const audioUrl = result.data?.audio?.url || result.data?.audio_file?.url || result.data?.output_url;
    console.log('Audio URL:', audioUrl);
    
    return audioUrl;
  } catch (error) {
    console.error('❌ YuE Error:', error.message);
    if (error.body) console.error('Details:', error.body);
    return null;
  }
}

async function testDiffRhythmCorrectly() {
  console.log('\n\n🎵 Testing DiffRhythm with TIMESTAMPED lyrics...\n');
  
  // DiffRhythm REQUIRES timestamps for vocals
  const input = {
    lyrics: `[00:00.00]In the kitchen of King Arthur's greatest knight
[00:04.50]Lived a spoon of silver, shining bright
[00:09.00]Sir Wiggleton was his noble name
[00:13.50]Destined for culinary fame!
[00:18.00]Oh Wiggleton, brave Wiggleton
[00:22.50]Your handle gleams in morning sun
[00:27.00]From cereal bowls to royal stew
[00:31.50]There's no one quite as stirring as you!`,
    style_prompt: 'epic orchestral ballad with clear male vocals',
    music_duration: '35s' // Optional
  };

  console.log('Input:', JSON.stringify(input, null, 2));
  
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
    console.log(`\n✅ DiffRhythm completed in ${(duration / 1000).toFixed(1)}s`);
    
    const audioUrl = result.data?.audio?.url || result.data?.audio_file?.url;
    console.log('Audio URL:', audioUrl);
    
    return audioUrl;
  } catch (error) {
    console.error('❌ DiffRhythm Error:', error.message);
    if (error.body) console.error('Details:', error.body);
    return null;
  }
}

async function compareResults() {
  console.log('🎮 Fal.ai Vocal Generation Test - CORRECT FORMATS');
  console.log('==============================================\n');
  
  const apiKey = await getApiKey();
  fal.config({ credentials: apiKey });
  
  // Test YuE
  const yueUrl = await testYuECorrectly();
  
  // Test DiffRhythm  
  const diffUrl = await testDiffRhythmCorrectly();
  
  console.log('\n\n📊 RESULTS SUMMARY');
  console.log('==================');
  
  if (yueUrl) {
    console.log('\n✅ YuE Success:');
    console.log('   Audio:', yueUrl);
    console.log('   Key: Space-separated genres + [verse]/[chorus] structure');
  } else {
    console.log('\n❌ YuE Failed - likely still in queue or missing requirements');
  }
  
  if (diffUrl) {
    console.log('\n✅ DiffRhythm Success:');
    console.log('   Audio:', diffUrl);
    console.log('   Key: Timestamped lyrics [mm:ss.xx] format');
  } else {
    console.log('\n❌ DiffRhythm Failed');
  }
  
  console.log('\n💡 TIPS:');
  console.log('- YuE: MUST have genres (space-separated) AND [verse]/[chorus]');
  console.log('- DiffRhythm: MUST have timestamps for vocals, otherwise instrumental only');
  console.log('- ACE-Step: For adding vocals to existing instrumentals');
}

// Run comparison
compareResults();