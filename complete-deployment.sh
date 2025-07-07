#!/bin/bash

# Complete deployment script for Music Box Realtime Service
# Run this after CloudFormation stack CREATE_COMPLETE

set -e

echo "🚀 Completing Music Box Realtime Service Deployment..."

# Step 1: Wait for CloudFormation to complete
echo "1️⃣ Checking CloudFormation stack status..."
STACK_STATUS=$(aws cloudformation describe-stacks --stack-name music-box-realtime-service --query 'Stacks[0].StackStatus' --output text)

if [ "$STACK_STATUS" != "CREATE_COMPLETE" ]; then
    echo "⏳ Waiting for CloudFormation stack to complete (current: $STACK_STATUS)..."
    aws cloudformation wait stack-create-complete --stack-name music-box-realtime-service
    echo "✅ CloudFormation stack completed!"
else
    echo "✅ CloudFormation stack already complete!"
fi

# Step 2: Get stack outputs
echo "2️⃣ Getting stack outputs..."
ALB_DNS=$(aws cloudformation describe-stacks --stack-name music-box-realtime-service --query 'Stacks[0].Outputs[?OutputKey==`ALBDNSName`].OutputValue' --output text)
WS_URL=$(aws cloudformation describe-stacks --stack-name music-box-realtime-service --query 'Stacks[0].Outputs[?OutputKey==`WebSocketURL`].OutputValue' --output text)
ECR_URI=$(aws cloudformation describe-stacks --stack-name music-box-realtime-service --query 'Stacks[0].Outputs[?OutputKey==`ECRRepositoryURI`].OutputValue' --output text)

echo "📋 ALB DNS: $ALB_DNS"
echo "📋 WebSocket URL: $WS_URL"
echo "📋 ECR Repository: $ECR_URI"

# Step 3: Fix ALB health check
echo "3️⃣ Fixing ALB health check configuration..."
TG_ARN=$(aws ecs describe-services --cluster music-box-realtime-cluster --services music-box-realtime-service --query 'services[0].loadBalancers[0].targetGroupArn' --output text)

aws elbv2 modify-target-group \
  --target-group-arn "$TG_ARN" \
  --health-check-protocol HTTP \
  --health-check-port "8080" \
  --health-check-path "/" \
  --health-check-interval-seconds 20 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 2

echo "✅ Health check fixed! ALB will check HTTP GET / on port 8080"

# Step 4: Test ALB connectivity
echo "4️⃣ Testing ALB connectivity..."
sleep 10
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://$ALB_DNS/" || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ ALB responding with 200 OK!"
elif [ "$HTTP_STATUS" = "503" ]; then
    echo "⚠️  ALB responding with 503 (expected - need real Docker image)"
else
    echo "❌ ALB responding with $HTTP_STATUS"
fi

# Step 5: Create simple test image (if needed)
echo "5️⃣ Checking if we need to build Docker image..."

# Check if there are any images in ECR
IMAGE_COUNT=$(aws ecr describe-images --repository-name music-box-realtime --query 'length(imageDetails)' --output text 2>/dev/null || echo "0")

if [ "$IMAGE_COUNT" = "0" ]; then
    echo "⚠️  No Docker images found in ECR. Here are your options:"
    echo ""
    echo "Option A: Use CodeBuild (recommended)"
    echo "  1. Create CodeBuild project with buildspec.yml"
    echo "  2. Run build to push image to ECR"
    echo ""
    echo "Option B: Use Cloud9 or EC2"
    echo "  1. Launch Cloud9 environment"
    echo "  2. Clone this repo and run: docker build -t music-box-realtime ./realtime-service"
    echo "  3. Push to ECR"
    echo ""
    echo "Option C: Use a test image (quick start)"
    echo "  We can deploy a simple Node.js image for testing"
    echo ""
    read -p "Deploy test image for now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "📦 Creating test task definition with Node.js image..."
        
        # Get current task definition and modify it
        CURRENT_TASK_DEF=$(aws ecs describe-task-definition --task-definition music-box-realtime-service --query 'taskDefinition')
        
        # Create new task definition with test image and proper command
        echo "$CURRENT_TASK_DEF" | jq '
          .containerDefinitions[0].image = "node:20-alpine" |
          .containerDefinitions[0].command = [
            "sh", "-c", 
            "echo \"const http = require(\\\"http\\\"); const WebSocket = require(\\\"ws\\\"); const server = http.createServer((req, res) => { res.writeHead(200); res.end(\\\"Music Box Test Service - WebSocket Ready\\\"); }); server.listen(8080, () => console.log(\\\"HTTP server on 8080\\\")); const health = http.createServer((req, res) => { res.writeHead(200); res.end(\\\"OK\\\"); }); health.listen(8081, () => console.log(\\\"Health server on 8081\\\")); const wss = new (require(\\\"ws\\\")).Server({ port: 8080 }); console.log(\\\"WebSocket server ready\\\");\" > server.js && npm install ws && node server.js"
          ] |
          del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .placementConstraints, .compatibilities, .registeredAt, .registeredBy)
        ' > test-task-def.json
        
        # Register new task definition
        NEW_TASK_ARN=$(aws ecs register-task-definition --cli-input-json file://test-task-def.json --query 'taskDefinition.taskDefinitionArn' --output text)
        
        # Update service
        aws ecs update-service \
          --cluster music-box-realtime-cluster \
          --service music-box-realtime-service \
          --task-definition "$NEW_TASK_ARN" \
          --force-new-deployment
          
        echo "✅ Test image deployed! Waiting for service to stabilize..."
        aws ecs wait services-stable --cluster music-box-realtime-cluster --services music-box-realtime-service
        
        echo "🎉 Test deployment complete!"
    fi
else
    echo "✅ Found $IMAGE_COUNT image(s) in ECR repository"
fi

# Step 6: Final status check
echo "6️⃣ Running final status check..."
sleep 5

# Run smoke test
if command -v node >/dev/null 2>&1; then
    echo "Running automated smoke test..."
    node smoke-test.js
else
    echo "Node.js not available for smoke test. Manual verification:"
    echo "1. Check ALB: curl http://$ALB_DNS/"
    echo "2. Check ECS service: aws ecs describe-services --cluster music-box-realtime-cluster --services music-box-realtime-service"
    echo "3. Check target health: aws elbv2 describe-target-health --target-group-arn $TG_ARN"
fi

echo ""
echo "🎉 Deployment sequence complete!"
echo "📋 WebSocket URL: $WS_URL"
echo "📋 Test page: https://dxhq2y7asz0vd.cloudfront.net/test-persistent-realtime.html"
echo ""
echo "Next steps:"
echo "1. Build and deploy the real Docker image for full WebSocket functionality"
echo "2. Test real-time laughter detection"
echo "3. Integrate with Music Box game"