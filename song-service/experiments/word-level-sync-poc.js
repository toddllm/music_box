#!/usr/bin/env node
/**
 * Word-Level Sync POC
 * Explores word-by-word timing for better karaoke experience
 */

const fs = require('fs');

console.log('🎤 Word-Level Karaoke Sync POC\n');

// Convert line-based lyrics to word-based with timing
function generateWordTimings(verse, startTime, duration) {
    const words = [];
    let currentTime = startTime;
    
    // Count total words in verse
    const totalWords = verse.lines.reduce((sum, line) => 
        sum + line.split(/\s+/).filter(w => w.length > 0).length, 0
    );
    
    const timePerWord = duration / totalWords;
    
    verse.lines.forEach((line, lineIndex) => {
        const lineWords = line.split(/\s+/).filter(w => w.length > 0);
        
        lineWords.forEach((word, wordIndex) => {
            words.push({
                text: word,
                startTime: currentTime,
                duration: timePerWord,
                lineIndex: lineIndex,
                wordIndex: wordIndex,
                isLineStart: wordIndex === 0,
                isLineEnd: wordIndex === lineWords.length - 1
            });
            currentTime += timePerWord;
        });
    });
    
    return words;
}

// Enhanced word timing with emphasis
function generateSmartWordTimings(verse, startTime, duration) {
    const words = [];
    let currentTime = startTime;
    
    // Analyze words for timing weights
    function getWordWeight(word) {
        // Longer words get more time
        let weight = Math.max(word.length / 5, 0.5);
        
        // Punctuation adds pause
        if (word.match(/[,.!?;:]$/)) weight += 0.3;
        if (word.match(/[!?]$/)) weight += 0.2; // Extra for emphasis
        
        // Short common words get less time
        const quickWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to'];
        if (quickWords.includes(word.toLowerCase())) weight *= 0.7;
        
        return weight;
    }
    
    // First pass: calculate total weight
    let totalWeight = 0;
    const wordData = [];
    
    verse.lines.forEach(line => {
        const lineWords = line.split(/\s+/).filter(w => w.length > 0);
        lineWords.forEach(word => {
            const weight = getWordWeight(word);
            wordData.push({ word, weight });
            totalWeight += weight;
        });
    });
    
    // Second pass: assign timings
    const timePerWeight = duration / totalWeight;
    
    let wordIndex = 0;
    verse.lines.forEach((line, lineIndex) => {
        const lineWords = line.split(/\s+/).filter(w => w.length > 0);
        
        lineWords.forEach((word, wordInLineIndex) => {
            const weight = wordData[wordIndex].weight;
            const wordDuration = weight * timePerWeight;
            
            words.push({
                text: word,
                startTime: currentTime,
                duration: wordDuration,
                weight: weight,
                lineIndex: lineIndex,
                wordIndex: wordInLineIndex,
                isLineStart: wordInLineIndex === 0,
                isLineEnd: wordInLineIndex === lineWords.length - 1,
                emphasis: weight > 1.2 ? 'high' : weight < 0.8 ? 'low' : 'normal'
            });
            
            currentTime += wordDuration;
            wordIndex++;
        });
    });
    
    return words;
}

// Karaoke display modes
function generateKaraokeDisplay(words, currentTime) {
    const displays = {
        // Mode 1: Highlight current word
        wordHighlight: words.map(w => ({
            text: w.text,
            active: currentTime >= w.startTime && currentTime < w.startTime + w.duration,
            upcoming: currentTime < w.startTime && currentTime > w.startTime - 1
        })),
        
        // Mode 2: Progressive fill (like traditional karaoke)
        progressiveFill: words.map(w => {
            if (currentTime < w.startTime) return { text: w.text, fill: 0 };
            if (currentTime > w.startTime + w.duration) return { text: w.text, fill: 100 };
            const progress = (currentTime - w.startTime) / w.duration;
            return { text: w.text, fill: Math.round(progress * 100) };
        }),
        
        // Mode 3: Bounce ball (word-by-word)
        bounceBall: {
            activeWordIndex: words.findIndex(w => 
                currentTime >= w.startTime && currentTime < w.startTime + w.duration
            ),
            words: words.map(w => w.text)
        }
    };
    
    return displays;
}

// Validation: Check sync quality
function validateSync(words, audioFeatures = null) {
    const issues = [];
    const stats = {
        totalWords: words.length,
        avgWordDuration: 0,
        minWordDuration: Infinity,
        maxWordDuration: 0,
        rapidWords: 0,
        slowWords: 0
    };
    
    // Calculate statistics
    let totalDuration = 0;
    words.forEach((word, index) => {
        totalDuration += word.duration;
        stats.minWordDuration = Math.min(stats.minWordDuration, word.duration);
        stats.maxWordDuration = Math.max(stats.maxWordDuration, word.duration);
        
        // Check for too rapid words (< 0.15s)
        if (word.duration < 0.15) {
            stats.rapidWords++;
            issues.push({
                type: 'rapid',
                wordIndex: index,
                word: word.text,
                duration: word.duration
            });
        }
        
        // Check for too slow words (> 1.5s)
        if (word.duration > 1.5) {
            stats.slowWords++;
            issues.push({
                type: 'slow',
                wordIndex: index,
                word: word.text,
                duration: word.duration
            });
        }
    });
    
    stats.avgWordDuration = totalDuration / words.length;
    
    // Check for unnatural transitions
    for (let i = 1; i < words.length; i++) {
        const ratio = words[i].duration / words[i-1].duration;
        if (ratio > 3 || ratio < 0.33) {
            issues.push({
                type: 'unnatural_transition',
                from: words[i-1].text,
                to: words[i].text,
                ratio: ratio
            });
        }
    }
    
    return { stats, issues };
}

// Test with sample verse
const sampleVerse = {
    type: 'verse',
    singer: 'player',
    lines: [
        'In a bathroom cabinet high',
        'Where the cleaning supplies lie',
        'Lived a tissue box so brave',
        'Captain Tissue, soft and suave!'
    ]
};

console.log('📝 Sample Verse:');
sampleVerse.lines.forEach(line => console.log(`   "${line}"`));
console.log('\n');

// Test basic word timing
console.log('🔤 Basic Word Timing:');
const basicWords = generateWordTimings(sampleVerse, 0, 18);
console.log(`Total words: ${basicWords.length}`);
console.log(`Time per word: ${(18 / basicWords.length).toFixed(2)}s`);
console.log('\nFirst 5 words:');
basicWords.slice(0, 5).forEach(w => {
    console.log(`  "${w.text}" - ${w.startTime.toFixed(2)}s to ${(w.startTime + w.duration).toFixed(2)}s`);
});

// Test smart word timing
console.log('\n\n🧠 Smart Word Timing (with emphasis):');
const smartWords = generateSmartWordTimings(sampleVerse, 0, 18);
console.log('\nWord weights:');
smartWords.slice(0, 8).forEach(w => {
    console.log(`  "${w.text}" - weight: ${w.weight.toFixed(2)}, emphasis: ${w.emphasis}`);
});

// Test display modes at different times
console.log('\n\n📺 Display Modes at t=5s:');
const displays = generateKaraokeDisplay(smartWords, 5);
console.log('\nWord Highlight Mode:');
const activeWords = displays.wordHighlight.filter(w => w.active || w.upcoming);
activeWords.forEach(w => {
    console.log(`  ${w.active ? '🎤' : '⏳'} "${w.text}"`);
});

// Validate sync
console.log('\n\n✅ Sync Validation:');
const validation = validateSync(smartWords);
console.log('Statistics:');
console.log(`  Average word duration: ${validation.stats.avgWordDuration.toFixed(2)}s`);
console.log(`  Min/Max duration: ${validation.stats.minWordDuration.toFixed(2)}s / ${validation.stats.maxWordDuration.toFixed(2)}s`);
console.log(`  Rapid words: ${validation.stats.rapidWords}`);
console.log(`  Slow words: ${validation.stats.slowWords}`);

if (validation.issues.length > 0) {
    console.log('\nIssues found:');
    validation.issues.slice(0, 5).forEach(issue => {
        console.log(`  - ${issue.type}: ${JSON.stringify(issue)}`);
    });
}

// Generate HTML preview
const htmlPreview = `
<!DOCTYPE html>
<html>
<head>
    <style>
        .word { 
            display: inline-block; 
            margin: 0 4px;
            transition: all 0.2s ease;
        }
        .word.active { 
            color: #ff006e;
            font-weight: bold;
            transform: scale(1.2);
        }
        .word.upcoming { 
            color: #9d4edd;
        }
        .word.done { 
            color: #666;
        }
        .progress-word {
            display: inline-block;
            margin: 0 4px;
            position: relative;
            background: linear-gradient(to right, 
                #ff006e 0%, 
                #ff006e var(--fill), 
                #333 var(--fill), 
                #333 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
    </style>
</head>
<body>
    <h2>Word-Level Karaoke Preview</h2>
    <div id="display"></div>
    <script>
        const words = ${JSON.stringify(smartWords)};
        let currentTime = 0;
        
        function render() {
            const display = document.getElementById('display');
            display.innerHTML = words.map((w, i) => {
                const isActive = currentTime >= w.startTime && currentTime < w.startTime + w.duration;
                const isDone = currentTime >= w.startTime + w.duration;
                const isUpcoming = currentTime < w.startTime && currentTime > w.startTime - 1;
                
                let className = 'word';
                if (isActive) className += ' active';
                else if (isDone) className += ' done';
                else if (isUpcoming) className += ' upcoming';
                
                return \`<span class="\${className}">\${w.text}</span>\${w.isLineEnd ? '<br>' : ''}\`;
            }).join('');
        }
        
        setInterval(() => {
            currentTime += 0.1;
            if (currentTime > 18) currentTime = 0;
            render();
        }, 100);
        
        render();
    </script>
</body>
</html>
`;

fs.writeFileSync('word-level-preview.html', htmlPreview);

// Save all results
const results = {
    basicWords,
    smartWords,
    validation,
    displayModes: Object.keys(displays)
};

fs.writeFileSync(
    'word-level-sync-results.json',
    JSON.stringify(results, null, 2)
);

console.log('\n\n💡 Key Insights:');
console.log('=' .repeat(60));
console.log('1. Word-level timing provides smoother experience');
console.log('2. Smart weighting based on word length/punctuation improves natural feel');
console.log('3. Multiple display modes suit different user preferences');
console.log('4. Validation helps identify problematic timings');
console.log('\n📄 Files generated:');
console.log('   - word-level-preview.html (visual preview)');
console.log('   - word-level-sync-results.json (detailed data)');