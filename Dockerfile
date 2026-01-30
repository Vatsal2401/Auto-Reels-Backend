# Stage 1: Build the application
FROM node:22 AS builder

WORKDIR /app

# Install build dependencies (python3/make/g++ usually present in full node image, or we try without invalid apt)
# If we really need them and apt fails, we might be stuck, but let's try assuming node:22 has basics.
# Actually, let's keep it simple. node:22 usually has what we need for basic content.
# COPY package*.json ./
# RUN npm ci ...

COPY package*.json ./
# Increase timeout for slow networks
RUN npm config set fetch-retry-maxtimeout 600000 && \
    npm config set fetch-retry-mintimeout 10000 && \
    npm config set fetch-retries 5 && \
    npm ci --no-audit --prefer-offline

COPY . .
RUN npm run build

# Stage 2: Get static ffmpeg
FROM mwader/static-ffmpeg:6.1 AS ffmpeg

# Stage 3: Production image
FROM node:22-slim

WORKDIR /app

# Copy ffmpeg from the ffmpeg stage
COPY --from=ffmpeg /ffmpeg /usr/local/bin/
COPY --from=ffmpeg /ffprobe /usr/local/bin/

# Create user
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -s /bin/sh nestjs

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production --no-audit --prefer-offline && \
    npm cache clean --force

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

# Start application
CMD ["node", "dist/main.js"]
