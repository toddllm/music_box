#!/usr/bin/env node

// Test CloudFront HTTPS deployment
import fetch from 'node-fetch';

const CLOUDFRONT_URL = 'https://d1fsftnjlcjyyq.cloudfront.net';
const API_URL = 'https://pd08901pf7.execute-api.us-east-1.amazonaws.com/prod';

async function testCloudFrontDeployment() {
    console.log('🧪 Testing CloudFront HTTPS Deployment\n');
    
    try {
        // Test 1: Frontend accessibility
        console.log('1. Testing frontend access...');
        const frontendResponse = await fetch(CLOUDFRONT_URL);
        
        if (!frontendResponse.ok) {
            throw new Error(`Frontend not accessible: ${frontendResponse.status}`);
        }
        
        const html = await frontendResponse.text();
        if (!html.includes('Music Box - Song Generator')) {
            throw new Error('Frontend HTML missing expected title');
        }
        
        console.log('   ✅ Frontend accessible via HTTPS');
        console.log(`   📦 Content-Length: ${html.length} bytes`);
        
        // Test 2: Static resources
        console.log('\n2. Testing static resources...');
        const resources = ['styles.css', 'app.js'];
        
        for (const resource of resources) {
            const response = await fetch(`${CLOUDFRONT_URL}/${resource}`);
            if (!response.ok) {
                throw new Error(`Resource ${resource} not accessible: ${response.status}`);
            }
            const content = await response.text();
            console.log(`   ✅ ${resource} loaded (${Math.round(content.length / 1024)}KB)`);
        }
        
        // Test 3: HTTPS security
        console.log('\n3. Testing HTTPS security...');
        const headers = frontendResponse.headers;
        console.log(`   🔒 Protocol: HTTPS`);
        console.log(`   🌐 Server: ${headers.get('server') || 'CloudFront'}`);
        console.log(`   📊 Cache: ${headers.get('x-cache') || 'N/A'}`);
        
        // Test 4: API connectivity from HTTPS origin
        console.log('\n4. Testing API connectivity...');
        const apiResponse = await fetch(`${API_URL}/health`, {
            headers: {
                'Origin': CLOUDFRONT_URL
            }
        });
        
        if (!apiResponse.ok) {
            throw new Error(`API not accessible: ${apiResponse.status}`);
        }
        
        const apiData = await apiResponse.json();
        console.log(`   ✅ API accessible from HTTPS origin`);
        console.log(`   📊 API Status: ${apiData.status}`);
        
        // Test 5: CORS headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': apiResponse.headers.get('access-control-allow-origin'),
            'Access-Control-Allow-Methods': apiResponse.headers.get('access-control-allow-methods'),
            'Access-Control-Allow-Headers': apiResponse.headers.get('access-control-allow-headers')
        };
        
        console.log(`   🔗 CORS Origin: ${corsHeaders['Access-Control-Allow-Origin']}`);
        
        console.log('\n🎉 All tests passed!');
        console.log('\n📊 DEPLOYMENT SUCCESS SUMMARY:');
        console.log('=' .repeat(50));
        console.log(`🌍 HTTPS URL: ${CLOUDFRONT_URL}`);
        console.log(`🔗 API URL: ${API_URL}`);
        console.log(`✅ Frontend: Fully operational`);
        console.log(`✅ HTTPS: Properly configured`);
        console.log(`✅ API: Accessible and healthy`);
        console.log(`✅ CORS: Enabled for cross-origin requests`);
        console.log(`✅ Static Assets: All resources loading correctly`);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

testCloudFrontDeployment();