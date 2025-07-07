#!/usr/bin/env node

// Smoke test for Music Box Realtime Service infrastructure
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { ECSClient, DescribeClustersCommand, DescribeServicesCommand } = require('@aws-sdk/client-ecs');
const { CloudFormationClient, DescribeStacksCommand } = require('@aws-sdk/client-cloudformation');
const WebSocket = require('ws');

const region = 'us-east-1';
const stackName = 'music-box-realtime-service';

const cfClient = new CloudFormationClient({ region });
const ecsClient = new ECSClient({ region });
const secretsClient = new SecretsManagerClient({ region });

async function runSmokeTest() {
  console.log('🧪 Running Music Box Realtime Service Smoke Test\n');
  
  const results = {
    cloudformation: false,
    secrets: false,
    openaiApi: false,
    ecsCluster: false,
    ecsService: false,
    alb: false
  };
  
  // Test 1: CloudFormation Stack
  console.log('1️⃣ Testing CloudFormation Stack...');
  try {
    const response = await cfClient.send(new DescribeStacksCommand({ StackName: stackName }));
    const stack = response.Stacks[0];
    console.log(`   ✅ Stack Status: ${stack.StackStatus}`);
    
    if (stack.StackStatus === 'CREATE_COMPLETE') {
      results.cloudformation = true;
      
      // Extract outputs
      const outputs = {};
      if (stack.Outputs) {
        stack.Outputs.forEach(output => {
          outputs[output.OutputKey] = output.OutputValue;
        });
        console.log(`   📋 ALB DNS: ${outputs.ALBDNSName || 'Not available'}`);
        console.log(`   📋 WebSocket URL: ${outputs.WebSocketURL || 'Not available'}`);
      }
    } else {
      console.log(`   ⚠️  Stack not ready: ${stack.StackStatus}`);
    }
  } catch (error) {
    console.log(`   ❌ CloudFormation Error: ${error.message}`);
  }
  
  // Test 2: AWS Secrets Manager
  console.log('\n2️⃣ Testing AWS Secrets Manager...');
  try {
    const command = new GetSecretValueCommand({ SecretId: 'music_box_config' });
    const response = await secretsClient.send(command);
    const secrets = JSON.parse(response.SecretString);
    
    if (secrets.OPENAI_API_KEY) {
      console.log('   ✅ OpenAI API key found in secrets');
      results.secrets = true;
    } else {
      console.log('   ❌ OpenAI API key not found in secrets');
    }
  } catch (error) {
    console.log(`   ❌ Secrets Manager Error: ${error.message}`);
  }
  
  // Test 3: OpenAI Realtime API
  if (results.secrets) {
    console.log('\n3️⃣ Testing OpenAI Realtime API...');
    try {
      const command = new GetSecretValueCommand({ SecretId: 'music_box_config' });
      const response = await secretsClient.send(command);
      const secrets = JSON.parse(response.SecretString);
      
      const testResult = await testOpenAIConnection(secrets.OPENAI_API_KEY);
      if (testResult) {
        console.log('   ✅ OpenAI Realtime API connection successful');
        results.openaiApi = true;
      }
    } catch (error) {
      console.log(`   ❌ OpenAI API Error: ${error.message}`);
    }
  } else {
    console.log('\n3️⃣ Skipping OpenAI API test (no API key)');
  }
  
  // Test 4: ECS Cluster
  console.log('\n4️⃣ Testing ECS Cluster...');
  try {
    const response = await ecsClient.send(new DescribeClustersCommand({
      clusters: ['music-box-realtime-cluster']
    }));
    
    if (response.clusters && response.clusters.length > 0) {
      const cluster = response.clusters[0];
      console.log(`   ✅ Cluster Status: ${cluster.status}`);
      console.log(`   📊 Active Services: ${cluster.activeServicesCount}`);
      console.log(`   📊 Running Tasks: ${cluster.runningTasksCount}`);
      
      if (cluster.status === 'ACTIVE') {
        results.ecsCluster = true;
      }
    } else {
      console.log('   ❌ Cluster not found');
    }
  } catch (error) {
    console.log(`   ❌ ECS Cluster Error: ${error.message}`);
  }
  
  // Test 5: ECS Service
  console.log('\n5️⃣ Testing ECS Service...');
  try {
    const response = await ecsClient.send(new DescribeServicesCommand({
      cluster: 'music-box-realtime-cluster',
      services: ['music-box-realtime-service']
    }));
    
    if (response.services && response.services.length > 0) {
      const service = response.services[0];
      console.log(`   📊 Service Status: ${service.status}`);
      console.log(`   📊 Desired Count: ${service.desiredCount}`);
      console.log(`   📊 Running Count: ${service.runningCount}`);
      console.log(`   📊 Pending Count: ${service.pendingCount}`);
      
      if (service.runningCount > 0) {
        console.log('   ✅ Service has running tasks');
        results.ecsService = true;
      } else {
        console.log('   ⚠️  Service has no running tasks');
        
        // Check for deployment issues
        if (service.deployments) {
          service.deployments.forEach(deployment => {
            console.log(`   📋 Deployment: ${deployment.status} (${deployment.rolloutState})`);
          });
        }
      }
    } else {
      console.log('   ❌ Service not found');
    }
  } catch (error) {
    console.log(`   ❌ ECS Service Error: ${error.message}`);
  }
  
  // Summary
  console.log('\n📊 Smoke Test Results:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Object.entries(results).forEach(([test, passed]) => {
    const icon = passed ? '✅' : '❌';
    const status = passed ? 'PASS' : 'FAIL';
    console.log(`${icon} ${test.padEnd(20)} ${status}`);
  });
  
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🎯 Tests Passed: ${passedTests}/${totalTests}`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! The realtime service is ready.');
  } else if (passedTests >= 3) {
    console.log('⚠️  Core functionality working, some components still starting up.');
  } else {
    console.log('❌ Multiple failures detected. Check the deployment.');
  }
  
  return passedTests;
}

async function testOpenAIConnection(apiKey) {
  return new Promise((resolve) => {
    const wsUrl = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';
    
    const ws = new WebSocket(wsUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });
    
    const timeout = setTimeout(() => {
      ws.close();
      resolve(false);
    }, 5000);
    
    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'session.update',
        session: { modalities: ['text', 'audio'] }
      }));
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data);
      if (message.type === 'session.created' || message.type === 'session.updated') {
        clearTimeout(timeout);
        ws.close();
        resolve(true);
      }
    });
    
    ws.on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

// Run the smoke test
runSmokeTest().catch(console.error);