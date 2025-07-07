#!/bin/bash

# Deploy Music Box Frontend to CloudFront with HTTPS
set -e

BUCKET_NAME="music-box-frontend-$(date +%s)"
REGION="us-east-1"

echo "🚀 Deploying Music Box Frontend to CloudFront with HTTPS..."

# Create S3 bucket for CloudFront origin
echo "📦 Creating S3 bucket: $BUCKET_NAME"
aws s3 mb "s3://$BUCKET_NAME" --region $REGION

# Configure bucket for CloudFront (no public access needed)
echo "🔒 Configuring bucket for CloudFront origin access..."
aws s3api put-public-access-block \
    --bucket $BUCKET_NAME \
    --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Upload frontend files
echo "📤 Uploading frontend files..."
aws s3 sync . "s3://$BUCKET_NAME" \
    --exclude "*.sh" \
    --exclude "*.json" \
    --exclude ".DS_Store" \
    --cache-control "max-age=86400"

# Set correct content types and caching
aws s3 cp index.html "s3://$BUCKET_NAME/index.html" \
    --content-type "text/html" \
    --cache-control "max-age=3600"

aws s3 cp styles.css "s3://$BUCKET_NAME/styles.css" \
    --content-type "text/css" \
    --cache-control "max-age=86400"

aws s3 cp app.js "s3://$BUCKET_NAME/app.js" \
    --content-type "application/javascript" \
    --cache-control "max-age=86400"

# Create CloudFront Origin Access Control
echo "🛡️ Creating CloudFront Origin Access Control..."
OAC_ID=$(aws cloudfront create-origin-access-control \
    --origin-access-control-config '{
        "Name": "music-box-oac-'$(date +%s)'",
        "Description": "OAC for Music Box Frontend",
        "OriginAccessControlOriginType": "s3",
        "SigningBehavior": "always",
        "SigningProtocol": "sigv4"
    }' \
    --query 'OriginAccessControl.Id' \
    --output text)

echo "✅ Created OAC: $OAC_ID"

# Create CloudFront distribution
echo "☁️ Creating CloudFront distribution..."
DISTRIBUTION_CONFIG='{
    "CallerReference": "music-box-'$(date +%s)'",
    "Comment": "Music Box Frontend Distribution",
    "DefaultRootObject": "index.html",
    "Origins": {
        "Quantity": 1,
        "Items": [
            {
                "Id": "S3-'$BUCKET_NAME'",
                "DomainName": "'$BUCKET_NAME'.s3.amazonaws.com",
                "S3OriginConfig": {
                    "OriginAccessIdentity": ""
                },
                "OriginAccessControlId": "'$OAC_ID'"
            }
        ]
    },
    "DefaultCacheBehavior": {
        "TargetOriginId": "S3-'$BUCKET_NAME'",
        "ViewerProtocolPolicy": "redirect-to-https",
        "TrustedSigners": {
            "Enabled": false,
            "Quantity": 0
        },
        "ForwardedValues": {
            "QueryString": false,
            "Cookies": {
                "Forward": "none"
            }
        },
        "MinTTL": 0,
        "DefaultTTL": 86400,
        "MaxTTL": 31536000,
        "Compress": true,
        "AllowedMethods": {
            "Quantity": 2,
            "Items": ["GET", "HEAD"],
            "CachedMethods": {
                "Quantity": 2,
                "Items": ["GET", "HEAD"]
            }
        }
    },
    "CustomErrorResponses": {
        "Quantity": 1,
        "Items": [
            {
                "ErrorCode": 404,
                "ResponsePagePath": "/index.html",
                "ResponseCode": "200",
                "ErrorCachingMinTTL": 300
            }
        ]
    },
    "Enabled": true,
    "PriceClass": "PriceClass_100"
}'

DISTRIBUTION_ID=$(aws cloudfront create-distribution \
    --distribution-config "$DISTRIBUTION_CONFIG" \
    --query 'Distribution.Id' \
    --output text)

echo "✅ Created CloudFront distribution: $DISTRIBUTION_ID"

# Get CloudFront domain name
DOMAIN_NAME=$(aws cloudfront get-distribution \
    --id $DISTRIBUTION_ID \
    --query 'Distribution.DomainName' \
    --output text)

echo "🌐 CloudFront domain: $DOMAIN_NAME"

# Create bucket policy for CloudFront OAC
echo "🔐 Setting up bucket policy for CloudFront access..."
BUCKET_POLICY='{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowCloudFrontServicePrincipal",
            "Effect": "Allow",
            "Principal": {
                "Service": "cloudfront.amazonaws.com"
            },
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::'$BUCKET_NAME'/*",
            "Condition": {
                "StringEquals": {
                    "AWS:SourceArn": "arn:aws:cloudfront::'$(aws sts get-caller-identity --query Account --output text)':distribution/'$DISTRIBUTION_ID'"
                }
            }
        }
    ]
}'

echo "$BUCKET_POLICY" | aws s3api put-bucket-policy \
    --bucket $BUCKET_NAME \
    --policy file:///dev/stdin

echo "⏳ Waiting for CloudFront distribution to deploy (this may take 10-15 minutes)..."
echo "📊 You can check deployment status with: aws cloudfront get-distribution --id $DISTRIBUTION_ID --query 'Distribution.Status'"

# Wait for deployment (optional - can be skipped for faster completion)
echo "🚀 CloudFront distribution created successfully!"
echo ""
echo "🌍 HTTPS URL: https://$DOMAIN_NAME"
echo "📝 Distribution ID: $DISTRIBUTION_ID" 
echo "📦 S3 Bucket: $BUCKET_NAME"
echo ""
echo "⚠️  Note: It may take 10-15 minutes for the distribution to fully deploy."
echo "💡 You can check status with: aws cloudfront get-distribution --id $DISTRIBUTION_ID --query 'Distribution.Status'"

# Save deployment info
cat > cloudfront-deployment-info.json << EOF
{
    "httpsUrl": "https://$DOMAIN_NAME",
    "distributionId": "$DISTRIBUTION_ID",
    "bucketName": "$BUCKET_NAME",
    "oacId": "$OAC_ID",
    "region": "$REGION",
    "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "status": "deploying"
}
EOF

echo "💾 Deployment info saved to cloudfront-deployment-info.json"
echo ""
echo "🎉 Deployment initiated successfully!"
echo "🔗 Access your app at: https://$DOMAIN_NAME (after deployment completes)"