#!/bin/bash

# Development helper script - starts all services in development mode

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🚀 Starting AI Reels Backend in Development Mode${NC}"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Run ./scripts/setup.sh first${NC}"
    exit 1
fi

# Start infrastructure if not running
echo "Checking infrastructure services..."
if ! docker ps | grep -q postgres; then
    echo "Starting PostgreSQL..."
    cd docker && docker-compose up -d postgres redis && cd ..
    sleep 3
fi

echo ""
echo "Available commands:"
echo "  npm run start:dev          - Start API server"
echo "  npm run worker:orchestrator - Start orchestrator worker"
echo "  npm run worker:script      - Start script worker"
echo "  npm run worker:audio       - Start audio worker"
echo "  npm run worker:caption     - Start caption worker"
echo "  npm run worker:asset       - Start asset worker"
echo "  npm run worker:render      - Start render worker"
echo ""
echo "Or use: npm run dev:all      - Start all workers (requires pm2 or similar)"
echo ""
