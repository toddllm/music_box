# Voice Cloning Integration Guide

## Quick Start

### 1. Frontend Integration (JavaScript)
```javascript
// Simple API call with automatic Zeldina voice
async function generateSong(lyrics, genres) {
  const response = await fetch('https://pd08901pf7.execute-api.us-east-1.amazonaws.com/prod/fal/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'fal-ai/diffrhythm',
      lyrics: convertToTimestamps(lyrics),  // Must be timestamped!
      genres: genres
    })
  });
  
  const data = await response.json();
  if (data.success) {
    // Play the audio
    const audio = new Audio(data.audioUrl);
    audio.play();
  }
}
```

### 2. Backend Integration (Node.js)
```javascript
const { fal } = require('@fal-ai/client');

// Initialize once
fal.config({ credentials: process.env.FAL_API_KEY });

// Generate with Zeldina voice
async function generateWithVoice(lyrics, style) {
  return await fal.subscribe('fal-ai/diffrhythm', {
    input: {
      lyrics: lyrics,  // Must be timestamped [mm:ss.xx]
      style_prompt: style,
      reference_audio_url: 'https://v3.fal.media/files/monkey/C2_gjTrYLMk1hz9KF5vN2_output.wav',
      music_duration: '95s'
    }
  });
}
```

### 3. Python Integration
```python
import requests
import json

ZELDINA_VOICE_URL = 'https://v3.fal.media/files/monkey/C2_gjTrYLMk1hz9KF5vN2_output.wav'
API_ENDPOINT = 'https://pd08901pf7.execute-api.us-east-1.amazonaws.com/prod/fal/test'

def generate_song_with_zeldina(lyrics_timestamped, genres):
    """Generate a song with Zeldina's voice"""
    
    payload = {
        'model': 'fal-ai/diffrhythm',
        'lyrics': lyrics_timestamped,
        'genres': genres
    }
    
    response = requests.post(API_ENDPOINT, json=payload)
    data = response.json()
    
    if data['success']:
        print(f"✅ Generated: {data['audioUrl']}")
        return data['audioUrl']
    else:
        print(f"❌ Error: {data['error']}")
        return None

def convert_to_timestamps(lyrics, seconds_per_line=4.5):
    """Convert plain lyrics to timestamped format"""
    lines = [l.strip() for l in lyrics.split('\n') if l.strip() and not l.startswith('[')]
    
    timestamped = []
    timestamp = 0.0
    
    for line in lines:
        mins = int(timestamp // 60)
        secs = timestamp % 60
        timestamped.append(f"[{mins:02d}:{secs:05.2f}]{line}")
        timestamp += seconds_per_line
    
    return '\n'.join(timestamped)
```

### 4. cURL Command Line
```bash
# Generate with Zeldina voice (automatic)
curl -X POST https://pd08901pf7.execute-api.us-east-1.amazonaws.com/prod/fal/test \
  -H "Content-Type: application/json" \
  -d '{
    "model": "fal-ai/diffrhythm",
    "lyrics": "[00:00.00]First line of your song\n[00:04.50]Second line here",
    "genres": "epic orchestral"
  }'

# Generate with custom voice
curl -X POST https://pd08901pf7.execute-api.us-east-1.amazonaws.com/prod/fal/test \
  -H "Content-Type: application/json" \
  -d '{
    "model": "fal-ai/diffrhythm",
    "lyrics": "[00:00.00]First line of your song\n[00:04.50]Second line here",
    "genres": "rock ballad",
    "refUrl": "https://your-custom-voice.wav"
  }'
```

### 5. React Component Example
```jsx
import React, { useState } from 'react';

const SongGenerator = () => {
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  
  const convertToTimestamps = (lyrics) => {
    const lines = lyrics.split('\n').filter(l => l.trim());
    let timestamp = 0;
    
    return lines.map(line => {
      const time = `[${Math.floor(timestamp / 60).toString().padStart(2, '0')}:${(timestamp % 60).toFixed(2).padStart(5, '0')}]${line}`;
      timestamp += 4.5;
      return time;
    }).join('\n');
  };
  
  const generateSong = async (lyrics, genres) => {
    setLoading(true);
    
    try {
      const response = await fetch('https://pd08901pf7.execute-api.us-east-1.amazonaws.com/prod/fal/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'fal-ai/diffrhythm',
          lyrics: convertToTimestamps(lyrics),
          genres: genres
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAudioUrl(data.audioUrl);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert(`Failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      <button onClick={() => generateSong('Your lyrics here', 'pop ballad')}>
        {loading ? 'Generating (100s)...' : 'Generate with Zeldina Voice'}
      </button>
      
      {audioUrl && (
        <audio controls autoPlay>
          <source src={audioUrl} type="audio/wav" />
        </audio>
      )}
    </div>
  );
};
```

## Important Notes

1. **Timestamps are REQUIRED** for vocals - use `[mm:ss.xx]` format
2. **Generation takes ~100 seconds** with voice reference
3. **Zeldina voice is applied automatically** by the Lambda
4. **Cache generated songs** to avoid regeneration
5. **Use style_prompt wisely** - include voice descriptors like "theatrical female voice"

## Error Handling

```javascript
// Robust error handling example
async function generateSongSafely(lyrics, genres, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'fal-ai/diffrhythm',
          lyrics: convertToTimestamps(lyrics),
          genres: genres
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        return data;
      } else if (data.error.includes('timestamp')) {
        throw new Error('Lyrics must be timestamped for vocals');
      } else {
        throw new Error(data.error);
      }
      
    } catch (error) {
      console.log(`Attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}
```

## Performance Tips

1. **Batch Generation**: Generate multiple songs in parallel
2. **Progress Indication**: Show progress during 100s wait
3. **Pregenerate**: Generate popular songs in advance
4. **Cache Aggressively**: Store in DynamoDB with TTL
5. **Fallback Options**: Have instrumental versions ready

## Support

- API Issues: Check Lambda logs in CloudWatch
- Voice Quality: Ensure reference URL is accessible
- Generation Time: Normal is 90-120 seconds with voice
- Lyrics Format: Must be timestamped for vocals