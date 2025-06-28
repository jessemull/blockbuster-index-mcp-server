FROM node:20-alpine

# Install System Dependencies for Chromium

RUN apk add --no-cache \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  ttf-freefont \
  nodejs \
  yarn \
  udev \
  bash

# Define Path to Chromium Binary

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Set Working Directory
WORKDIR /app

# Install Node Dependencies

COPY package*.json ./
RUN npm ci

# Copy App Code

COPY . .

# Build App

RUN npm run build

# Run App

CMD ["node", "dist/index.js"]
