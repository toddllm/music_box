# Music Box Persistent Realtime Service Setup

This guide explains how to deploy the persistent WebSocket service for real-time laughter detection using AWS ECS Fargate.

## Architecture Overview

The persistent service architecture:
- **ECS Fargate**: Runs containerized Node.js WebSocket server
- **Application Load Balancer**: Provides WebSocket endpoint with sticky sessions
- **Persistent Connections**: Maintains WebSocket connections to OpenAI's Realtime API
- **Auto-scaling**: Scales based on CPU utilization

## Prerequisites

1. AWS CLI configured
2. Docker installed
3. An existing VPC with at least 2 public subnets
4. (Optional) ACM certificate for HTTPS/WSS

## Setup Steps

### 1. Get VPC and Subnet Information

```bash
# Get default VPC ID
aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --query "Vpcs[0].VpcId" --output text

# Get subnet IDs (need at least 2)
aws ec2 describe-subnets --filters "Name=vpc-id,Values=YOUR_VPC_ID" --query "Subnets[?MapPublicIpOnLaunch==\`true\`].SubnetId" --output text
```

### 2. Create the Infrastructure

```bash
# Create CloudFormation stack
aws cloudformation create-stack \
  --stack-name music-box-realtime-service \
  --template-body file://realtime-service-infra.yaml \
  --parameters \
    ParameterKey=VPCId,ParameterValue=YOUR_VPC_ID \
    ParameterKey=SubnetIds,ParameterValue="SUBNET1,SUBNET2" \
  --capabilities CAPABILITY_NAMED_IAM

# Wait for stack creation
aws cloudformation wait stack-create-complete --stack-name music-box-realtime-service
```

### 3. Build and Deploy the Service

```bash
# Install dependencies
cd realtime-service
npm install

# Run the deployment script
cd ..
./deploy-realtime-service.sh
```

### 4. Get the WebSocket URL

```bash
# Get ALB DNS name
aws cloudformation describe-stacks \
  --stack-name music-box-realtime-service \
  --query 'Stacks[0].Outputs[?OutputKey==`WebSocketURL`].OutputValue' \
  --output text
```

Your WebSocket URL will be: `ws://ALB-DNS-NAME` (or `wss://` if using HTTPS)

### 5. Test the Service

1. Upload test page to S3:
```bash
aws s3 cp public/test-persistent-realtime.html s3://music-box-static-717984198385-production/
aws s3 cp public/realtime-client.js s3://music-box-static-717984198385-production/
```

2. Visit: `https://YOUR-CLOUDFRONT-URL/test-persistent-realtime.html`
3. Enter your WebSocket URL
4. Click "Connect to Service"
5. Click "Start Performance"
6. Try laughing or speaking

## Local Development

To run the service locally:

```bash
cd realtime-service
npm install

# Set environment variables
export AWS_REGION=us-east-1
export SESSIONS_TABLE=music-box-realtime-sessions-dev

# Run the service
npm start
```

The service will be available at `ws://localhost:8080`

## Monitoring

### View Logs
```bash
# Get recent logs
aws logs tail /ecs/music-box-realtime --follow
```

### Check Service Status
```bash
aws ecs describe-services \
  --cluster music-box-realtime-cluster \
  --services music-box-realtime-service \
  --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount}'
```

### Monitor Auto-scaling
```bash
aws application-autoscaling describe-scaling-activities \
  --service-namespace ecs \
  --resource-id service/music-box-realtime-cluster/music-box-realtime-service
```

## Integration with Music Box Game

Update your game code to use the persistent service:

```javascript
// In game.js, replace the WebSocket URL with your ALB URL
const REALTIME_SERVICE_URL = 'wss://your-alb-dns.elb.amazonaws.com';

// Use the realtime client library
const realtimeClient = new MusicBoxRealtimeClient(REALTIME_SERVICE_URL, (detection) => {
  // Handle laughter detection
  console.log('Laughter detected:', detection);
});

// Connect when starting performance
await realtimeClient.connect();
await realtimeClient.startPerformance(playerId);

// End when stopping
realtimeClient.endPerformance();
```

## Cost Optimization

1. **Use Fargate Spot**: Update the task definition to use FARGATE_SPOT for 70% cost savings
2. **Right-size containers**: Start with 256 CPU / 512 MB memory
3. **Set appropriate auto-scaling**: Min 1, Max based on expected load
4. **Use Application Load Balancer**: More cost-effective than Network Load Balancer for WebSockets

## Troubleshooting

### Connection Issues
- Check security groups allow traffic on ports 80/443
- Verify ALB target health: `aws elbv2 describe-target-health`
- Check ECS task logs in CloudWatch

### Performance Issues
- Monitor CPU/memory metrics in CloudWatch
- Adjust auto-scaling thresholds
- Consider increasing task CPU/memory

### WebSocket Drops
- ALB has 60-second idle timeout by default
- Implement heartbeat/ping messages
- Use sticky sessions (already configured)

## Security Considerations

1. **Use HTTPS/WSS in production**: Add ACM certificate to ALB
2. **Restrict ALB access**: Update security groups to limit source IPs
3. **Enable VPC Flow Logs**: Monitor network traffic
4. **Use AWS WAF**: Protect against common attacks

## Next Steps

1. Add custom domain with Route 53
2. Implement CloudWatch alarms for monitoring
3. Set up CI/CD pipeline for automated deployments
4. Add distributed tracing with X-Ray