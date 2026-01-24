# ⚡ Quick Start Guide

Get the backend running in 2 minutes!

## 🚀 Fast Setup

```bash
# 1. Install dependencies
npm install

# 2. Run automated setup
npm run setup

# 3. Start the API
npm run start:dev
```

That's it! The API will be running on http://localhost:3000

## 📝 What You Need

**Minimum (to test API):**
- Node.js 22+
- Docker (for PostgreSQL & Redis)

**For full functionality:**
- OpenAI API key
- AWS S3 credentials
- Replicate API token

## 🔧 Quick Commands

```bash
# Start everything
npm run setup && npm run start:dev

# Start infrastructure only
npm run infra:up

# Stop infrastructure
npm run infra:down

# Seed test data
npm run seed

# View API docs
# Open http://localhost:3000/api-docs
```

## ✅ Verify It Works

1. **Health check:**
```bash
curl http://localhost:3000/health
```

2. **Create test user:**
```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123","name":"Test"}'
```

3. **View Swagger docs:**
Open http://localhost:3000/api-docs

## 🐛 Troubleshooting

**Port 3000 in use?**
```bash
# Change PORT in .env
PORT=3001
```

**Database not connecting?**
```bash
# Restart infrastructure
npm run infra:down
npm run infra:up
```

**Need help?** See [SETUP.md](./SETUP.md) for detailed instructions.
