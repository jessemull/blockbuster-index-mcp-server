# Build Stage

FROM node:20-alpine AS builder
WORKDIR /app

# Ensure Puppeteer Downloads Chrome

ENV PUPPETEER_PRODUCT=chrome

# Copy Package.json & Install Dependencies

COPY package*.json ./
RUN npm ci

# Copy Source Files

COPY . .

# Build

RUN npm run build

# Runtime

FROM node:20-alpine

WORKDIR /app

# Copy Output, Package.json and Dependencies

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

CMD ["node", "dist/index.js"]
