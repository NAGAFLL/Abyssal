FROM ghcr.io/puppeteer/puppeteer:latest

USER root

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies and FORCE chrome installation to a known path
RUN npm install
RUN npx puppeteer browsers install chrome

# Copy the rest of the app
COPY . .

# Set environment variables
ENV PORT=8000
# This tells Puppeteer where to look for the browser we just installed
ENV PUPPETEER_CACHE_DIR=/home/pptruser/.cache/puppeteer

EXPOSE 8000

# Use the pptruser provided by the image for better security/compatibility
USER pptruser

CMD ["npx", "tsx", "server/server.ts"]