#!/bin/bash
# WebSocket Service Health Check Script

echo "=== Music Box WebSocket Service Health Check ==="
echo "Time: $(date)"
echo ""

# Check ECS Service
echo "📦 ECS Service Status:"
aws ecs describe-services \
  --cluster music-box-realtime-cluster \
  --services music-box-realtime-service \
  --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount,TaskDef:taskDefinition}' \
  --output table
echo ""

# Check Target Health
echo "🎯 Target Group Health:"
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:717984198385:targetgroup/music-box-ws-tg/b49886df2db96b9d \
  --query 'TargetHealthDescriptions[*].{Target:Target.Id,Health:TargetHealth.State}' \
  --output table
echo ""

# Check HTTP Endpoint
echo "🌐 HTTP Status Endpoint:"
curl -k -s https://music-box-realtime-alb-417242201.us-east-1.elb.amazonaws.com/ | jq . || echo "Failed to connect"
echo ""

# Quick WebSocket Test
echo "🔌 WebSocket Connection Test:"
timeout 5s node /Users/tdeshane/music_box/ws-test.js 2>&1 || echo "WebSocket test timed out"
echo ""

echo "=== Health Check Complete ==="