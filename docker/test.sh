#!/bin/bash

echo "🚀 Starting AI Reels Backend with Docker Compose..."
echo ""

cd "$(dirname "$0")"

echo "📦 Building and starting services..."
docker-compose up -d --build

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 10

echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "📝 Recent logs from API:"
docker-compose logs --tail=20 api

echo ""
echo "✅ Setup complete!"
echo ""
echo "🌐 API is available at: http://localhost:3000"
echo "📚 Test with: curl http://localhost:3000/videos -X POST -H 'Content-Type: application/json' -d '{\"topic\": \"test\"}'"
echo ""
echo "📋 View logs: docker-compose logs -f"
echo "🛑 Stop services: docker-compose down"
