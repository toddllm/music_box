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
- Node.js/Express backend with Socket.IO for real-time communication
- OpenAI Whisper API for speech-to-text
- GPT-4 for laugh detection analysis
- AWS Lambda + API Gateway for serverless deployment
- CloudFront + S3 for static content delivery

## Testing
Before deployment:
1. Test locally with `npm start`
2. Verify OpenAI API key is working
3. Check WebSocket connections