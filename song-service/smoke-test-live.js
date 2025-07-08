#!/usr/bin/env node
/**
 * Smoke test the deployed Music Box API
 */

const axios = require('axios');

const API_URL = 'https://pd08901pf7.execute-api.us-east-1.amazonaws.com/prod';
const CLOUDFRONT_URL = 'https://d2ugsg84qhlo4p.cloudfront.net';

async function testEndpoint(name, method, path, data = null) {
    console.log(`\n🧪 Testing ${name}...`);
    try {
        const config = {
            method,
            url: `${API_URL}${path}`,
            timeout: 10000
        };
        
        if (data) {
            config.data = data;
        }
        
        const response = await axios(config);
        console.log(`✅ Success: ${response.status} ${response.statusText}`);
        
        if (response.data) {
            console.log('   Response:', JSON.stringify(response.data, null, 2).substring(0, 200) + '...');
        }
        
        return true;
    } catch (error) {
        console.error(`❌ Failed: ${error.message}`);
        if (error.response?.data) {
            console.error('   Error details:', error.response.data);
        }
        return false;
    }
}

async function testFrontendPage(name, path) {
    console.log(`\n🌐 Testing frontend page: ${name}...`);
    try {
        const response = await axios.get(`${CLOUDFRONT_URL}${path}`, {
            timeout: 10000,
            validateStatus: (status) => status < 500
        });
        
        if (response.status === 200) {
            console.log(`✅ Page loaded successfully`);
            console.log(`   Content-Type: ${response.headers['content-type']}`);
            console.log(`   Size: ${response.data.length} bytes`);
            return true;
        } else {
            console.log(`⚠️  Page returned status ${response.status}`);
            return false;
        }
    } catch (error) {
        console.error(`❌ Failed to load page: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('🚀 Music Box Smoke Test');
    console.log('=' .repeat(50));
    console.log(`API URL: ${API_URL}`);
    console.log(`CloudFront URL: ${CLOUDFRONT_URL}`);
    
    const results = [];
    
    // Test API endpoints
    console.log('\n📡 Testing API Endpoints:');
    results.push(await testEndpoint('Health Check', 'GET', '/health'));
    results.push(await testEndpoint('Generate Endpoint', 'POST', '/generate', {
        prompt: 'test',
        style: 'test',
        duration: 6
    }));
    results.push(await testEndpoint('Singing Endpoint', 'POST', '/singing', {
        prompt: 'test',
        style: 'test', 
        duration: 6
    }));
    results.push(await testEndpoint('Karaoke Endpoint', 'POST', '/karaoke', {
        prompt: 'test karaoke song'
    }));
    
    // Test Frontend Pages
    console.log('\n🌐 Testing Frontend Pages:');
    results.push(await testFrontendPage('Main App', '/index.html'));
    results.push(await testFrontendPage('Karaoke App', '/karaoke.html'));
    results.push(await testFrontendPage('Vocal Karaoke', '/music-box-vocal-karaoke.html'));
    results.push(await testFrontendPage('Test Vocal Karaoke', '/test-vocal-karaoke.html'));
    results.push(await testFrontendPage('Karaoke Songs Catalog', '/karaoke-songs/catalog.json'));
    
    // Summary
    console.log('\n\n📊 Test Summary:');
    console.log('=' .repeat(50));
    const passed = results.filter(r => r).length;
    const failed = results.filter(r => !r).length;
    
    console.log(`✅ Passed: ${passed}/${results.length}`);
    console.log(`❌ Failed: ${failed}/${results.length}`);
    
    if (failed === 0) {
        console.log('\n🎉 All tests passed! The deployment is working correctly.');
    } else {
        console.log('\n⚠️  Some tests failed. Please check the errors above.');
    }
    
    // URLs for manual testing
    console.log('\n\n🔗 URLs for Manual Testing:');
    console.log(`Main App: ${CLOUDFRONT_URL}/index.html`);
    console.log(`Vocal Karaoke: ${CLOUDFRONT_URL}/music-box-vocal-karaoke.html`);
    console.log(`Test Page: ${CLOUDFRONT_URL}/test-vocal-karaoke.html`);
    console.log(`Results Viewer: ${CLOUDFRONT_URL}/music-box-vocal-results.html`);
}

main().catch(console.error);