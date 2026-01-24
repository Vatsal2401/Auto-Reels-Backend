#!/bin/bash

set -e

echo "🚀 AI Reels Backend - Local Setup Script"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 22+${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
    echo -e "${RED}❌ Node.js version must be 22 or higher. Current: $(node -v)${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js $(node -v)${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm $(npm -v)${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker is not installed. You'll need it for PostgreSQL and Redis${NC}"
else
    echo -e "${GREEN}✅ Docker $(docker --version | cut -d' ' -f3 | cut -d',' -f1)${NC}"
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker Compose is not installed${NC}"
else
    echo -e "${GREEN}✅ Docker Compose available${NC}"
fi

echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "🔧 Setting up environment..."

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}✅ Created .env file from .env.example${NC}"
        echo -e "${YELLOW}⚠️  Please edit .env file with your API keys and credentials${NC}"
    else
        echo -e "${YELLOW}⚠️  .env.example not found. Creating basic .env file...${NC}"
        cat > .env << EOF
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=ai_reels
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=$(openssl rand -hex 32)
EOF
    fi
else
    echo -e "${GREEN}✅ .env file already exists${NC}"
fi

echo ""
echo "🐳 Starting infrastructure services (PostgreSQL & Redis)..."

# Start PostgreSQL and Redis using Docker Compose
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
else
    echo -e "${RED}❌ Docker Compose not available. Please start PostgreSQL and Redis manually${NC}"
    exit 1
fi

cd docker
$DOCKER_COMPOSE_CMD -f docker-compose.dev.yml up -d postgres redis
cd ..

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 3

# Check PostgreSQL
if docker ps | grep -q postgres; then
    echo -e "${GREEN}✅ PostgreSQL is running${NC}"
else
    echo -e "${RED}❌ PostgreSQL failed to start${NC}"
fi

# Check Redis
if docker ps | grep -q redis; then
    echo -e "${GREEN}✅ Redis is running${NC}"
else
    echo -e "${RED}❌ Redis failed to start${NC}"
fi

echo ""
echo "🗄️  Setting up database..."

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker exec $(docker ps -qf "name=postgres") pg_isready -U postgres &> /dev/null; then
        echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ PostgreSQL took too long to start${NC}"
        exit 1
    fi
    sleep 1
done

# Run migrations if they exist
if [ -d "src/migrations" ] && [ "$(ls -A src/migrations 2>/dev/null)" ]; then
    echo "Running database migrations..."
    npm run migration:run || echo -e "${YELLOW}⚠️  Migrations failed or not configured${NC}"
else
    echo -e "${YELLOW}⚠️  No migrations found. Database will be auto-synced in development mode${NC}"
fi

echo ""
echo -e "${GREEN}✨ Setup complete!${NC}"
echo ""
echo "📝 Next steps:"
echo "1. Edit .env file with your API keys (OpenAI, AWS S3, Replicate)"
echo "2. Start the API server: npm run start:dev"
echo "3. Start workers in separate terminals: npm run worker:orchestrator, etc."
echo ""
echo "📚 For more information, see README.md"
