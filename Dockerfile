# Use the official Puppeteer image which includes Chrome and all dependencies
FROM ghcr.io/puppeteer/puppeteer:latest

# Set the working directory
WORKDIR /app

# Copy package files first to leverage Docker layer caching
COPY package*.json ./

# Switch to root to ensure permissions are correct for installs
USER root
RUN npm install

# Copy the rest of your application code
COPY . .

# Set environment variables
# Koyeb provides the PORT variable automatically
ENV PORT=8000
ENV NODE_ENV=production

# Expose the port
EXPOSE 8000

# Start the application using tsx to run your typescript server
CMD ["npx", "tsx", "server/server.ts"]