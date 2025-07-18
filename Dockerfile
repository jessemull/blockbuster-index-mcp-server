FROM node:20-alpine

# Install Chromium and other system dependencies

RUN apk add --no-cache \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  ttf-freefont \
  udev \
  bash

# Define path to Chromium binary

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Copy package files and install dependencies

COPY package*.json ./
RUN npm ci

# Set build argument and environment variable for signal type

ARG SIGNAL_TYPE
ENV SIGNAL_TYPE=$SIGNAL_TYPE

# Copy source code

COPY . .

# Build the project using the specified signal type

RUN npm run build

CMD ["node", "dist/index.js"]
