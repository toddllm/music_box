#!/usr/bin/env node

/**
 * Smoke test for enhanced karaoke deployment
 */

const https = require('https');

const CLOUDFRONT_URL = 'https://d2ugsg84qhlo4p.cloudfront.net';

const pages = [
  {
    name: 'Enhanced Karaoke Demo Page',
    path: '/grok4/index.html',
    expectedContent: 'Music Box Karaoke Enhanced'
  },
  {
    name: 'Enhanced Karaoke Full Page',
    path: '/grok4/karaoke.html',
    expectedContent: 'Generate Song with Vocals'
  },
  {
    name: 'Current Vocal Karaoke',
    path: '/music-box-vocal-karaoke.html',
    expectedContent: 'Music Box Vocal Karaoke'
  },
  {
    name: 'Experiments Dashboard',
    path: '/experiments/index.html',
    expectedContent: 'Karaoke Sync Experiments'
  }
];

function testPage(page) {
  return new Promise((resolve, reject) => {
    const url = `${CLOUDFRONT_URL}${page.path}`;
    console.log(`\n🧪 Testing: ${page.name}`);
    console.log(`   URL: ${url}`);
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`   ✅ Status: ${res.statusCode}`);
          console.log(`   ✅ Content-Type: ${res.headers['content-type']}`);
          console.log(`   ✅ Size: ${data.length} bytes`);
          
          if (data.includes(page.expectedContent)) {
            console.log(`   ✅ Expected content found: "${page.expectedContent}"`);
            resolve(true);
          } else {
            console.log(`   ⚠️  Expected content not found: "${page.expectedContent}"`);
            resolve(false);
          }
        } else {
          console.log(`   ❌ Status: ${res.statusCode}`);
          resolve(false);
        }
      });
    }).on('error', (err) => {
      console.error(`   ❌ Error: ${err.message}`);
      resolve(false);
    });
  });
}

async function runSmokeTest() {
  console.log('🚀 Enhanced Karaoke Smoke Test');
  console.log('=' .repeat(50));
  
  const results = [];
  
  for (const page of pages) {
    const success = await testPage(page);
    results.push({ page: page.name, success });
  }
  
  // Summary
  console.log('\n\n📊 Test Summary:');
  console.log('=' .repeat(50));
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  
  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.page}`);
    });
  }
  
  // Final URLs
  console.log('\n\n🎯 Key URLs:');
  console.log('=' .repeat(50));
  console.log(`\n📄 Enhanced Karaoke Demo Page:`);
  console.log(`${CLOUDFRONT_URL}/grok4/index.html`);
  console.log(`\nThis page shows:`);
  console.log(`- Feature comparison between original and enhanced versions`);
  console.log(`- Performance improvements (75% faster, real vocals)`);
  console.log(`- Links to live demos and code`);
  
  console.log(`\n🎤 Current Production Karaoke:`);
  console.log(`${CLOUDFRONT_URL}/music-box-vocal-karaoke.html`);
  
  console.log(`\n🧪 Sync Experiments Dashboard:`);
  console.log(`${CLOUDFRONT_URL}/experiments/index.html`);
  
  console.log(`\n📚 Enhanced Version Code & Docs:`);
  console.log(`https://github.com/toddllm/music_box/tree/main/song-service/grok4`);
  
  console.log('\n✨ The enhanced version includes:');
  console.log('- Fal.ai DiffRhythm for true singing voice generation');
  console.log('- GPT-4o-realtime for better laughter detection');
  console.log('- Emotion-adaptive music generation');
  console.log('- LRC format with precise timestamps');
  console.log('- Modern serverless architecture');
}

runSmokeTest().catch(console.error);