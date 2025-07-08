# Voice Cloning Guide for Music Box

## Overview
This guide documents the voice cloning process using DiffRhythm with the Zeldina voice reference. Voice cloning ensures consistent vocal characteristics across all Music Box songs.

## Key Decision: Voice Reference is Worth It ✅
After testing, we confirmed that using the voice reference produces significantly better results:
- **With Reference**: Consistent Zeldina voice across all songs
- **Without Reference**: Variable voice quality and characteristics
- **Trade-off**: ~100s generation time vs ~5s, but quality justifies the wait

## The Zeldina Voice
- **Reference File**: `reference-voice-zeldina.wav`
- **URL**: `https://v3.fal.media/files/monkey/C2_gjTrYLMk1hz9KF5vN2_output.wav`
- **Characteristics**: Female, theatrical, expressive, epic storytelling voice
- **Source**: "The Epic Ballad of Sir Wiggleton the Magnificent Spoon"

## Implementation

### 1. Basic Voice Cloning Request
```javascript
const { fal } = require('@fal-ai/client');

// Zeldina voice reference URL
const ZELDINA_VOICE_URL = 'https://v3.fal.media/files/monkey/C2_gjTrYLMk1hz9KF5vN2_output.wav';

// Generate song with Zeldina's voice
const result = await fal.subscribe('fal-ai/diffrhythm', {
  input: {
    lyrics: timestampedLyrics,  // Must be in [mm:ss.xx] format
    style_prompt: 'epic orchestral ballad',
    reference_audio_url: ZELDINA_VOICE_URL,
    music_duration: '95s'  // or '285s'
  },
  logs: true,
  onQueueUpdate: (update) => {
    console.log(`Status: ${update.status}`);
  }
});
```

### 2. Lambda Integration
The Fal Singing Lambda automatically uses Zeldina as the default voice:

```javascript
// From fal-singing-lambda.js
if (model === 'fal-ai/diffrhythm') {
  // ... validation code ...
  
  input.lyrics = lyrics;
  input.style_prompt = genres || 'vocal-forward pop';
  
  // Use Zeldina voice reference by default for consistent female voice
  const ZELDINA_VOICE_URL = 'https://v3.fal.media/files/monkey/C2_gjTrYLMk1hz9KF5vN2_output.wav';
  input.reference_audio_url = refUrl || ZELDINA_VOICE_URL;
  
  console.log('Using voice reference:', refUrl ? 'Custom URL' : 'Zeldina (default)');
}
```

### 3. Converting Lyrics to Timestamps
DiffRhythm requires timestamped lyrics for vocals:

```javascript
function convertToTimestamps(lyrics, secondsPerLine = 4.5) {
  const lines = lyrics.split('\n')
    .filter(line => line.trim() && !line.startsWith('[verse]') && !line.startsWith('[chorus]'));
  
  let timestamp = 0;
  return lines.map(line => {
    const mins = Math.floor(timestamp / 60).toString().padStart(2, '0');
    const secs = (timestamp % 60).toFixed(2).padStart(5, '0');
    const result = `[${mins}:${secs}]${line}`;
    timestamp += secondsPerLine;
    return result;
  }).join('\n');
}

// Example usage
const markdownLyrics = `[verse]
In a sneaker dark and deep
Where dirty socks do sometimes sleep`;

const timestamped = convertToTimestamps(markdownLyrics);
// Output:
// [00:00.00]In a sneaker dark and deep
// [00:04.50]Where dirty socks do sometimes sleep
```

### 4. Complete Example: Generate New Song with Zeldina Voice
```javascript
async function generateSongWithZeldina(title, lyricsMarkdown, genres) {
  const ZELDINA_VOICE_URL = 'https://v3.fal.media/files/monkey/C2_gjTrYLMk1hz9KF5vN2_output.wav';
  
  // Convert markdown lyrics to timestamps
  const timestampedLyrics = convertToTimestamps(lyricsMarkdown);
  
  console.log(`🎵 Generating "${title}" with Zeldina's voice...`);
  console.log('⏱️  This will take ~100 seconds for voice cloning...');
  
  try {
    const result = await fal.subscribe('fal-ai/diffrhythm', {
      input: {
        lyrics: timestampedLyrics,
        style_prompt: `${genres}, theatrical female voice like reference`,
        reference_audio_url: ZELDINA_VOICE_URL,
        music_duration: '95s'
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          process.stdout.write('.');
        }
      }
    });
    
    console.log('\n✅ Success!');
    console.log(`🎧 Listen at: ${result.data.audio.url}`);
    
    return {
      title,
      audioUrl: result.data.audio.url,
      duration: result.duration,
      voiceReference: 'Zeldina'
    };
    
  } catch (error) {
    console.error('❌ Generation failed:', error.message);
    throw error;
  }
}

// Usage
await generateSongWithZeldina(
  'The Mysterious Case of the Singing Sandwich',
  `[verse]
  It was a Tuesday, dark and cold
  When the strangest tale was told`,
  'jazz noir mystery detective'
);
```

### 5. API Endpoint Usage
```bash
# Generate with Zeldina voice (default)
curl -X POST https://pd08901pf7.execute-api.us-east-1.amazonaws.com/prod/fal/test \
  -H "Content-Type: application/json" \
  -d '{
    "model": "fal-ai/diffrhythm",
    "lyrics": "[00:00.00]Your first line here\n[00:04.50]Your second line here",
    "genres": "epic orchestral"
  }'

# Generate with custom voice reference
curl -X POST https://pd08901pf7.execute-api.us-east-1.amazonaws.com/prod/fal/test \
  -H "Content-Type: application/json" \
  -d '{
    "model": "fal-ai/diffrhythm",
    "lyrics": "[00:00.00]Your first line here\n[00:04.50]Your second line here",
    "genres": "rock ballad",
    "refUrl": "https://your-custom-voice-url.wav"
  }'
```

## Performance Considerations

### Generation Times
- **With Zeldina Reference**: ~100-120 seconds
- **Without Reference**: ~4-6 seconds
- **Recommendation**: Always use reference for production songs

### Caching Strategy
Since generation takes ~100s, implement caching:
1. Store generated songs in DynamoDB (already implemented)
2. Check cache before regenerating
3. Use consistent song IDs based on lyrics hash

### Batch Generation
For multiple songs, generate in parallel:
```javascript
const songs = [
  { title: 'Song 1', lyrics: '...', genres: 'pop' },
  { title: 'Song 2', lyrics: '...', genres: 'rock' },
  // ...
];

// Generate all songs in parallel with Zeldina voice
const results = await Promise.all(
  songs.map(song => generateSongWithZeldina(song.title, song.lyrics, song.genres))
);
```

## Voice Consistency Tips

1. **Always include voice-related keywords in style_prompt**:
   - "theatrical female voice like reference"
   - "expressive female vocals"
   - "dramatic storytelling voice"

2. **Maintain consistent tempo**: Use 4.5 seconds per line for timestamps

3. **Test new genres**: Some genres may affect voice quality, test before production

4. **Monitor results**: Log and review generated songs to ensure voice consistency

## Troubleshooting

### Voice doesn't match Zeldina
- Ensure `reference_audio_url` is correctly set
- Check that the reference URL is accessible
- Try adding more voice descriptors to `style_prompt`

### Generation times out
- API Gateway has 30s limit, Lambda has 300s
- For long songs, consider async generation with callbacks

### Inconsistent results
- DiffRhythm may have variability even with reference
- Generate multiple versions and pick the best
- Consider fine-tuning the style_prompt

## Future Enhancements

1. **Voice Embedding Extraction**: Extract voice characteristics for faster matching
2. **Multiple Voice Profiles**: Create different character voices
3. **Voice Mixing**: Blend multiple references for unique voices
4. **Quality Scoring**: Automated voice similarity scoring

## Conclusion

Voice cloning with Zeldina reference is the recommended approach for Music Box. The ~100s generation time is worth it for consistent, high-quality vocals across all songs. The theatrical, expressive female voice has become the signature sound of the Music Box game.