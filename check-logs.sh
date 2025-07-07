#!/bin/bash

# Script to check CloudWatch logs for the Music Box WebSocket function

echo "Finding WebSocket Lambda function name..."
FUNCTION_NAME=$(aws lambda list-functions --query "Functions[?contains(FunctionName, 'music-box-game-WebSocketFunction')].FunctionName" --output text)

if [ -z "$FUNCTION_NAME" ]; then
    echo "WebSocket function not found!"
    exit 1
fi

echo "Found function: $FUNCTION_NAME"
echo "Fetching latest logs..."

# Get the latest log stream
LOG_GROUP="/aws/lambda/$FUNCTION_NAME"
LATEST_STREAM=$(aws logs describe-log-streams \
    --log-group-name "$LOG_GROUP" \
    --order-by LastEventTime \
    --descending \
    --limit 1 \
    --query 'logStreams[0].logStreamName' \
    --output text)

if [ -z "$LATEST_STREAM" ]; then
    echo "No log streams found!"
    exit 1
fi

echo "Latest log stream: $LATEST_STREAM"
echo "========================================="

# Get the last 50 log events
aws logs get-log-events \
    --log-group-name "$LOG_GROUP" \
    --log-stream-name "$LATEST_STREAM" \
    --limit 50 \
    --query 'events[*].message' \
    --output text | grep -E "\[WebSocket\]|\[Realtime API\]|ERROR|Error" || echo "No relevant logs found"