#!/bin/bash

# Deploy script for Music Box Song Service with DynamoDB

set -e

echo "🎵 Deploying Music Box Song Service with DynamoDB..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build and deploy using SAM
echo "🔨 Building SAM application..."
sam build

echo "🚀 Deploying to AWS..."
sam deploy \
  --stack-name music-box-song-service \
  --capabilities CAPABILITY_IAM \
  --resolve-s3 \
  --parameter-overrides Stage=prod \
  --no-confirm-changeset

# Get the API Gateway URL
API_URL=$(aws cloudformation describe-stacks \
  --stack-name music-box-song-service \
  --query 'Stacks[0].Outputs[?OutputKey==`SongGenerationApi`].OutputValue' \
  --output text)

echo "✅ Deployment complete!"
echo "🌐 API Gateway URL: $API_URL"
echo ""
echo "📝 DynamoDB table created: music-box-karaoke-songs-prod"
echo "🎵 Songs will now be stored on the server and accessible to all users!"
echo ""
echo "Next steps:"
echo "1. Update frontend API URL if needed"
echo "2. Deploy frontend to CloudFront"
echo "3. Test the song storage functionality"