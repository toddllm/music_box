# Music Box Karaoke - Enhanced Edition

This is an improved version of the Music Box Karaoke game featuring:
- AI-generated songs with true singing vocals (via Fal.ai DiffRhythm)
- Real-time laughter detection using OpenAI's GPT-4o realtime API
- Emotion-adaptive music generation
- Word-level karaoke synchronization
- Serverless AWS deployment

## Features

### 🎵 Core Features
- **AI Singing Voice Generation**: Uses Fal.ai's DiffRhythm model to generate songs with actual vocals
- **Laughter Detection**: Real-time detection triggers penalties when players laugh
- **Emotion Control**: Songs adapt to selected emotions (happy, excited, calm, dramatic, sad)
- **Timestamped Lyrics**: LRC format with precise word-level synchronization
- **Song Library**: DynamoDB storage with 30-day TTL

### 🏗️ Architecture
- **Frontend**: S3-hosted SPA with CloudFront CDN
- **Backend**: Lambda functions with API Gateway
- **Storage**: DynamoDB for metadata, audio URLs from Fal.ai CDN
- **Security**: Secrets Manager for API keys, OAI for S3 access

## Setup Instructions

### Prerequisites
- AWS CLI configured with appropriate credentials
- AWS SAM CLI installed
- Node.js 20.x or later
- Fal.ai API key
- OpenAI API key

### Deployment

1. **Clone and navigate to the grok4 directory**:
   ```bash
   cd grok4
   ```

2. **Run the deployment script**:
   ```bash
   ./deploy.sh
   ```

3. **Update API keys in AWS Secrets Manager**:
   ```bash
   aws secretsmanager update-secret --secret-id karaoke-api-keys --secret-string '{
     "fal_api_key": "YOUR_FAL_API_KEY",
     "openai_api_key": "YOUR_OPENAI_API_KEY"
   }'
   ```

4. **Update the OpenAI key in the frontend** (for demo purposes - move to backend for production):
   - Edit `frontend/karaoke.html`
   - Replace `YOUR-OPENAI-KEY` with your actual key

5. **Access your application** at the CloudFront URL provided by the deployment script

## API Endpoints

### POST /generate
Generate a new song with vocals.

Request body:
```json
{
  "prompt": "A silly song about a rubber duck",
  "style": "disco",
  "duration": 30,
  "emotion": "happy"
}
```

Response:
```json
{
  "id": "uuid",
  "audioUrl": "https://...",
  "lyrics": "[00:00.00] First line...",
  "parsedLyrics": [
    {
      "timestamp": 0,
      "text": "First line",
      "emotion": "happy"
    }
  ],
  "title": "Disco song about A silly song about a rubber duck"
}
```

### GET /songs
Get all songs from the library.

### GET /songs/{id}
Get a specific song by ID.

## Technical Details

### Voice Generation (Fal.ai DiffRhythm)
- Model: `fal-ai/diffrhythm`
- Latency: ~20-30 seconds
- Features: Lyrics-to-song with vocals
- Commercial use: Yes (with API key)

### Laughter Detection (OpenAI Realtime)
- Model: `gpt-4o-realtime-preview`
- Method: WebSocket streaming with function calling
- Latency: ~300ms
- Audio format: 16-bit PCM

### Lyrics Synchronization
- Format: LRC (Lyric) with timestamps
- Parsing: Client-side with 100ms update interval
- Display: Current line highlighted, context shown

## Cost Considerations

- **Fal.ai**: ~$0.10-0.20 per song generation
- **OpenAI**: ~$0.06/minute for realtime API
- **AWS**: 
  - Lambda: ~$0.0000002 per request
  - DynamoDB: ~$0.25/GB-month
  - CloudFront: ~$0.085/GB transfer

## Future Enhancements

1. **Audio Analysis Integration**:
   - Pyannote for better VAD
   - WhisperX for precise alignment

2. **Advanced Features**:
   - Multiplayer duets
   - Voice cloning for personalization
   - Score tracking and leaderboards

3. **Performance Optimizations**:
   - WebAssembly audio processing
   - Edge computing for lower latency
   - Predictive caching

## Troubleshooting

### Common Issues

1. **Song generation fails**:
   - Check Fal.ai API key in Secrets Manager
   - Verify Lambda has internet access
   - Check CloudWatch logs

2. **Laughter detection not working**:
   - Ensure microphone permissions granted
   - Check OpenAI API key
   - Verify WebSocket connection in browser console

3. **Lyrics out of sync**:
   - Check audio file loading
   - Verify timestamp parsing
   - Clear browser cache

### Debug Mode
Open browser console and look for:
- WebSocket connection status
- Audio streaming logs
- API response times

## Contributing

This is an experimental project showcasing modern AI capabilities for interactive entertainment. Contributions welcome!

## License

MIT License - See LICENSE file for details

## Acknowledgments

- Fal.ai for the DiffRhythm model
- OpenAI for GPT-4o realtime API
- AWS for serverless infrastructure