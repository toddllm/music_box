const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();

// Function to load secrets from AWS Secrets Manager
async function loadSecrets() {
  try {
    const secretName = process.env.SECRET_NAME || 'music_box_config';
    const data = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
    
    if ('SecretString' in data) {
      const secrets = JSON.parse(data.SecretString);
      
      // Set environment variables from secrets
      process.env.OPENAI_API_KEY = secrets.OPENAI_API_KEY;
      process.env.SESSION_SECRET = secrets.SESSION_SECRET;
      process.env.PORT = secrets.PORT || '3000';
      process.env.MAX_PLAYERS = secrets.MAX_PLAYERS || '10';
      process.env.ROUND_DURATION = secrets.ROUND_DURATION || '30';
    }
  } catch (error) {
    console.error('Error loading secrets:', error);
    throw error;
  }
}

// Load secrets before starting the server
loadSecrets().then(() => {
  // Now require the main server file after secrets are loaded
  module.exports = require('./server');
}).catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});