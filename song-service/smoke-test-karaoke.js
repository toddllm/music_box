const axios = require('axios');

const API_URL = 'https://pd08901pf7.execute-api.us-east-1.amazonaws.com/prod';

async function runSmokeTest() {
    console.log('🎵 Running Karaoke Song Service Smoke Test...\n');

    const testPrompt = `The Epic Ballad of Sir Wiggleton the Magnificent Spoon - 
    In a grand, heroic voice "In the kitchen of King Arthur's greatest knight 
    Lived a spoon of silver, shining bright Sir Wiggleton was his noble name 
    Destined for culinary fame!" He stirred the soup with valor true 
    He mixed the batter, through and through No bowl too deep, no pot too wide 
    Sir Wiggleton stirred with knightly pride! Oh Wiggleton, brave Wiggleton 
    Your handle gleams in morning sun From cereal bowls to royal stew 
    There's no one quite as stirring as you!`;

    try {
        // Test 1: Generate a karaoke song
        console.log('📝 Test 1: Generating karaoke song...');
        console.log('Prompt:', testPrompt.substring(0, 100) + '...');
        
        const generateResponse = await axios.post(`${API_URL}/karaoke/generate`, {
            prompt: testPrompt,
            style: 'epic ballad',
            duration: 45
        }, {
            timeout: 300000 // 5 minutes
        });

        if (!generateResponse.data.success) {
            throw new Error('Song generation failed: ' + generateResponse.data.error);
        }

        const songId = generateResponse.data.id;
        console.log('✅ Song generated successfully!');
        console.log(`   Song ID: ${songId}`);
        console.log(`   Title: ${generateResponse.data.lyrics?.title || 'Untitled'}`);
        console.log(`   Music URL: ${generateResponse.data.musicUrl}`);
        console.log(`   AI Vocals: ${generateResponse.data.aiVocals?.length || 0} segments\n`);

        // Wait a moment for the song to be saved
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 2: Get all songs
        console.log('📝 Test 2: Fetching all saved songs...');
        const songsResponse = await axios.get(`${API_URL}/karaoke/songs`);
        
        if (!songsResponse.data.success) {
            throw new Error('Failed to fetch songs');
        }

        console.log(`✅ Found ${songsResponse.data.songs.length} saved songs`);
        
        // Find our song
        const ourSong = songsResponse.data.songs.find(s => s.id === songId);
        if (ourSong) {
            console.log('   ✅ Our generated song is in the list!\n');
        } else {
            console.log('   ⚠️  Our song not found in list (may still be saving)\n');
        }

        // Test 3: Get specific song by ID
        console.log('📝 Test 3: Fetching specific song by ID...');
        const songDetailResponse = await axios.get(`${API_URL}/karaoke/songs/${songId}`);
        
        if (!songDetailResponse.data.success) {
            throw new Error('Failed to fetch song by ID');
        }

        const savedSong = songDetailResponse.data.song;
        console.log('✅ Song retrieved successfully!');
        console.log(`   Title: ${savedSong.title}`);
        console.log(`   Created: ${new Date(savedSong.createdAt).toLocaleString()}`);
        console.log(`   Music URL: ${savedSong.musicUrl}`);
        console.log(`   Lyrics: ${savedSong.lyrics?.verses?.length || 0} verses`);
        console.log(`   TTL: ${new Date(savedSong.ttl * 1000).toLocaleString()}\n`);

        // Test 4: Test CloudFront URL (if deployed)
        console.log('📝 Test 4: Testing CloudFront karaoke page...');
        try {
            const cloudfrontUrl = 'https://d2ugsg84qhlo4p.cloudfront.net/karaoke.html';
            const cfResponse = await axios.get(cloudfrontUrl);
            console.log(`✅ CloudFront is serving the karaoke page (${cfResponse.status})`);
            console.log(`   URL: ${cloudfrontUrl}\n`);
        } catch (error) {
            console.log('⚠️  CloudFront may still be deploying...\n');
        }

        console.log('🎉 All smoke tests passed successfully!');
        console.log('\n📊 Summary:');
        console.log('   - Song generation: ✅');
        console.log('   - DynamoDB storage: ✅');
        console.log('   - Song retrieval: ✅');
        console.log('   - API endpoints: ✅');
        console.log(`\n🎵 You can now play the generated song at:\n   https://d2ugsg84qhlo4p.cloudfront.net/karaoke.html`);
        console.log(`   Song ID: ${songId}`);

        // Save results
        const results = {
            timestamp: new Date().toISOString(),
            success: true,
            songId: songId,
            songTitle: savedSong.title,
            musicUrl: savedSong.musicUrl,
            apiUrl: API_URL,
            cloudfrontUrl: 'https://d2ugsg84qhlo4p.cloudfront.net'
        };

        require('fs').writeFileSync('karaoke-smoke-test-report.json', JSON.stringify(results, null, 2));
        console.log('\n📄 Test report saved to karaoke-smoke-test-report.json');

    } catch (error) {
        console.error('\n❌ Smoke test failed:', error.message);
        if (error.response?.data) {
            console.error('Response:', error.response.data);
        }
        process.exit(1);
    }
}

runSmokeTest();