# Music Box - Realtime API Setup

## Overview

The Music Box game now uses OpenAI's Realtime API for accurate, real-time laughter detection during performances. This approach is much more robust than the previous transcription-based method.

## How It Works

1. **Real-time Audio Streaming**: When a player starts their performance, audio is streamed directly from their microphone to the WebSocket server
2. **Realtime API Connection**: The server establishes a connection to OpenAI's Realtime API for each performing player
3. **Function Calling**: The Realtime API is configured with a `report_laughter` function that gets called when laughter is detected
4. **Instant Feedback**: Players receive immediate notification when laughter is detected

## Setting Up the OpenAI API Key

After deployment, you need to set your OpenAI API key in the Lambda environment variables:

### Option 1: Using the provided script
```bash
./set-openai-key.sh YOUR_OPENAI_API_KEY
```

### Option 2: Manual setup
1. Find your Lambda function names:
```bash
aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `music-box-game`)].FunctionName'
```

2. Update each function:
```bash
# For MusicBoxFunction
aws lambda update-function-configuration \
    --function-name YOUR_FUNCTION_NAME \
    --environment "Variables={OPENAI_API_KEY=YOUR_KEY}"

# For WebSocketFunction (preserve existing variables)
aws lambda update-function-configuration \
    --function-name YOUR_WEBSOCKET_FUNCTION_NAME \
    --environment "Variables={OPENAI_API_KEY=YOUR_KEY,NODE_ENV=production,WEBSOCKET_API_ID=YOUR_API_ID,WEBSOCKET_STAGE=production}"
```

## Testing the Realtime API

1. Visit: `https://YOUR_CLOUDFRONT_URL/test-realtime.html`
2. Click "Connect to WebSocket"
3. Click "Start Performance"
4. Try laughing, giggling, or making "ha ha" sounds
5. You should see real-time detection notifications

## Architecture

```
Browser (Microphone)
    ↓ (PCM16 Audio Stream)
WebSocket API Gateway
    ↓
Lambda WebSocket Handler
    ↓
OpenAI Realtime API
    ↓ (Function Call: report_laughter)
Lambda WebSocket Handler
    ↓
Browser (Laughter Detection Alert)
```

## Key Components

- **realtime-laughter-detector.js**: Manages WebSocket connection to OpenAI Realtime API
- **websocket.js**: Lambda handler that coordinates game state and Realtime API connections
- **game.js**: Client-side code that streams audio to the WebSocket

## Advantages Over Transcription

1. **Real-time Detection**: Laughter is detected as it happens, not after recording
2. **Better Accuracy**: The model analyzes actual audio, not just transcribed text
3. **Nuanced Detection**: Can distinguish between different types of laughter
4. **Lower Latency**: No need to wait for recording to finish

## Cost Considerations

The Realtime API uses:
- Audio input: $0.06 per minute
- Text output: $0.24 per million tokens (minimal usage with function calling)

For a typical 30-second performance, costs are approximately $0.03 per player.

## Troubleshooting

1. **No laughter detection**: Check that the OpenAI API key is set correctly in Lambda
2. **WebSocket connection fails**: Verify the WebSocket URL in game.js matches your deployment
3. **Audio not streaming**: Check browser microphone permissions

## Future Enhancements

1. Add visual audio waveform during performance
2. Implement different difficulty levels (sensitivity thresholds)
3. Add replay functionality to review detected laughter moments
4. Support for multiple audio formats beyond PCM16