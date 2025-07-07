#!/bin/bash

# Script to set OpenAI API key for the Music Box Lambda functions

if [ -z "$1" ]; then
    echo "Usage: ./set-openai-key.sh YOUR_OPENAI_API_KEY"
    echo "This will update the OpenAI API key for both Lambda functions"
    exit 1
fi

OPENAI_KEY="$1"

echo "Updating MusicBoxFunction..."
aws lambda update-function-configuration \
    --function-name music-box-game-MusicBoxFunction-* \
    --environment "Variables={OPENAI_API_KEY=$OPENAI_KEY}" \
    --no-cli-pager 2>/dev/null || echo "Failed to update MusicBoxFunction"

echo "Updating WebSocketFunction..."
aws lambda update-function-configuration \
    --function-name music-box-game-WebSocketFunction-* \
    --environment "Variables={OPENAI_API_KEY=$OPENAI_KEY,NODE_ENV=production,WEBSOCKET_API_ID=w4c66zvhz0,WEBSOCKET_STAGE=production}" \
    --no-cli-pager 2>/dev/null || echo "Failed to update WebSocketFunction"

echo "Done! Note: You may need to find the exact Lambda function names and update them manually."
echo "Use: aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `music-box-game`)].FunctionName'"