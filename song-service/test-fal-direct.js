const { fal } = require('@fal-ai/client');

// Set your API key
fal.config({ 
  credentials: process.env.FAL_KEY || 'YOUR_FAL_KEY_HERE'
});

async function testYuE() {
  console.log('🎵 Testing YuE model for better vocals...\n');
  
  const lyrics = `[verse]
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
    console.log('Starting YuE request...');
    const startTime = Date.now();
    
    const result = await fal.subscribe('fal-ai/yue', {
      input: {
        lyrics: lyrics,
        genres: 'epic, orchestral, heroic'  // YuE uses genres parameter
      },
      logs: true,
      onQueueUpdate: (update) => {
        console.log('Queue update:', {
          status: update.status,
          queue_position: update.queue_position
        });
      }
    });
    
    const duration = Date.now() - startTime;
    console.log(`\n✅ Generation completed in ${(duration / 1000).toFixed(1)} seconds`);
    
    // Extract audio URL
    let audioUrl;
    if (result.data?.audio?.url) {
      audioUrl = result.data.audio.url;
    } else if (result.data?.audio_file?.url) {
      audioUrl = result.data.audio_file.url;
    } else if (result.data?.output_url) {
      audioUrl = result.data.output_url;
    }
    
    console.log('Audio URL:', audioUrl);
    console.log('Full result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.body) {
      console.error('Error details:', error.body);
    }
  }
}

// Get API key from secrets
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

async function getApiKey() {
  const client = new SecretsManagerClient({ region: 'us-east-1' });
  try {
    const command = new GetSecretValueCommand({ SecretId: 'music-box/fal-ai' });
    const response = await client.send(command);
    const secret = JSON.parse(response.SecretString);
    return secret.api_key;
  } catch (error) {
    console.error('Failed to get API key from Secrets Manager:', error.message);
    console.log('Please set FAL_KEY environment variable');
    process.exit(1);
  }
}

async function main() {
  const apiKey = await getApiKey();
  fal.config({ credentials: apiKey });
  await testYuE();
}

main();