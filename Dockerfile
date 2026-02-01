# ---------- Stage 1: deps ----------
FROM node:22-slim AS deps

WORKDIR /app

# Make npm network stable (fixes EAI_AGAIN permanently)
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-factor 2 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm config set registry https://registry.npmjs.org/ \
 && npm config set prefer-online true

# Copy only dependency manifests for caching
COPY package.json package-lock.json ./

# Deterministic, faster installs
RUN npm ci --no-audit

# ---------- Stage 2: build ----------
FROM node:22-slim AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build and remove dev dependencies
RUN npm run build \
 && npm prune --omit=dev


# ---------- Stage 3: ffmpeg ----------
FROM mwader/static-ffmpeg:6.1 AS ffmpeg


# ---------- Stage 4: production ----------
FROM node:22-slim AS production

WORKDIR /app

# Copy ffmpeg binaries
COPY --from=ffmpeg /ffmpeg /usr/local/bin/
COPY --from=ffmpeg /ffprobe /usr/local/bin/

# Create non-root user (Debian Syntax)
RUN groupadd -g 1001 nodejs \
 && useradd -u 1001 -g nodejs -m -s /bin/bash nestjs

# Copy production artifacts only
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json package-lock.json ./

# Switch to non-root user
USER nestjs

EXPOSE 3000

# Start app
CMD ["node", "dist/main.js"]
