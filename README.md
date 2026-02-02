# AI Reels Backend

Production-grade backend for AI-generated faceless reels platform built with NestJS, PostgreSQL, and FFmpeg.

## 🚀 Quick Start

**Fastest way to get started:**

```bash
npm run setup
npm run start:dev
```

This will check prerequisites, install dependencies, set up the `.env` file, start infrastructure (Postgres), and run migrations.

## ✨ Features

- ✅ **Robust Video Generation** - Monolithic `VideoGenerationService` with idempotency and error handling
- ✅ **Credit Management System** - Pay-per-use with transaction history
- ✅ **Health Checks** - Monitor service status
- ✅ **API Documentation** - Swagger UI at `/api-docs`
- ✅ **Error Handling** - Comprehensive error filtering
- ✅ **Request Logging** - Development logging interceptor
- ✅ **Database Seeding** - Test data generation

## Architecture

- **Monolithic Service**: `VideoGenerationService` orchestrates the entire flow (Script -> Image -> Video -> Audio/Caption -> Render) asynchronously in the background.
- **Idempotency**: Each step checks for existing artifacts to prevent duplicate generation and credit wastage.
- **SOLID Principles**: Extensible design with interfaces for AI providers, storage, and rendering.

### System Flow

1. **API Request**: User calls `POST /videos`.
2. **Orchestrator**: `VideoGenerationService` starts background process.
3. **Script**: Generates script using AI (OpenAI).
4. **Images**: Generates images for each scene (DALL-E).
5. **Video**: Converts images to video segments (Replicate/Wan).
6. **Audio/Caption**: Generates TTS and subtitles in parallel.
7. **Render**: Combines all assets using FFmpeg into a final MP4.

## Setup

### Prerequisites

- **Node.js 22+**
- **Docker & Docker Compose**
- **FFmpeg** (for local rendering)

### Environment Variables

See `.env.example` for all available variables. Main ones:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=ai_reels

# API Keys
OPENAI_API_KEY=sk-...
REPLICATE_API_TOKEN=r8_...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=...
```

### Installation

1. **Run setup script:**

   ```bash
   npm run setup
   ```

2. **Edit `.env` file** with your API keys.

3. **Start API:**
   ```bash
   npm run start:dev
   ```

## Development

**Start infrastructure** (PostgreSQL):

```bash
npm run infra:up
```

**Start API server:**

```bash
npm run start:dev
```

**Development tools** (optional):

```bash
npm run infra:tools  # Starts pgAdmin
```

## Production

**Build and start:**

```bash
npm run build
npm run start:prod
```

## API Endpoints

### Videos

- `POST /videos` - Create new video
- `GET /videos` - List user's videos
- `GET /videos/:id` - Get video details

### Authentication

- `POST /auth/signup` - User registration
- `POST /auth/signin` - User login

### Credits

- `GET /credits/balance` - Get credit balance
- `GET /credits/history` - Get transaction history

### Health

- `GET /health` - Basic health check
- `GET /api-docs` - Swagger UI (development)

## Testing

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e
```

## License

UNLICENSED
