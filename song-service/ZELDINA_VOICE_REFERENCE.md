# Zeldina Voice Reference

## Overview
Zeldina is the official voice for the Music Box karaoke game. It's a theatrical, expressive female voice that was generated for "The Epic Ballad of Sir Wiggleton the Magnificent Spoon" and will be used as the reference for all other songs.

## Voice Characteristics
- **Gender**: Female
- **Age**: Young adult
- **Style**: Epic, theatrical, expressive
- **Tone**: Heroic, dramatic, storytelling
- **Quality**: Clear vocals with good articulation

## Reference Files
- **Audio File**: `reference-voice-zeldina.wav` (16MB)
- **Source URL**: https://v3.fal.media/files/monkey/C2_gjTrYLMk1hz9KF5vN2_output.wav
- **Original Song**: The Epic Ballad of Sir Wiggleton the Magnificent Spoon

## Technical Implementation

### Using with DiffRhythm
DiffRhythm supports voice cloning via the `reference_audio_url` parameter:

```javascript
{
  "model": "fal-ai/diffrhythm",
  "lyrics": "[00:00.00]Your timestamped lyrics here...",
  "style_prompt": "epic orchestral",
  "reference_audio_url": "https://v3.fal.media/files/monkey/C2_gjTrYLMk1hz9KF5vN2_output.wav"
}
```

### Lambda Integration
The Fal Singing Lambda now uses Zeldina as the default voice reference for all DiffRhythm generations unless a custom reference URL is provided.

## Performance Notes
- Using voice reference increases generation time (~100s vs ~5s)
- But provides consistent voice characteristics across songs
- Consider caching generated songs to avoid regeneration

## Voice Matching Results
Test results comparing songs with and without Zeldina reference:
- With reference: Longer generation but voice characteristics match
- Without reference: Faster but voice may vary

## Future Enhancements
1. Extract voice embeddings for faster matching
2. Create voice profiles for different characters
3. Test ACE-Step for adding Zeldina vocals to instrumentals