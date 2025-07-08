#!/usr/bin/env node
/**
 * Generate example songs with Zeldina vocals for the live site
 */

const axios = require('axios');

const API_URL = 'https://pd08901pf7.execute-api.us-east-1.amazonaws.com/prod';

const exampleSongs = [
    {
        prompt: "A motivational anthem about a rubber duck conquering bath time fears",
        style: "uplifting pop rock",
        duration: 6,
        title: "Rubber Duck Hero"
    },
    {
        prompt: "A dramatic ballad about a lonely salt shaker searching for its pepper partner",
        style: "emotional ballad", 
        duration: 6,
        title: "Salt Without Pepper"
    },
    {
        prompt: "An energetic song about a dancing banana at a fruit party",
        style: "disco funk",
        duration: 6,
        title: "Banana Boogie"
    }
];

async function generateSong(songData) {
    console.log(`\n🎵 Generating "${songData.title}"...`);
    console.log(`   Style: ${songData.style}`);
    console.log(`   Duration: ${songData.duration}s`);
    console.log(`   Using Zeldina voice (default)`);
    
    try {
        const startTime = Date.now();
        const response = await axios.post(
            `${API_URL}/singing`,
            {
                prompt: songData.prompt,
                style: songData.style,
                duration: songData.duration
            },
            {
                timeout: 150000 // 2.5 minutes timeout
            }
        );
        
        const endTime = Date.now();
        const generationTime = Math.round((endTime - startTime) / 1000);
        
        if (response.data.success && response.data.audioUrl) {
            console.log(`✅ Success! Generated in ${generationTime}s`);
            console.log(`   Audio URL: ${response.data.audioUrl}`);
            console.log(`   Voice used: ${response.data.voiceUsed || 'Zeldina (default)'}`);
            
            return {
                success: true,
                title: songData.title,
                audioUrl: response.data.audioUrl,
                generationTime,
                ...response.data
            };
        } else {
            throw new Error(response.data.error || 'Generation failed');
        }
    } catch (error) {
        console.error(`❌ Failed: ${error.message}`);
        return {
            success: false,
            title: songData.title,
            error: error.message
        };
    }
}

async function main() {
    console.log('🎤 Generating example songs with Zeldina vocals...');
    console.log('📍 API Endpoint:', API_URL);
    console.log(`📊 Generating ${exampleSongs.length} songs\n`);
    
    const results = [];
    
    for (const song of exampleSongs) {
        const result = await generateSong(song);
        results.push(result);
        
        // Add a small delay between requests
        if (results.length < exampleSongs.length) {
            console.log('\n⏳ Waiting 5 seconds before next generation...');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
    
    // Summary
    console.log('\n\n📊 Generation Summary:');
    console.log('='.repeat(50));
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`✅ Successful: ${successful.length}/${results.length}`);
    console.log(`❌ Failed: ${failed.length}/${results.length}`);
    
    if (successful.length > 0) {
        const avgTime = successful.reduce((sum, r) => sum + r.generationTime, 0) / successful.length;
        console.log(`⏱️  Average generation time: ${Math.round(avgTime)}s`);
    }
    
    console.log('\n📝 Results:');
    results.forEach(result => {
        if (result.success) {
            console.log(`\n✅ ${result.title}`);
            console.log(`   Audio: ${result.audioUrl}`);
            console.log(`   Time: ${result.generationTime}s`);
        } else {
            console.log(`\n❌ ${result.title}`);
            console.log(`   Error: ${result.error}`);
        }
    });
    
    // Save results
    const fs = require('fs');
    const outputFile = 'example-songs-results.json';
    fs.writeFileSync(outputFile, JSON.stringify({
        generatedAt: new Date().toISOString(),
        apiEndpoint: API_URL,
        results
    }, null, 2));
    console.log(`\n💾 Results saved to ${outputFile}`);
}

// Run the script
main().catch(console.error);