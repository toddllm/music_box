FROM node:20-alpine

# Create non-root user
RUN addgroup -S app && adduser -S -g app app
USER app

WORKDIR /home/app

COPY --chown=app:app package*.json ./
RUN npm ci --omit=dev

COPY --chown=app:app . .

EXPOSE 8080 8081
ENV NODE_ENV=production
CMD ["npm", "start"]