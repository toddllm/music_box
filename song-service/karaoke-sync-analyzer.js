#!/usr/bin/env node
/**
 * Karaoke Sync Analyzer - POC for understanding sync issues
 * Analyzes the current timing structure and identifies problems
 */

const fs = require('fs');
const path = require('path');

// Load a sample karaoke song
const songPath = path.join(__dirname, 'karaoke-songs/captain-tissue-vocals.json');
const song = JSON.parse(fs.readFileSync(songPath, 'utf8'));

console.log('🔍 Karaoke Sync Analysis\n');
console.log(`Song: ${song.title}`);
console.log(`Total Duration: ${song.lyrics.totalDuration}s`);
console.log(`Audio URL: ${song.musicUrl}\n`);

// Analyze verse timing
console.log('📊 Verse Timing Analysis:');
console.log('='.repeat(60));

let currentTime = 0;
let gaps = [];
let overlaps = [];

song.lyrics.verses.forEach((verse, index) => {
    const verseEnd = verse.startTime + verse.duration;
    const gap = verse.startTime - currentTime;
    
    console.log(`\nVerse ${index + 1} (${verse.type}, ${verse.singer}):`);
    console.log(`  Start: ${verse.startTime}s`);
    console.log(`  Duration: ${verse.duration}s`);
    console.log(`  End: ${verseEnd}s`);
    console.log(`  Lines: ${verse.lines.length}`);
    console.log(`  Avg time per line: ${(verse.duration / verse.lines.length).toFixed(2)}s`);
    
    if (gap > 0) {
        console.log(`  ⚠️  GAP: ${gap}s before this verse`);
        gaps.push({ index, gap });
    } else if (gap < 0) {
        console.log(`  ❌ OVERLAP: ${Math.abs(gap)}s with previous verse`);
        overlaps.push({ index, overlap: Math.abs(gap) });
    }
    
    // Check if verse extends beyond total duration
    if (verseEnd > song.lyrics.totalDuration) {
        console.log(`  ❌ EXTENDS BEYOND TOTAL: ${verseEnd - song.lyrics.totalDuration}s`);
    }
    
    currentTime = verseEnd;
});

// Summary
console.log('\n\n📈 Summary:');
console.log('='.repeat(60));
console.log(`Total verses: ${song.lyrics.verses.length}`);
console.log(`Player verses: ${song.lyrics.verses.filter(v => v.singer === 'player').length}`);
console.log(`AI verses: ${song.lyrics.verses.filter(v => v.singer === 'ai').length}`);
console.log(`Total gaps: ${gaps.length} (${gaps.reduce((sum, g) => sum + g.gap, 0).toFixed(2)}s)`);
console.log(`Total overlaps: ${overlaps.length}`);
console.log(`Coverage: ${((currentTime / song.lyrics.totalDuration) * 100).toFixed(1)}%`);

// Identify potential issues
console.log('\n\n⚠️  Potential Issues:');
console.log('='.repeat(60));

if (gaps.length > 0) {
    console.log('1. GAPS in timeline - lyrics disappear during these periods');
    gaps.forEach(g => {
        console.log(`   - ${g.gap}s gap before verse ${g.index + 1}`);
    });
}

if (overlaps.length > 0) {
    console.log('2. OVERLAPPING verses - confusing for users');
}

if (currentTime < song.lyrics.totalDuration * 0.9) {
    console.log('3. LOW COVERAGE - large portions without lyrics');
}

// Check for player verse visibility issues
const playerVerses = song.lyrics.verses.filter(v => v.singer === 'player');
const shortPlayerVerses = playerVerses.filter(v => v.duration < 5);
if (shortPlayerVerses.length > 0) {
    console.log('4. SHORT PLAYER VERSES - may not display long enough');
    shortPlayerVerses.forEach((v, i) => {
        console.log(`   - Player verse with only ${v.duration}s duration`);
    });
}

// Proposed solutions
console.log('\n\n💡 Proposed Solutions:');
console.log('='.repeat(60));
console.log('1. Generate more accurate timestamps from audio analysis');
console.log('2. Add "preparation" time before player verses');
console.log('3. Implement word-level timing instead of verse-level');
console.log('4. Use audio waveform analysis to detect vocal sections');
console.log('5. Add visual countdown before player turns');
console.log('6. Implement smoother transitions between verses');

// Export analysis for further processing
const analysis = {
    song: song.title,
    totalDuration: song.lyrics.totalDuration,
    verses: song.lyrics.verses.map((v, i) => ({
        index: i,
        type: v.type,
        singer: v.singer,
        startTime: v.startTime,
        duration: v.duration,
        endTime: v.startTime + v.duration,
        lines: v.lines.length,
        avgTimePerLine: v.duration / v.lines.length
    })),
    issues: {
        gaps,
        overlaps,
        coverage: (currentTime / song.lyrics.totalDuration) * 100,
        shortPlayerVerses: shortPlayerVerses.length
    }
};

fs.writeFileSync(
    path.join(__dirname, 'experiments/sync-analysis-results.json'),
    JSON.stringify(analysis, null, 2)
);

console.log('\n\n💾 Analysis saved to sync-analysis-results.json');