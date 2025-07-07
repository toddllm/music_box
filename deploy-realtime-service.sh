#!/bin/bash

# Deploy script for Music Box Realtime Service

set -e

# Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
STACK_NAME="music-box-realtime-service"
SERVICE_DIR="realtime-service"

echo "🚀 Deploying Music Box Realtime Service..."

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "AWS Account ID: $ACCOUNT_ID"

# Check if we need to create the CloudFormation stack
echo "Checking CloudFormation stack..."
if ! aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION >/dev/null 2>&1; then
    echo "Stack does not exist. Please create it first with:"
    echo "aws cloudformation create-stack --stack-name $STACK_NAME --template-body file://realtime-service-infra.yaml --parameters ParameterKey=VPCId,ParameterValue=YOUR_VPC_ID ParameterKey=SubnetIds,ParameterValue=SUBNET1,SUBNET2 --capabilities CAPABILITY_NAMED_IAM"
    exit 1
fi

# Get ECR repository URI
ECR_URI=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`ECRRepositoryURI`].OutputValue' \
    --output text)

echo "ECR Repository: $ECR_URI"

# Login to ECR
echo "Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build Docker image
echo "Building Docker image..."
cd $SERVICE_DIR
docker build -t music-box-realtime .

# Tag and push image
echo "Pushing image to ECR..."
docker tag music-box-realtime:latest $ECR_URI:latest
docker push $ECR_URI:latest

# Update ECS service to use new image
echo "Updating ECS service..."
CLUSTER_NAME="music-box-realtime-cluster"
SERVICE_NAME="music-box-realtime-service"

aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service $SERVICE_NAME \
    --force-new-deployment \
    --region $AWS_REGION

echo "✅ Deployment initiated!"
echo ""
echo "Monitor deployment progress:"
echo "aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --query 'services[0].deployments'"
echo ""
echo "Get WebSocket URL:"
echo "aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==\`WebSocketURL\`].OutputValue' --output text"