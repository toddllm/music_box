# Music Box Debugging Guide

## Enhanced Debug Logging

The application now includes comprehensive debugging at every level to help diagnose issues with the Realtime API implementation.

## Client-Side Debugging (Browser)

### 1. Test Page Debug Panel
Visit `https://dxhq2y7asz0vd.cloudfront.net/test-realtime.html`

The page now includes a Debug Log panel that shows:
- All WebSocket messages sent and received
- Audio chunk statistics (every 10th chunk)
- Connection status updates
- Error messages with details

### 2. Browser Console
Open Developer Tools (F12) and look for messages prefixed with:
- `[Realtime API]` - Messages from the Realtime API client
- `Received:` - WebSocket messages from server
- `Sent:` - WebSocket messages to server

## Server-Side Debugging (Lambda)

### 1. WebSocket Handler Logs
The WebSocket Lambda function logs:
- `[WebSocket]` - All WebSocket handler operations
- Connection events (join-game, startPerformance, etc.)
- Audio data reception statistics
- Realtime API connection status

### 2. Realtime API Client Logs
The realtime-laughter-detector.js module logs:
- `[Realtime API]` - All Realtime API operations
- Session creation and configuration
- Audio chunk transmission details
- Laughter detection events
- All message types received from OpenAI

## Viewing Server Logs

Use the provided script:
```bash
./check-logs.sh
```

Or manually via AWS CLI:
```bash
# Find the function name
aws lambda list-functions --query "Functions[?contains(FunctionName, 'WebSocket')].FunctionName"

# View logs
aws logs tail /aws/lambda/YOUR_FUNCTION_NAME --follow
```

## What Each Debug Message Means

### Client-Side Messages

1. **"Sent: join-game"** - Player joining the game
2. **"Received: player-joined"** - Server confirmed player joined
3. **"Sent: startPerformance"** - Starting audio streaming
4. **"Sent audio chunk #X"** - Audio being streamed (every 10 chunks)
5. **"Received: laughterDetected"** - Laughter was detected!

### Server-Side Messages

1. **"[WebSocket] Starting performance for connection"** - Performance tracking initiated
2. **"[WebSocket] Creating Realtime API detector"** - Setting up OpenAI connection
3. **"[WebSocket] Received audio data"** - Audio chunks arriving from client
4. **"[Realtime API] WebSocket connected to OpenAI"** - Connected to OpenAI
5. **"[Realtime API] Session created successfully"** - Ready to process audio
6. **"[Realtime API] Sending audio chunk"** - Audio forwarded to OpenAI
7. **"[Realtime API] Audio transcribed"** - Whisper transcription result
8. **"[Realtime API] 🎉 LAUGHTER DETECTED!"** - Function call triggered

## Common Issues and Solutions

### Issue: "OPENAI_API_KEY not set!"
**Solution**: Set the API key using the provided script:
```bash
./set-openai-key.sh YOUR_OPENAI_API_KEY
```

### Issue: No audio chunks being sent
**Debug**: Check browser console for:
- Microphone permission errors
- AudioContext creation failures
- WebSocket connection status

### Issue: Audio sent but no detection
**Debug**: Check server logs for:
- Realtime API connection status
- Audio chunk reception
- Any error messages from OpenAI

### Issue: WebSocket disconnects frequently
**Debug**: Check:
- Network stability
- Lambda timeout settings (should be 60s)
- CloudWatch logs for errors

## Testing Workflow

1. Open the test page
2. Open browser Developer Tools (F12)
3. Click "Connect to WebSocket"
4. Verify connection in Debug Log
5. Click "Start Performance"
6. Try different sounds:
   - Laugh naturally
   - Say "ha ha ha"
   - Giggle or chuckle
   - Make breathing sounds
7. Watch Debug Log for detection events
8. If no detection, check server logs with `./check-logs.sh`

## Audio Format Details

The system expects:
- **Sample Rate**: 16kHz
- **Format**: PCM16 (16-bit signed integers)
- **Channels**: Mono (1 channel)
- **Chunk Size**: 4096 samples (256ms of audio)

Each debug message shows:
- `bufferLength`: Raw byte size
- `sampleSize`: Number of audio samples
- `durationMs`: Duration in milliseconds

## Performance Metrics

Monitor these metrics in the debug output:
- Audio chunk transmission rate (should be ~4 chunks/second)
- Latency between audio and detection
- WebSocket message round-trip time
- Realtime API response time