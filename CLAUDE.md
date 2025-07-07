# Music Box - Development Guide

## Project Overview
Music Box is a multiplayer singing game where players must sing without laughing. Uses OpenAI APIs for speech-to-text and laugh detection.

## AWS Secrets Configuration
All sensitive configuration is stored in AWS Secrets Manager with the prefix `music_box_`:
- Secret name: `music_box_config`
- Contains: OPENAI_API_KEY, SESSION_SECRET, PORT, MAX_PLAYERS, ROUND_DURATION

## Key Commands
- `npm start` - Run the server locally
- `./aws-secrets-setup.sh` - Create AWS secrets
- `./deploy.sh` - Deploy to AWS

## Architecture
- Node.js WebSocket server for real-time audio streaming
- OpenAI Realtime API with GPT-4o for direct audio laughter detection
- AWS ECS Fargate for persistent WebSocket connections
- Application Load Balancer with WebSocket support
- CloudFront + S3 for static content delivery

## OpenAI Realtime API Configuration

**Model**: `gpt-4o-realtime-preview-2024-12-17`
- Real-time audio streaming via WebSocket
- Direct audio analysis without transcription
- Function calling for laughter detection
- Low latency (~300ms)

**THIS IS THE WHOLE POINT OF OUR WEBSOCKET INFRASTRUCTURE!**
The Realtime API requires:
1. Persistent WebSocket connection to OpenAI
2. Audio streaming in PCM16 format
3. Server-side relay between client and OpenAI
4. Function calling to report laughter events

## Testing
Before deployment:
1. Test locally with `npm start`
2. Verify OpenAI API key is working
3. Check WebSocket connections