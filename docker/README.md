# Docker Setup for Local Testing

## Quick Start

1. **Make sure you're in the docker directory:**
```bash
cd docker
```

2. **Start all services:**
```bash
docker-compose up -d
```

3. **Check logs:**
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f orchestrator-worker
```

4. **Test the API:**
```bash
curl http://localhost:3000/videos -X POST -H "Content-Type: application/json" -d '{"topic": "test video"}'
```

5. **Stop all services:**
```bash
docker-compose down
```

## Services

- **postgres**: Database (port 5432)
- **redis**: Queue broker (port 6379)
- **api**: NestJS API server (port 3000)
- **orchestrator-worker**: Orchestrates job flow
- **script-worker**: Generates scripts
- **audio-worker**: Generates audio
- **caption-worker**: Generates captions
- **asset-worker**: Fetches assets
- **render-worker**: Renders final video

## Notes

- API keys can be empty for testing - services will start but AI features will fail at runtime
- Database will auto-create on first run
- All workers connect to the same Redis and PostgreSQL instances
- Check logs if services fail to start
