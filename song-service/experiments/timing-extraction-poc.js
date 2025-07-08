#!/usr/bin/env node
/**
 * Timing Extraction POC
 * Explores different methods for generating better timestamps
 */

const fs = require('fs');

console.log('🎵 Timing Extraction Methods POC\n');

// Method 1: Simple even distribution
function evenDistribution(lyrics, totalDuration) {
    console.log('📊 Method 1: Even Distribution');
    console.log('Assumes equal time for each line');
    
    const totalLines = lyrics.reduce((sum, verse) => sum + verse.lines.length, 0);
    const timePerLine = totalDuration / totalLines;
    
    let currentTime = 0;
    const timedVerses = lyrics.map(verse => {
        const duration = verse.lines.length * timePerLine;
        const result = {
            ...verse,
            startTime: currentTime,
            duration: duration
        };
        currentTime += duration;
        return result;
    });
    
    console.log(`  Time per line: ${timePerLine.toFixed(2)}s`);
    console.log(`  Coverage: 100%\n`);
    
    return timedVerses;
}

// Method 2: Weighted by line length
function weightedByLength(lyrics, totalDuration) {
    console.log('📊 Method 2: Weighted by Line Length');
    console.log('Longer lines get more time');
    
    // Calculate total character count
    const totalChars = lyrics.reduce((sum, verse) => 
        sum + verse.lines.reduce((vSum, line) => vSum + line.length, 0), 0
    );
    
    const timePerChar = totalDuration / totalChars;
    
    let currentTime = 0;
    const timedVerses = lyrics.map(verse => {
        const verseChars = verse.lines.reduce((sum, line) => sum + line.length, 0);
        const duration = verseChars * timePerChar;
        const result = {
            ...verse,
            startTime: currentTime,
            duration: duration
        };
        currentTime += duration;
        return result;
    });
    
    console.log(`  Time per character: ${timePerChar.toFixed(3)}s`);
    console.log(`  Coverage: 100%\n`);
    
    return timedVerses;
}

// Method 3: With transition gaps
function withTransitionGaps(lyrics, totalDuration, gapTime = 1) {
    console.log('📊 Method 3: With Transition Gaps');
    console.log(`Adds ${gapTime}s gap between singer changes`);
    
    // Count transitions
    let transitions = 0;
    for (let i = 1; i < lyrics.length; i++) {
        if (lyrics[i].singer !== lyrics[i-1].singer) {
            transitions++;
        }
    }
    
    const totalGapTime = transitions * gapTime;
    const availableTime = totalDuration - totalGapTime;
    const totalLines = lyrics.reduce((sum, verse) => sum + verse.lines.length, 0);
    const timePerLine = availableTime / totalLines;
    
    let currentTime = 0;
    const timedVerses = lyrics.map((verse, index) => {
        // Add gap if singer changes
        if (index > 0 && verse.singer !== lyrics[index-1].singer) {
            currentTime += gapTime;
        }
        
        const duration = verse.lines.length * timePerLine;
        const result = {
            ...verse,
            startTime: currentTime,
            duration: duration
        };
        currentTime += duration;
        return result;
    });
    
    console.log(`  Transitions: ${transitions}`);
    console.log(`  Total gap time: ${totalGapTime}s`);
    console.log(`  Coverage: ${((currentTime / totalDuration) * 100).toFixed(1)}%\n`);
    
    return timedVerses;
}

// Method 4: Preparation time for player
function withPreparationTime(lyrics, totalDuration, prepTime = 2) {
    console.log('📊 Method 4: With Player Preparation Time');
    console.log(`Shows player lyrics ${prepTime}s early`);
    
    const playerVerses = lyrics.filter(v => v.singer === 'player').length;
    const totalPrepTime = playerVerses * prepTime;
    const availableTime = totalDuration - totalPrepTime;
    const totalLines = lyrics.reduce((sum, verse) => sum + verse.lines.length, 0);
    const timePerLine = availableTime / totalLines;
    
    let currentTime = 0;
    const timedVerses = lyrics.map(verse => {
        const duration = verse.lines.length * timePerLine;
        
        // Start player verses early (overlapping with previous)
        const startTime = verse.singer === 'player' && currentTime > prepTime
            ? currentTime - prepTime
            : currentTime;
        
        const result = {
            ...verse,
            startTime: startTime,
            duration: duration + (verse.singer === 'player' ? prepTime : 0),
            preparationTime: verse.singer === 'player' ? prepTime : 0
        };
        
        currentTime += duration;
        return result;
    });
    
    console.log(`  Player verses: ${playerVerses}`);
    console.log(`  Total prep time: ${totalPrepTime}s`);
    console.log(`  Note: Creates intentional overlaps for preparation\n`);
    
    return timedVerses;
}

// Method 5: Syllable estimation
function syllableBasedTiming(lyrics, totalDuration, syllablesPerSecond = 3) {
    console.log('📊 Method 5: Syllable-Based Timing');
    console.log(`Estimates syllables at ${syllablesPerSecond} per second`);
    
    // Simple syllable estimation (count vowel groups)
    function estimateSyllables(text) {
        return text.toLowerCase().match(/[aeiou]+/g)?.length || 1;
    }
    
    // Calculate total syllables
    const verseSyllables = lyrics.map(verse => ({
        ...verse,
        syllables: verse.lines.reduce((sum, line) => sum + estimateSyllables(line), 0)
    }));
    
    const totalSyllables = verseSyllables.reduce((sum, v) => sum + v.syllables, 0);
    const estimatedDuration = totalSyllables / syllablesPerSecond;
    const scaleFactor = totalDuration / estimatedDuration;
    
    let currentTime = 0;
    const timedVerses = verseSyllables.map(verse => {
        const duration = (verse.syllables / syllablesPerSecond) * scaleFactor;
        const result = {
            ...verse,
            startTime: currentTime,
            duration: duration
        };
        currentTime += duration;
        return result;
    });
    
    console.log(`  Total syllables: ${totalSyllables}`);
    console.log(`  Estimated duration: ${estimatedDuration.toFixed(1)}s`);
    console.log(`  Scale factor: ${scaleFactor.toFixed(2)}x\n`);
    
    return timedVerses;
}

// Test with sample lyrics
const sampleLyrics = [
    {
        type: 'verse',
        singer: 'player',
        lines: [
            'In a bathroom cabinet high',
            'Where the cleaning supplies lie',
            'Lived a tissue box so brave',
            'Captain Tissue, soft and suave!'
        ]
    },
    {
        type: 'chorus', 
        singer: 'ai',
        lines: ['Soft and strong, white and true']
    },
    {
        type: 'verse',
        singer: 'player', 
        lines: [
            "Captain Tissue's there for you!",
            'Pull one out, then pull some more',
            'Comfort knocking at your door!'
        ]
    }
];

const totalDuration = 32;

console.log('🧪 Testing with Captain Tissue lyrics');
console.log(`Total duration: ${totalDuration}s\n`);
console.log('=' .repeat(60) + '\n');

// Test each method
const methods = [
    { name: 'even', fn: evenDistribution },
    { name: 'weighted', fn: weightedByLength },
    { name: 'gaps', fn: withTransitionGaps },
    { name: 'preparation', fn: withPreparationTime },
    { name: 'syllable', fn: syllableBasedTiming }
];

const results = {};

methods.forEach(method => {
    const timed = method.fn(sampleLyrics, totalDuration);
    results[method.name] = timed;
});

// Save results for comparison
fs.writeFileSync(
    'experiments/timing-methods-comparison.json',
    JSON.stringify(results, null, 2)
);

console.log('\n💾 Results saved to timing-methods-comparison.json');

// Recommendations
console.log('\n\n💡 Recommendations:');
console.log('=' .repeat(60));
console.log('1. For immediate improvement: Use Method 4 (Preparation Time)');
console.log('   - Gives players time to read lyrics before singing');
console.log('   - Simple to implement with current structure');
console.log('\n2. For better accuracy: Combine Methods 3 & 5');
console.log('   - Syllable-based timing for natural pacing');
console.log('   - Transition gaps for singer switches');
console.log('\n3. For best results: Implement audio analysis');
console.log('   - Use voice activity detection (VAD)');
console.log('   - Extract actual vocal timing from audio');
console.log('   - Align lyrics to detected vocal segments');
console.log('\n4. Future enhancement: Real-time adjustment');
console.log('   - Monitor user singing timing');
console.log('   - Adjust future verses based on user pace');
console.log('   - Adaptive synchronization');