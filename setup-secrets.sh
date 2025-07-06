#!/bin/bash

# AWS Secrets Manager setup for Music Box game
# This script creates the secrets in AWS Secrets Manager

echo "🎵 Setting up AWS Secrets for Music Box game..."
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI is not configured. Please run 'aws configure' first."
    exit 1
fi

# Function to generate random string
generate_secret() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Check if secret already exists
SECRET_NAME="music_box_config"
REGION="us-east-1"

if aws secretsmanager describe-secret --secret-id $SECRET_NAME --region $REGION >/dev/null 2>&1; then
    echo "⚠️  Secret '$SECRET_NAME' already exists!"
    echo ""
    read -p "Do you want to update it? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Exiting without changes."
        exit 0
    fi
    UPDATE_SECRET=true
else
    UPDATE_SECRET=false
fi

# Get OpenAI API Key
echo "Please enter your OpenAI API Key (for GPT-4o and Whisper):"
echo "(Get one at https://platform.openai.com/api-keys)"
read -s OPENAI_API_KEY
echo ""

if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ OpenAI API Key is required!"
    exit 1
fi

# Generate session secret
SESSION_SECRET=$(generate_secret)
echo "✅ Generated random session secret"

# Create or update the secret
SECRET_JSON=$(cat <<EOF
{
    "OPENAI_API_KEY": "$OPENAI_API_KEY",
    "SESSION_SECRET": "$SESSION_SECRET",
    "PORT": "3000",
    "MAX_PLAYERS": "10",
    "ROUND_DURATION": "30"
}
EOF
)

if [ "$UPDATE_SECRET" = true ]; then
    echo "Updating secret in AWS Secrets Manager..."
    aws secretsmanager update-secret \
        --secret-id $SECRET_NAME \
        --secret-string "$SECRET_JSON" \
        --region $REGION
else
    echo "Creating secret in AWS Secrets Manager..."
    aws secretsmanager create-secret \
        --name $SECRET_NAME \
        --description "Configuration for Music Box singing game" \
        --secret-string "$SECRET_JSON" \
        --region $REGION
fi

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Secret '$SECRET_NAME' configured successfully!"
    echo ""
    echo "🚀 Next steps:"
    echo "   1. Deploy the application: ./deploy.sh"
    echo "   2. Your game will be available at the CloudFront URL shown after deployment"
    echo ""
    echo "💡 Tips:"
    echo "   - To view the secret: aws secretsmanager get-secret-value --secret-id $SECRET_NAME --region $REGION"
    echo "   - Make sure your OpenAI account has credits for API usage"
    echo "   - GPT-4o and Whisper API calls will incur costs based on usage"
else
    echo "❌ Failed to configure secret!"
    exit 1
fi