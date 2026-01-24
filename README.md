# AI Reels Backend

Production-grade backend for AI-generated faceless reels platform built with NestJS, BullMQ, PostgreSQL, and FFmpeg.

## 🚀 Quick Start

**Fastest way to get started:**

```bash
npm run setup
npm run start:dev
```

See [SETUP.md](./SETUP.md) for detailed setup instructions.

## ✨ Features

- ✅ **Credit Management System** - Pay-per-use with transaction history
- ✅ **Health Checks** - Monitor service status
- ✅ **API Documentation** - Swagger UI at `/api-docs`
- ✅ **Error Handling** - Comprehensive error filtering
- ✅ **Request Logging** - Development logging interceptor
- ✅ **Easy Local Setup** - One-command setup script
- ✅ **Database Seeding** - Test data generation
- ✅ **Development Tools** - Redis Commander, pgAdmin

## Architecture

- **Queue-based**: BullMQ + Redis for job processing
- **Parallel Processing**: Fan-out/fan-in pattern after script generation
- **Stateless Workers**: Each worker runs in isolated Docker containers
- **SOLID Principles**: Extensible design with interfaces

## Tech Stack

- **Framework**: NestJS (TypeScript)
- **Queue**: BullMQ + Redis
- **Database**: PostgreSQL (TypeORM)
- **Storage**: AWS S3
- **Video Processing**: FFmpeg
- **AI Services**: OpenAI (GPT-4o, TTS), Replicate (Captions)

## System Flow

```
API Request → Orchestrator → Script Generation → Fan-out (Audio, Caption, Asset) → Fan-in → Render → Complete
```

## Setup

### Prerequisites

- Node.js 22+
- Docker & Docker Compose
- PostgreSQL 15+ (via Docker)
- Redis 7+ (via Docker)
- FFmpeg (for render workers)

### Installation

1. **Run setup script:**
```bash
npm run setup
```

2. **Edit `.env` file** with your API keys:
   - OpenAI API key
   - AWS S3 credentials
   - Replicate API token

3. **Start API server:**
```bash
npm run start:dev
```

### Development

**Start infrastructure** (PostgreSQL + Redis):
```bash
npm run infra:up
```

**Start API server:**
```bash
npm run start:dev
```

**Start workers** (in separate terminals):
```bash
npm run worker:orchestrator
npm run worker:script
npm run worker:audio
npm run worker:caption
npm run worker:asset
npm run worker:render
```

**Development tools** (optional):
```bash
npm run infra:tools  # Starts Redis Commander & pgAdmin
```

## API Endpoints

### Authentication
- `POST /auth/signup` - User registration
- `POST /auth/signin` - User login
- `POST /auth/refresh` - Refresh access token
- `GET /auth/me` - Get current user (protected)

### Videos
- `POST /videos` - Create new video (protected)
- `GET /videos` - List user's videos (protected)
- `GET /videos/:id` - Get video details

### Credits
- `GET /credits/balance` - Get credit balance (protected)
- `GET /credits/me` - Get credit info (protected)
- `GET /credits/history` - Get transaction history (protected)
- `POST /credits/purchase` - Purchase credits (protected)

### Health
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health status

### API Documentation
- `GET /api-docs` - Swagger UI (development only)

## Queue Architecture

| Queue | Worker | Responsibility |
|-------|--------|----------------|
| `video:create` | Orchestrator | Initial job setup |
| `script:generate` | Script | Generate script via GPT-4o |
| `audio:generate` | Audio | Generate TTS via OpenAI |
| `caption:generate` | Caption | Generate captions via Replicate |
| `asset:fetch` | Asset | Fetch/prepare stock assets |
| `render:video` | Render | FFmpeg video composition |
| `video:complete` | Orchestrator | Finalize job |

## Database Schema

### Users Table
- `id` (UUID, PK)
- `email` (VARCHAR, unique)
- `password_hash` (VARCHAR)
- `name` (VARCHAR)
- `credits_balance` (INTEGER, default: 0)
- `credits_purchased_total` (INTEGER, default: 0)
- `is_premium` (BOOLEAN, default: false)
- Timestamps

### Videos Table
- `id` (UUID, PK)
- `user_id` (UUID, FK)
- `topic` (TEXT)
- `status` (ENUM)
- `script` (TEXT)
- `audio_url`, `caption_url`, `asset_urls`, `final_video_url` (TEXT)
- `metadata` (JSONB)
- Timestamps

### Credit Transactions Table
- `id` (UUID, PK)
- `user_id` (UUID, FK)
- `transaction_type` (ENUM: purchase, deduction, refund, bonus, expiration)
- `amount` (INTEGER)
- `balance_after` (INTEGER)
- `description` (TEXT)
- `reference_id` (TEXT)
- `metadata` (JSONB)
- `created_at` (TIMESTAMP)

## Environment Variables

See `.env.example` for all available variables.

**Required:**
- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`
- `REDIS_HOST`, `REDIS_PORT`
- `JWT_SECRET`
- `OPENAI_API_KEY`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`
- `REPLICATE_API_TOKEN`

## Development Scripts

```bash
npm run setup          # Automated setup
npm run start:dev      # Start API with hot reload
npm run seed           # Seed test data
npm run db:reset       # Reset database + seed
npm run infra:up       # Start PostgreSQL & Redis
npm run infra:down     # Stop infrastructure
npm run infra:tools    # Start dev tools (Redis Commander, pgAdmin)
```

## Testing

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Production

**Build and start all services:**
```bash
cd docker
docker-compose up -d
```

This starts:
- API server (port 3000)
- PostgreSQL
- Redis
- All 6 workers (orchestrator, script, audio, caption, asset, render)

## Monitoring

- **Health Check**: `GET /health` or `GET /health/detailed`
- **API Docs**: `GET /api-docs` (development)
- **Redis Commander**: http://localhost:8081 (if tools profile enabled)
- **pgAdmin**: http://localhost:5050 (if tools profile enabled)

## Extensibility

The architecture follows SOLID principles for easy extensibility:

- **Swap AI Providers**: Implement interface, update provider binding
- **Swap Storage**: Implement `IStorageService` interface
- **Swap Renderers**: Implement `IVideoRenderer` interface

See `ARCHITECTURE.md` for detailed information.

## Troubleshooting

See [SETUP.md](./SETUP.md) for common issues and solutions.

## License

UNLICENSED
