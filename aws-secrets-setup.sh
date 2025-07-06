#!/bin/bash

# AWS Secrets Manager setup for Music Box game
# This script creates the secrets in AWS Secrets Manager

echo "Setting up AWS Secrets for Music Box game..."

# Read values from .env file
OPENAI_API_KEY=$(grep OPENAI_API_KEY .env | cut -d '=' -f2)
SESSION_SECRET=$(grep SESSION_SECRET .env | cut -d '=' -f2)

# Create the secret in AWS Secrets Manager
aws secretsmanager create-secret \
    --name music_box_config \
    --description "Configuration for Music Box singing game" \
    --secret-string "{
        \"OPENAI_API_KEY\":\"$OPENAI_API_KEY\",
        \"SESSION_SECRET\":\"$SESSION_SECRET\",
        \"PORT\":\"3000\",
        \"MAX_PLAYERS\":\"10\",
        \"ROUND_DURATION\":\"30\"
    }" \
    --region us-east-1

echo "Secret 'music_box_config' created successfully!"
echo "You can retrieve it using: aws secretsmanager get-secret-value --secret-id music_box_config"