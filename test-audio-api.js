#!/usr/bin/env node

// Test script for audio analysis API
const fs = require('fs');
const https = require('https');

// Create a small test audio file (silence)
const sampleRate = 16000;
const duration = 2; // seconds
const numSamples = sampleRate * duration;
const buffer = Buffer.alloc(numSamples * 2); // 16-bit PCM

// Generate silence (all zeros)
for (let i = 0; i < numSamples; i++) {
  buffer.writeInt16LE(0, i * 2);
}

// Convert to base64
const audioBase64 = buffer.toString('base64');

// Prepare request data
const data = JSON.stringify({
  audioData: audioBase64,
  mimeType: 'audio/wav'
});

// API endpoint
const options = {
  hostname: 'dxhq2y7asz0vd.cloudfront.net',
  path: '/api/analyze-audio-base64',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('Testing audio analysis API...');
console.log(`Sending ${Buffer.byteLength(data)} bytes of data`);

const req = https.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers)}`);
  
  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', responseData);
    try {
      const result = JSON.parse(responseData);
      console.log('Parsed result:', result);
    } catch (e) {
      console.log('Failed to parse response as JSON');
    }
  });
});

req.on('error', (error) => {
  console.error('Request error:', error);
});

req.write(data);
req.end();