// Test script for song generation
import { SongGenerator } from './song-generator.js';

async function testSongGeneration() {
  console.log('🎵 Testing Song Generation Service...\n');

  const generator = new SongGenerator();

  try {
    // Test 1: Health check
    console.log('1. Testing health check...');
    const health = await generator.healthCheck();
    console.log('   Health status:', health.status);
    console.log('   Initialized:', health.initialized);
    console.log('   ✅ Health check passed\n');

    // Test 2: Basic song generation
    console.log('2. Testing basic song generation...');
    const basicSong = await generator.generateSong({
      prompt: 'A happy song about sunshine and dancing',
      style: 'pop',
      duration: 20
    });

    if (basicSong.success) {
      console.log('   ✅ Song generated successfully!');
      console.log('   Audio URL:', basicSong.audioUrl);
      console.log('   Metadata:', basicSong.metadata);
    } else {
      console.log('   ❌ Song generation failed:', basicSong.error);
    }
    console.log('');

    // Test 3: Game context song generation
    console.log('3. Testing game context song generation...');
    const gameSong = await generator.generateSongForGame({
      playerName: 'TestPlayer',
      theme: 'funny',
      difficulty: 'medium'
    });

    if (gameSong.success) {
      console.log('   ✅ Game song generated successfully!');
      console.log('   Prompt used:', gameSong.prompt);
      console.log('   Audio URL:', gameSong.audioUrl);
    } else {
      console.log('   ❌ Game song generation failed:', gameSong.error);
    }
    console.log('');

    // Test 4: Sample songs
    console.log('4. Testing sample songs...');
    const samples = await generator.getSampleSongs();
    console.log('   ✅ Retrieved', samples.length, 'sample songs');
    samples.forEach(song => {
      console.log(`   - ${song.title}: ${song.prompt}`);
    });
    console.log('');

    console.log('🎉 All tests completed!');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testSongGeneration().catch(console.error);
}

export { testSongGeneration };