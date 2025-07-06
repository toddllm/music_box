# Music Box

A fun multiplayer singing game where players take turns performing - but if you laugh during your performance, you're eliminated! Powered by OpenAI for intelligent laugh detection.

## Features

- Real-time multiplayer gameplay using Socket.IO
- Audio recording and analysis using OpenAI's Whisper and GPT-4
- Automatic laugh detection
- Interactive web interface
- Player elimination system
- Round-based gameplay

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure your OpenAI API key in the `.env` file

3. Start the server:
```bash
node server.js
```

4. Open your browser to `http://localhost:3000`

## Environment Variables

Create a `.env` file with the following:

```
OPENAI_API_KEY=your_openai_api_key_here
PORT=3000
SESSION_SECRET=your_session_secret_here
MAX_PLAYERS=10
ROUND_DURATION=30
```

## How to Play

1. Enter your name to join the game
2. Wait for other players to join (minimum 2 players)
3. When it's your turn, click the record button and sing!
4. Try not to laugh - the AI will detect it!
5. Last player standing wins!

## AWS Deployment

### AWS Secrets Manager Configuration

The game uses AWS Secrets Manager to securely store sensitive configuration. The secret name is:
```
music_box_config
```

This secret contains:
- `OPENAI_API_KEY` - Your OpenAI API key for speech-to-text and laugh detection
- `SESSION_SECRET` - A secure session secret (already generated)
- `PORT` - Server port (default: 3000)
- `MAX_PLAYERS` - Maximum players allowed (default: 10)
- `ROUND_DURATION` - Round duration in seconds (default: 30)

### Setting up AWS Secrets

1. Run the provided script to create the secret:
```bash
./aws-secrets-setup.sh
```

2. To retrieve the secret:
```bash
aws secretsmanager get-secret-value --secret-id music_box_config
```

### Deploying to AWS

1. Install AWS SAM CLI if not already installed:
```bash
pip install aws-sam-cli
```

2. Configure AWS credentials:
```bash
aws configure
```

3. Deploy the application:
```bash
./deploy.sh
```

The deployment script will:
- Build the application using SAM
- Deploy to AWS Lambda with API Gateway
- Create an S3 bucket for static content
- Set up CloudFront distribution
- Output the game URL

### Architecture

The AWS deployment includes:
- **Lambda Function**: Runs the Node.js server
- **API Gateway**: Handles HTTP/WebSocket requests
- **S3 Bucket**: Hosts static files (HTML, CSS, JS)
- **CloudFront**: CDN for global distribution
- **Secrets Manager**: Secure storage for API keys