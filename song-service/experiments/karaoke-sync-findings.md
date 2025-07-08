# Karaoke Sync Investigation Findings

## Current Issues Identified

### 1. Player Lyrics Not Displaying
- **Root Cause**: The timing calculation in the frontend is not properly handling line-by-line updates
- **Current Behavior**: Only shows lyrics during AI (Zeldina) parts
- **Impact**: Players can't see what they need to sing

### 2. Sync Timing Problems
- **Issue**: Verse-level timing is too coarse-grained
- **Current**: Each verse is treated as a single unit (e.g., 18 seconds for 4 lines)
- **Result**: Lyrics don't match the actual singing pace

### 3. No Visual Preparation
- **Issue**: Player lyrics appear exactly when they should start singing
- **Need**: 2-3 second preview time for players to read ahead

## POC Experiments Created

### 1. **karaoke-sync-analyzer.js**
- Analyzes current timing structure
- Identifies gaps, overlaps, and coverage issues
- Found: Captain Tissue has 98.4% coverage (good), but timing is still off

### 2. **karaoke-sync-visual-test.html**
- Visual timeline showing verse blocks
- Real-time playhead and debugging
- Reveals: The issue is not gaps, but granularity

### 3. **timing-extraction-poc.js**
- Tests 5 different timing methods:
  1. Even distribution
  2. Weighted by line length
  3. With transition gaps
  4. With player preparation time ⭐
  5. Syllable-based timing ⭐

### 4. **word-level-sync-poc.js**
- Implements word-by-word timing
- Smart weighting based on word characteristics
- Multiple display modes (highlight, progressive fill, bounce ball)

## Immediate Fixes Recommended

### 1. Fix Player Lyrics Display (Quick Win)
```javascript
// In updateCurrentLine function
function updateCurrentLine(verseTime, verseDuration) {
    const verse = this.currentSong.lyrics.verses[this.currentVerseIndex];
    const lineCount = verse.lines.length;
    const timePerLine = verseDuration / lineCount;
    const currentLineIndex = Math.floor(verseTime / timePerLine);
    
    // Display all lines, highlight current
    document.querySelectorAll('.lyrics-line').forEach((line, index) => {
        line.style.display = 'block'; // Make sure all are visible
        line.classList.toggle('current', index === currentLineIndex);
        line.classList.toggle('next', index === currentLineIndex + 1);
    });
}
```

### 2. Add Preparation Time
- Show player verses 2-3 seconds before their turn
- Add visual countdown or "Get Ready!" indicator
- Overlap display with end of AI singing

### 3. Implement Line-Level Timing
- Instead of treating whole verse as one unit
- Calculate time per line: `verseDuration / lineCount`
- Update highlighting line by line

## Advanced Improvements (Requires AI Models)

### 1. Audio Analysis for Timing
- Use voice activity detection (VAD) to find actual vocal segments
- Models to consider:
  - **Silero VAD**: Lightweight, real-time capable
  - **WebRTC VAD**: Built into browsers
  - **pyannote.audio**: More accurate, Python-based

### 2. Forced Alignment
- Align lyrics to audio automatically
- Models/Tools:
  - **Gentle**: Forced aligner based on Kaldi
  - **Montreal Forced Aligner**: Production-ready
  - **WhisperX**: Uses Whisper + phoneme alignment

### 3. Real-time Pitch Detection (For Tone Matching)
- Track user's pitch in real-time
- Libraries:
  - **PitchDetect.js**: Web-based pitch detection
  - **Aubio**: Comprehensive audio analysis
  - **CREPE**: Neural pitch tracker

## Validation Methods Implemented

### 1. Timing Statistics
- Average time per word/line
- Coverage percentage
- Gap detection

### 2. Visual Timeline
- See verse blocks and gaps
- Playhead shows current position
- Color coding for singers

### 3. Sync Quality Metrics
- Words too fast (<0.15s)
- Words too slow (>1.5s)
- Unnatural transitions

## Next Steps Priority

1. **Immediate** (Do now):
   - Fix player lyrics visibility bug
   - Add 2-second preparation time
   - Implement line-by-line highlighting

2. **Short-term** (This week):
   - Test word-level timing with one song
   - Add visual countdown for player turns
   - Create sync adjustment interface

3. **Medium-term** (With AI help):
   - Integrate VAD for auto-timing
   - Implement forced alignment
   - Add pitch detection groundwork

4. **Long-term** (Future):
   - Real-time tone matching
   - Adaptive sync based on user performance
   - Multi-language support

## Files Created

1. `experiments/karaoke-sync-analyzer.js` - Timing analysis tool
2. `experiments/karaoke-sync-visual-test.html` - Visual debugging interface
3. `experiments/timing-extraction-poc.js` - Different timing algorithms
4. `experiments/word-level-sync-poc.js` - Word-level timing implementation
5. `experiments/sync-analysis-results.json` - Analysis data
6. `experiments/timing-methods-comparison.json` - Method comparisons
7. `experiments/word-level-preview.html` - Word timing preview
8. `experiments/word-level-sync-results.json` - Word timing data

## Recommended Architecture

```
Audio File → VAD Model → Vocal Segments
     ↓
Lyrics Text → Forced Aligner → Word Timings
     ↓
Combined → Karaoke Display Engine → User Interface
     ↑
User Microphone → Pitch Detection → Score/Feedback
```

## Key Insight

The main issue isn't the overall timing structure - it's the granularity. Moving from verse-level to line-level (or word-level) timing will dramatically improve the experience. The preparation time for players is crucial for a good karaoke experience.