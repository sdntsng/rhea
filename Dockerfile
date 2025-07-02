# Base image
FROM node:20-slim

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port (if needed for health checks)
# EXPOSE 3000

# Run the bot
CMD [ "npm", "start" ]
