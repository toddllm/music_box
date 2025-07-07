FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Expose port for WebSocket server
EXPOSE 8080

# Start the service
CMD ["node", "server.js"]