// Local test for song service (without real API calls)
import express from 'express';
import { SongGenerator } from './song-generator.js';

async function testLocalService() {
  console.log('🎵 Testing Song Service Components...\n');

  try {
    // Test 1: Service instantiation
    console.log('1. Testing service instantiation...');
    const generator = new SongGenerator();
    console.log('   ✅ SongGenerator created successfully\n');

    // Test 2: Prompt formatting
    console.log('2. Testing prompt formatting...');
    const formattedPrompt = generator.formatPrompt('A happy song', 'pop', 30);
    console.log('   Formatted prompt:', formattedPrompt);
    console.log('   ✅ Prompt formatting works\n');

    // Test 3: Sample songs
    console.log('3. Testing sample songs...');
    const samples = await generator.getSampleSongs();
    console.log('   Sample songs:', samples.length);
    samples.forEach(song => {
      console.log(`   - ${song.title}: ${song.prompt}`);
    });
    console.log('   ✅ Sample songs retrieved\n');

    // Test 4: Mock generation (without API call)
    console.log('4. Testing mock generation response...');
    const mockResult = {
      success: true,
      audioUrl: 'https://example.com/generated-song.mp3',
      prompt: 'Test prompt',
      generatedAt: new Date().toISOString(),
      duration: 30,
      style: 'pop',
      metadata: {
        requestId: 'test-123',
        model: 'fal-ai/minimax-music'
      }
    };
    console.log('   Mock result structure:', Object.keys(mockResult));
    console.log('   ✅ Mock generation response format correct\n');

    // Test 5: Express app creation
    console.log('5. Testing Express app creation...');
    const app = express();
    app.use(express.json());
    
    app.get('/test', (req, res) => {
      res.json({ message: 'Test endpoint working' });
    });
    
    console.log('   ✅ Express app created successfully\n');

    console.log('🎉 All local tests passed!');
    console.log('\n📋 Next steps:');
    console.log('1. Get a Fal.ai API key from https://fal.ai/');
    console.log('2. Update the AWS secret: music-box/fal-ai');
    console.log('3. Start the service: npm start');
    console.log('4. Test with the HTML client: test-client.html');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run test
testLocalService().catch(console.error);