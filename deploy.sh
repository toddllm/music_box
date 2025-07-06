#!/bin/bash

# Music Box AWS Deployment Script

echo "🎵 Deploying Music Box to AWS..."

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI is not configured. Please run 'aws configure' first."
    exit 1
fi

# Set variables
STACK_NAME="music-box-game"
REGION="us-east-1"
S3_BUCKET_PREFIX="music-box-deployment"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
S3_BUCKET="${S3_BUCKET_PREFIX}-${ACCOUNT_ID}"

# Create S3 bucket for deployment if it doesn't exist
echo "📦 Creating deployment S3 bucket..."
aws s3 mb s3://${S3_BUCKET} --region ${REGION} 2>/dev/null || true

# Build the application
echo "🔨 Building application..."
sam build

# Deploy using SAM
echo "🚀 Deploying to AWS..."
sam deploy \
    --stack-name ${STACK_NAME} \
    --s3-bucket ${S3_BUCKET} \
    --capabilities CAPABILITY_IAM \
    --region ${REGION} \
    --parameter-overrides Environment=production \
    --no-confirm-changeset

# Get outputs
echo "📋 Getting deployment outputs..."
API_URL=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
    --output text \
    --region ${REGION})

CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
    --output text \
    --region ${REGION})

S3_BUCKET_NAME=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' \
    --output text \
    --region ${REGION})

# Upload static files to S3
echo "📤 Uploading static files to S3..."
aws s3 sync ./public s3://${S3_BUCKET_NAME} --delete

echo "✅ Deployment complete!"
echo ""
echo "🌐 Your Music Box game is available at:"
echo "   CloudFront URL: https://${CLOUDFRONT_URL}"
echo "   API Gateway URL: ${API_URL}"
echo ""
echo "🔐 Make sure to run ./aws-secrets-setup.sh if you haven't already!"