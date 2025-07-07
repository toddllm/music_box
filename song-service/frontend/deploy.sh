#!/bin/bash

# Deploy Music Box Frontend to S3 Static Website
set -e

BUCKET_NAME="music-box-frontend-$(date +%s)"
REGION="us-east-1"
CLOUDFRONT_DIST_ID=""

echo "🚀 Deploying Music Box Frontend..."

# Create S3 bucket for static website hosting
echo "📦 Creating S3 bucket: $BUCKET_NAME"
aws s3 mb "s3://$BUCKET_NAME" --region $REGION

# Configure bucket for static website hosting
echo "🌐 Configuring static website hosting..."
aws s3 website "s3://$BUCKET_NAME" \
    --index-document index.html \
    --error-document index.html

# Disable block public access and set bucket policy for public read access
echo "🔓 Configuring public access..."
aws s3api put-public-access-block \
    --bucket $BUCKET_NAME \
    --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

cat > bucket-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
        }
    ]
}
EOF

aws s3api put-bucket-policy \
    --bucket $BUCKET_NAME \
    --policy file://bucket-policy.json

# Upload frontend files
echo "📤 Uploading frontend files..."
aws s3 sync . "s3://$BUCKET_NAME" \
    --exclude "*.sh" \
    --exclude "*.json" \
    --exclude ".DS_Store" \
    --cache-control "max-age=86400"

# Set correct content types
aws s3 cp index.html "s3://$BUCKET_NAME/index.html" \
    --content-type "text/html" \
    --cache-control "max-age=3600"

aws s3 cp styles.css "s3://$BUCKET_NAME/styles.css" \
    --content-type "text/css" \
    --cache-control "max-age=86400"

aws s3 cp app.js "s3://$BUCKET_NAME/app.js" \
    --content-type "application/javascript" \
    --cache-control "max-age=86400"

# Get website URL
WEBSITE_URL="http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"

echo "✅ Frontend deployed successfully!"
echo "🌍 Website URL: $WEBSITE_URL"
echo "📝 Bucket name: $BUCKET_NAME"

# Save deployment info
cat > deployment-info.json << EOF
{
    "bucketName": "$BUCKET_NAME",
    "websiteUrl": "$WEBSITE_URL",
    "region": "$REGION",
    "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "💾 Deployment info saved to deployment-info.json"

# Clean up temporary files
rm -f bucket-policy.json

echo "🎉 Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Visit: $WEBSITE_URL"
echo "2. Test song generation"
echo "3. Verify user profiles work"
echo "4. Check audio playback"