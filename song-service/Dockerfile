# Song Generation Service Dockerfile
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    curl \
    python3 \
    make \
    g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY . .

# Create uploads directory
RUN mkdir -p /tmp/uploads

# Create non-root user for security
RUN addgroup -g 1001 -S songservice && \
    adduser -S songservice -u 1001 -G songservice

# Change ownership of app directory
RUN chown -R songservice:songservice /app /tmp/uploads

# Switch to non-root user
USER songservice

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Start the application
CMD ["npm", "start"]