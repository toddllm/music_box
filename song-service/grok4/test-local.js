#!/usr/bin/env node

/**
 * Local testing script for the enhanced karaoke Lambda
 * Simulates API Gateway events locally
 */

import { handler } from './lambda/index.mjs';

// Test data
const testPrompts = [
  "A silly song about a rubber duck conquering the bathtub",
  "An epic ballad about a lonely sock looking for its pair",
  "A disco anthem about vegetables having a party",
  "A dramatic opera about running out of coffee"
];

// Simulate API Gateway event
function createEvent(path, method, body = null) {
  return {
    httpMethod: method,
    path: path,
    pathParameters: path.includes('/songs/') ? { id: path.split('/').pop() } : null,
    headers: {
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : null
  };
}

// Test song generation
async function testGenerate() {
  console.log('🎵 Testing song generation...\n');
  
  const prompt = testPrompts[Math.floor(Math.random() * testPrompts.length)];
  const event = createEvent('/generate', 'POST', {
    prompt: prompt,
    style: 'disco',
    duration: 30,
    emotion: 'happy'
  });
  
  console.log(`Generating song: "${prompt}"`);
  console.log('This may take 20-30 seconds...\n');
  
  try {
    const response = await handler(event);
    const data = JSON.parse(response.body);
    
    if (response.statusCode === 200) {
      console.log('✅ Song generated successfully!');
      console.log(`ID: ${data.id}`);
      console.log(`Title: ${data.title}`);
      console.log(`Audio URL: ${data.audioUrl}`);
      console.log(`Lyrics preview: ${data.lyrics.split('\n').slice(0, 3).join('\n')}...`);
      
      return data.id;
    } else {
      console.error('❌ Generation failed:', data.error);
      return null;
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
    return null;
  }
}

// Test getting all songs
async function testGetSongs() {
  console.log('\n📚 Testing get all songs...\n');
  
  const event = createEvent('/songs', 'GET');
  
  try {
    const response = await handler(event);
    const data = JSON.parse(response.body);
    
    if (response.statusCode === 200) {
      console.log(`✅ Found ${data.length} songs`);
      data.slice(0, 3).forEach(song => {
        console.log(`- ${song.title} (${song.style}, ${song.emotion})`);
      });
    } else {
      console.error('❌ Failed to get songs:', data.error);
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Test getting single song
async function testGetSong(songId) {
  console.log(`\n🎵 Testing get single song (${songId})...\n`);
  
  const event = createEvent(`/songs/${songId}`, 'GET');
  
  try {
    const response = await handler(event);
    const data = JSON.parse(response.body);
    
    if (response.statusCode === 200) {
      console.log('✅ Song retrieved successfully!');
      console.log(`Title: ${data.title}`);
      console.log(`Created: ${new Date(data.createdAt).toLocaleString()}`);
      console.log(`Parsed lyrics count: ${data.parsedLyrics.length} lines`);
    } else {
      console.error('❌ Failed to get song:', data.error);
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Test CORS
async function testCORS() {
  console.log('\n🌐 Testing CORS...\n');
  
  const event = createEvent('/generate', 'OPTIONS');
  
  try {
    const response = await handler(event);
    
    if (response.statusCode === 200) {
      console.log('✅ CORS preflight successful');
      console.log('Headers:', JSON.stringify(response.headers, null, 2));
    } else {
      console.error('❌ CORS preflight failed');
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting local tests for Enhanced Karaoke Lambda\n');
  console.log('=' .repeat(60) + '\n');
  
  // Set up environment variables for local testing
  process.env.DYNAMO_TABLE = 'KaraokeSongs';
  process.env.S3_BUCKET = 'karaoke-test-bucket';
  process.env.REGION = 'us-east-1';
  
  console.log('⚠️  Note: Make sure you have set up AWS credentials and created secrets in AWS Secrets Manager\n');
  
  // Run tests
  await testCORS();
  await testGetSongs();
  
  // Generate a new song and test retrieval
  const songId = await testGenerate();
  if (songId) {
    await testGetSong(songId);
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('✅ Local tests completed!\n');
}

// Run tests
runTests().catch(console.error);