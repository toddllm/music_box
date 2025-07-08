#!/usr/bin/env node
/**
 * Smoke test for karaoke sync experiments
 */

const axios = require('axios');

const CLOUDFRONT_URL = 'https://d2ugsg84qhlo4p.cloudfront.net';

const experiments = [
    {
        name: 'Experiments Dashboard',
        path: '/experiments/index.html',
        type: 'html'
    },
    {
        name: 'Visual Sync Debugger',
        path: '/experiments/karaoke-sync-visual-test.html',
        type: 'html'
    },
    {
        name: 'Word-Level Preview',
        path: '/experiments/word-level-preview.html',
        type: 'html'
    },
    {
        name: 'Sync Analysis Results',
        path: '/experiments/sync-analysis-results.json',
        type: 'json'
    },
    {
        name: 'Timing Methods Comparison',
        path: '/experiments/timing-methods-comparison.json',
        type: 'json'
    },
    {
        name: 'Word-Level Sync Results',
        path: '/experiments/word-level-sync-results.json',
        type: 'json'
    },
    {
        name: 'Karaoke Sync Findings',
        path: '/experiments/karaoke-sync-findings.md',
        type: 'markdown'
    }
];

async function testExperiment(experiment) {
    console.log(`\n🧪 Testing: ${experiment.name}`);
    console.log(`   URL: ${CLOUDFRONT_URL}${experiment.path}`);
    
    try {
        const response = await axios.get(`${CLOUDFRONT_URL}${experiment.path}`, {
            timeout: 10000,
            validateStatus: (status) => status < 500
        });
        
        if (response.status === 200) {
            console.log(`   ✅ Success: ${response.status}`);
            console.log(`   Type: ${response.headers['content-type']}`);
            console.log(`   Size: ${response.data.length} bytes`);
            
            // Validate content type
            if (experiment.type === 'json' && response.headers['content-type'].includes('json')) {
                console.log(`   ✓ Valid JSON response`);
            } else if (experiment.type === 'html' && response.headers['content-type'].includes('html')) {
                console.log(`   ✓ Valid HTML response`);
            }
            
            return true;
        } else {
            console.log(`   ⚠️  Status: ${response.status}`);
            return false;
        }
    } catch (error) {
        console.error(`   ❌ Failed: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('🚀 Karaoke Sync Experiments Smoke Test');
    console.log('=' .repeat(50));
    console.log(`CloudFront URL: ${CLOUDFRONT_URL}`);
    console.log(`Testing ${experiments.length} experiment pages...`);
    
    const results = [];
    
    for (const experiment of experiments) {
        const success = await testExperiment(experiment);
        results.push({ ...experiment, success });
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
            console.log(`  - ${r.name}`);
        });
    }
    
    // Dashboard link
    console.log('\n\n🎯 Experiments Dashboard:');
    console.log(`${CLOUDFRONT_URL}/experiments/index.html`);
    
    console.log('\n📚 Key Experiments to Try:');
    console.log(`1. Visual Sync Debugger: ${CLOUDFRONT_URL}/experiments/karaoke-sync-visual-test.html`);
    console.log(`   - Interactive timeline with all 5 songs`);
    console.log(`   - Shows gaps, overlaps, and playhead position`);
    console.log(`   - Debug mode for detailed logging`);
    
    console.log(`\n2. Word-Level Preview: ${CLOUDFRONT_URL}/experiments/word-level-preview.html`);
    console.log(`   - Demonstrates word-by-word karaoke timing`);
    console.log(`   - Shows active word highlighting`);
    
    console.log(`\n3. Research Findings: ${CLOUDFRONT_URL}/experiments/karaoke-sync-findings.md`);
    console.log(`   - Comprehensive analysis and recommendations`);
    console.log(`   - Roadmap for improvements`);
}

main().catch(console.error);