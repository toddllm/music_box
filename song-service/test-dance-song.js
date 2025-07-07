const axios = require('axios');

const API_URL = 'https://pd08901pf7.execute-api.us-east-1.amazonaws.com/prod';

async function testDanceSong() {
    console.log('🎵 Testing Dance Song Generation and Storage...\n');

    try {
        // Step 1: Check initial song count
        console.log('1️⃣ Checking current songs...');
        const beforeResponse = await axios.get(`${API_URL}/karaoke/songs`);
        const beforeCount = beforeResponse.data.songs?.length || 0;
        console.log(`   Found ${beforeCount} songs before generation\n`);

        // Step 2: Generate a dance song
        console.log('2️⃣ Generating new dance song...');
        const dancePrompt = "Create an upbeat dance party song about robots learning to dance, with electronic beats and fun synthesizer sounds";
        
        const generateResponse = await axios.post(`${API_URL}/karaoke/generate`, {
            prompt: dancePrompt,
            style: 'disco',
            duration: 30
        }, {
            timeout: 60000 // 1 minute timeout
        });

        if (!generateResponse.data.success) {
            throw new Error('Song generation failed');
        }

        const songId = generateResponse.data.id;
        console.log(`   ✅ Dance song generated!`);
        console.log(`   Song ID: ${songId}`);
        console.log(`   Title: ${generateResponse.data.lyrics?.title || 'Untitled'}`);
        console.log(`   Music URL: ${generateResponse.data.musicUrl}\n`);

        // Step 3: Wait a moment for DB write
        console.log('3️⃣ Waiting for database save...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 4: Check if song was saved
        console.log('4️⃣ Verifying song was saved...');
        const afterResponse = await axios.get(`${API_URL}/karaoke/songs`);
        const afterCount = afterResponse.data.songs?.length || 0;
        const newSong = afterResponse.data.songs.find(s => s.id === songId);
        
        console.log(`   Total songs now: ${afterCount}`);
        if (newSong) {
            console.log(`   ✅ NEW DANCE SONG FOUND IN LIST!`);
            console.log(`   Title: ${newSong.title}`);
            console.log(`   Style: ${newSong.style}`);
            console.log(`   Created: ${new Date(newSong.createdAt).toLocaleString()}`);
        } else {
            console.log(`   ❌ Dance song NOT found in list`);
            console.log(`   Songs increased: ${afterCount > beforeCount ? 'YES' : 'NO'}`);
        }

        // Step 5: Try to fetch the specific song
        console.log(`\n5️⃣ Fetching song by ID...`);
        try {
            const songResponse = await axios.get(`${API_URL}/karaoke/songs/${songId}`);
            if (songResponse.data.success) {
                console.log(`   ✅ Song retrieved by ID successfully!`);
            } else {
                console.log(`   ❌ Song not found by ID`);
            }
        } catch (error) {
            console.log(`   ❌ Error fetching song by ID: ${error.message}`);
        }

        // Summary
        console.log('\n📊 SUMMARY:');
        console.log(`   Generation: ${generateResponse.data.success ? '✅' : '❌'}`);
        console.log(`   Song has ID: ${songId ? '✅' : '❌'}`);
        console.log(`   Found in list: ${newSong ? '✅' : '❌'}`);
        console.log(`   Database save: ${newSong || afterCount > beforeCount ? '✅ WORKING' : '❌ NOT WORKING'}`);

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (error.response?.data) {
            console.error('Response:', error.response.data);
        }
    }
}

testDanceSong();