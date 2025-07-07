#!/bin/bash

# Script to create a simple Docker image for the realtime service

set -e

echo "🚀 Creating Docker image for Music Box Realtime Service..."

# Check if we can use AWS CodeBuild instead
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URI="$ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/music-box-realtime"

echo "ECR Repository: $ECR_URI"

# Create a minimal buildspec for CodeBuild
cat > buildspec.yml << 'EOF'
version: 0.2

phases:
  pre_build:
    commands:
      - echo Logging in to Amazon ECR...
      - aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com
  build:
    commands:
      - echo Build started on `date`
      - echo Building the Docker image...
      - cd realtime-service
      - docker build -t $IMAGE_REPO_NAME .
      - docker tag $IMAGE_REPO_NAME:$IMAGE_TAG $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:$IMAGE_TAG
  post_build:
    commands:
      - echo Build completed on `date`
      - echo Pushing the Docker image...
      - docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:$IMAGE_TAG
EOF

echo "Created buildspec.yml for CodeBuild"

# Alternative: Create a simple image using base64 encoding
# This creates a minimal working image without local Docker

cat > create-simple-image.py << 'EOF'
#!/usr/bin/env python3
import base64
import json
import zipfile
import os
import tempfile

# Create a simple Node.js application
app_files = {
    'package.json': '''
{
  "name": "music-box-realtime-minimal",
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": {
    "ws": "^8.16.0"
  },
  "scripts": {
    "start": "node server.js"
  }
}
''',
    'server.js': '''
const http = require('http');
const WebSocket = require('ws');

// Simple health check server
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  } else {
    res.writeHead(404);
    res.end();
  }
});

healthServer.listen(8081, () => {
  console.log('Health check server running on port 8081');
});

// Simple WebSocket server
const wss = new WebSocket.Server({ port: 8080 });
console.log('WebSocket server running on port 8080');

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  ws.send(JSON.stringify({
    type: 'welcome',
    message: 'Connected to Music Box Realtime Service'
  }));
  
  ws.on('message', (message) => {
    console.log('Received:', message.toString());
    ws.send(JSON.stringify({
      type: 'echo',
      data: JSON.parse(message.toString())
    }));
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  wss.close(() => {
    healthServer.close(() => {
      process.exit(0);
    });
  });
});
''',
    'Dockerfile': '''
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
EXPOSE 8080 8081
CMD ["npm", "start"]
'''
}

# Create temporary directory
with tempfile.TemporaryDirectory() as temp_dir:
    # Write files
    for filename, content in app_files.items():
        with open(os.path.join(temp_dir, filename), 'w') as f:
            f.write(content.strip())
    
    # Create ZIP file
    zip_path = 'realtime-service-minimal.zip'
    with zipfile.ZipFile(zip_path, 'w') as zipf:
        for filename in app_files.keys():
            zipf.write(os.path.join(temp_dir, filename), filename)
    
    print(f"Created {zip_path}")

print("Run: 'unzip realtime-service-minimal.zip -d minimal-service && cd minimal-service && docker build -t music-box-realtime .'")
EOF

python3 create-simple-image.py

echo "✅ Alternative deployment files created!"
echo ""
echo "Options to deploy:"
echo "1. Use AWS CodeBuild (recommended):"
echo "   - Create a CodeBuild project"
echo "   - Use the buildspec.yml file"
echo "   - Build and push to ECR"
echo ""
echo "2. Use the minimal service (for testing):"
echo "   - unzip realtime-service-minimal.zip"
echo "   - Use AWS Cloud9 or EC2 with Docker to build"
echo ""
echo "3. Push a placeholder image:"
echo "   - We can use a simple 'hello-world' image temporarily"