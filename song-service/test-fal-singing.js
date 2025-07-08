const axios = require('axios');

const API_URL = 'https://pd08901pf7.execute-api.us-east-1.amazonaws.com/prod';

async function testFalSinging() {
    console.log('🎵 Testing Fal.ai Singing Models...\n');

    const testLyrics = `[verse]
Oh Sir Wiggleton, brave Sir Wiggleton
Your handle gleams in morning sun
From cereal bowls to royal stew
There's no one quite as stirring as you!

[chorus]
Stir it up, stir it round
Best spoon that can be found
In the kitchen you're the king
Make the pots and kettles sing!`;

    try {
        console.log('Testing YuE model (full song generation)...');
        console.log('Lyrics:', testLyrics.substring(0, 100) + '...\n');
        
        const response = await fetch(`${API_URL}/fal/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'fal-ai/yue',
                lyrics: testLyrics,
                genres: 'epic, orchestral, heroic'
            })
        });

        const data = await response.json();
        
        if (data.success) {
            console.log('✅ SUCCESS!');
            console.log(`Audio URL: ${data.audioUrl}`);
            console.log(`Generation time: ${(data.duration / 1000).toFixed(1)} seconds`);
            console.log(`Request ID: ${data.requestId}`);
            console.log('\n🎧 Listen to the generated song at:');
            console.log(data.audioUrl);
        } else {
            console.log('❌ FAILED:', data.error);
            if (data.details) {
                console.log('Details:', data.details);
            }
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

testFalSinging();