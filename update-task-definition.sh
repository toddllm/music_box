#!/bin/bash

# Update ECS task definition to use a simple public image for testing

set -e

echo "🔄 Updating ECS task definition with test image..."

# Get current task definition
TASK_DEFINITION_ARN=$(aws ecs describe-services \
    --cluster music-box-realtime-cluster \
    --services music-box-realtime-service \
    --query 'services[0].taskDefinition' \
    --output text)

echo "Current task definition: $TASK_DEFINITION_ARN"

# Create new task definition with nginx image for testing
cat > test-task-definition.json << 'EOF'
{
  "family": "music-box-realtime-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "taskRoleArn": "arn:aws:iam::717984198385:role/music-box-realtime-task-role",
  "executionRoleArn": "arn:aws:iam::717984198385:role/music-box-realtime-service-TaskExecutionRole-*",
  "containerDefinitions": [
    {
      "name": "realtime-service",
      "image": "nginx:alpine",
      "portMappings": [
        {
          "containerPort": 80,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "test"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/music-box-realtime",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
EOF

# Get the actual execution role ARN
EXECUTION_ROLE_ARN=$(aws iam list-roles --query "Roles[?contains(RoleName, 'TaskExecutionRole')].Arn" --output text | head -1)

if [ -n "$EXECUTION_ROLE_ARN" ]; then
    echo "Found execution role: $EXECUTION_ROLE_ARN"
    # Update the task definition with the correct role
    sed -i.bak "s|arn:aws:iam::717984198385:role/music-box-realtime-service-TaskExecutionRole-.*|$EXECUTION_ROLE_ARN|g" test-task-definition.json
else
    echo "⚠️  Could not find execution role, using placeholder"
fi

# Register new task definition
echo "Registering new task definition..."
NEW_TASK_ARN=$(aws ecs register-task-definition \
    --cli-input-json file://test-task-definition.json \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text)

echo "New task definition: $NEW_TASK_ARN"

# Update service to use new task definition
echo "Updating ECS service..."
aws ecs update-service \
    --cluster music-box-realtime-cluster \
    --service music-box-realtime-service \
    --task-definition "$NEW_TASK_ARN" \
    --force-new-deployment

echo "✅ Service updated with test image!"
echo "Monitor progress with:"
echo "aws ecs describe-services --cluster music-box-realtime-cluster --services music-box-realtime-service --query 'services[0].deployments'"