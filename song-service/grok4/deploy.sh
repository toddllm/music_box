#!/bin/bash

# Enhanced Music Box Karaoke Deployment Script

set -e

echo "🎤 Deploying Enhanced Music Box Karaoke..."

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI not configured. Please run 'aws configure' first."
    exit 1
fi

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=${AWS_DEFAULT_REGION:-us-east-1}

echo "📦 Installing Lambda dependencies..."
cd lambda
npm install
cd ..

echo "🔨 Building SAM application..."
sam build

echo "🚀 Deploying to AWS..."
sam deploy \
    --stack-name karaoke-enhanced-stack \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides \
        "ParameterKey=Region,ParameterValue=$REGION" \
    --resolve-s3 \
    --region $REGION \
    --confirm-changeset

# Get stack outputs
echo "📝 Getting deployment outputs..."
CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
    --stack-name karaoke-enhanced-stack \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
    --output text)

API_URL=$(aws cloudformation describe-stacks \
    --stack-name karaoke-enhanced-stack \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
    --output text)

S3_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name karaoke-enhanced-stack \
    --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' \
    --output text)

# Update frontend with API endpoint
echo "🔧 Updating frontend configuration..."
sed -i.bak "s|YOUR-API-ID.execute-api.us-east-1.amazonaws.com/prod|${API_URL#https://}|g" frontend/karaoke.html
rm frontend/karaoke.html.bak

# Upload frontend to S3
echo "📤 Uploading frontend to S3..."
aws s3 sync frontend/ s3://$S3_BUCKET \
    --exclude "*.DS_Store" \
    --exclude "*.swp" \
    --delete

# Create CloudFront invalidation
echo "🌐 Invalidating CloudFront cache..."
DISTRIBUTION_ID=$(aws cloudfront list-distributions \
    --query "DistributionList.Items[?Comment=='Music Box Karaoke Enhanced Distribution'].Id" \
    --output text)

if [ ! -z "$DISTRIBUTION_ID" ]; then
    aws cloudfront create-invalidation \
        --distribution-id $DISTRIBUTION_ID \
        --paths "/*"
fi

# Update secrets reminder
echo ""
echo "⚠️  IMPORTANT: Update your API keys in AWS Secrets Manager"
echo "Run the following command to update your secrets:"
echo ""
echo "aws secretsmanager update-secret --secret-id karaoke-api-keys --secret-string '{"
echo '  "fal_api_key": "YOUR_FAL_API_KEY",'
echo '  "openai_api_key": "YOUR_OPENAI_API_KEY"'
echo "}'"
echo ""

# Display results
echo "✅ Deployment Complete!"
echo ""
echo "🌐 CloudFront URL: https://$CLOUDFRONT_URL"
echo "🔗 API Gateway URL: $API_URL"
echo "🪣 S3 Bucket: $S3_BUCKET"
echo ""
echo "📝 Next Steps:"
echo "1. Update API keys in Secrets Manager (see command above)"
echo "2. Update OpenAI key in frontend (for production, move to backend)"
echo "3. Test the application at https://$CLOUDFRONT_URL"
echo ""
echo "🎉 Happy Karaoke!"