# Production Deployment Guide

This guide covers production-ready deployment of the AI Reels backend.

## 🚀 Production Checklist

### Pre-Deployment

- [ ] All environment variables are set and validated
- [ ] Database migrations are up to date
- [ ] SSL/TLS certificates are configured
- [ ] Database backups are configured
- [ ] Monitoring and logging are set up
- [ ] Rate limiting is configured appropriately
- [ ] CORS origins are restricted to production domains
- [ ] API keys and secrets are stored securely (not in code)
- [ ] Health checks are configured
- [ ] Resource limits are set appropriately

## 📋 Environment Variables

### Required Variables

```env
# Application
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://yourdomain.com

# Database
DB_HOST=your-db-host
DB_PORT=5432
DB_USERNAME=your-db-user
DB_PASSWORD=your-secure-password
DB_DATABASE=ai_reels
DB_SSL=true  # Enable for production databases
DB_POOL_MAX=20
DB_POOL_MIN=5

# Redis
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password  # Recommended for production

# JWT
JWT_SECRET=your-very-secure-secret-key-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_REFRESH_EXPIRES_IN=7d

# OpenAI
OPENAI_API_KEY=your-openai-key

# AWS S3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name

# Replicate (Optional)
REPLICATE_API_TOKEN=your-token

# OAuth (Optional)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret
```

## 🐳 Docker Deployment

### Using Docker Compose

```bash
cd docker
docker-compose up -d
```

This will start:
- API server (port 3000)
- PostgreSQL database
- Redis cache
- All 6 workers (orchestrator, script, audio, caption, asset, render)

### Health Checks

All services include health checks:
- API: `GET /health`
- Database: PostgreSQL readiness check
- Redis: Redis ping check

### Resource Limits

Default resource limits (can be adjusted in docker-compose.yml):
- **API**: 2 CPU, 2GB RAM
- **Workers**: 1-2 CPU, 1-2GB RAM each
- **PostgreSQL**: 2 CPU, 2GB RAM
- **Redis**: 1 CPU, 1GB RAM

## 🔒 Security Best Practices

### 1. Environment Variables
- Never commit `.env` files
- Use secrets management (AWS Secrets Manager, HashiCorp Vault, etc.)
- Rotate secrets regularly
- Use different secrets for each environment

### 2. Database
- Enable SSL/TLS connections (`DB_SSL=true`)
- Use strong passwords
- Restrict database access to application servers only
- Enable database backups
- Monitor for suspicious activity

### 3. API Security
- Rate limiting is enabled (100 requests/minute per IP)
- Helmet.js security headers are configured
- CORS is restricted to production domains
- Request size limits (10MB)
- Input validation on all endpoints

### 4. JWT Tokens
- Use strong, random secrets (minimum 32 characters)
- Set appropriate expiration times
- Use refresh tokens for long-lived sessions
- Rotate secrets periodically

### 5. Network Security
- Use HTTPS/TLS for all external communication
- Restrict database and Redis access to private networks
- Use firewall rules to limit access
- Consider using a VPN or private network

## 📊 Monitoring

### Health Endpoints

- **Basic Health**: `GET /health`
- **Detailed Health**: `GET /health/detailed`

### Logging

Logs are structured and include:
- Timestamp
- Log level
- Message
- Context (request path, method, etc.)
- Error stack traces (development only)

### Recommended Monitoring Tools

- **Application Monitoring**: New Relic, Datadog, Sentry
- **Infrastructure**: Prometheus + Grafana
- **Log Aggregation**: ELK Stack, CloudWatch, Datadog
- **Uptime Monitoring**: Pingdom, UptimeRobot

### Key Metrics to Monitor

- API response times
- Error rates
- Queue lengths (BullMQ)
- Database connection pool usage
- Redis memory usage
- Worker processing times
- Video generation success rate

## 🔄 Database Migrations

### Run Migrations

```bash
npm run migration:run
```

### Rollback Migrations

```bash
npm run migration:revert
```

### Generate New Migration

```bash
npm run migration:generate -n MigrationName
```

**Important**: Always test migrations in staging before production!

## 🚨 Error Handling

### Production Error Responses

In production, error responses hide internal details:
- 500 errors return generic "Internal server error"
- Stack traces are not exposed
- Detailed error messages are logged server-side only

### Logging

- Errors are logged with full context
- Stack traces are preserved in logs
- Sensitive data is not logged

## ⚡ Performance Optimization

### Database
- Connection pooling is configured (min: 5, max: 20)
- Query timeouts are set (30 seconds)
- Indexes should be added for frequently queried fields

### Redis
- Memory limits are configured (512MB default)
- LRU eviction policy is enabled
- Persistence is enabled (AOF)

### API
- Response compression is enabled
- Request size limits prevent DoS
- Rate limiting prevents abuse

## 🔄 Scaling

### Horizontal Scaling

The API can be scaled horizontally:
```bash
docker-compose up -d --scale api=3
```

### Worker Scaling

Workers can be scaled independently:
```bash
docker-compose up -d --scale script-worker=2 --scale render-worker=3
```

### Database Scaling

- Use read replicas for read-heavy workloads
- Consider connection pooling at the database level
- Monitor connection pool usage

## 🛡️ Backup Strategy

### Database Backups

```bash
# Manual backup
pg_dump -h $DB_HOST -U $DB_USERNAME $DB_DATABASE > backup.sql

# Automated backups (recommended)
# Use your cloud provider's backup service or cron jobs
```

### Redis Persistence

Redis is configured with AOF (Append Only File) persistence.

## 🔧 Maintenance

### Updating the Application

1. Pull latest code
2. Build new Docker images
3. Run database migrations
4. Deploy new containers
5. Verify health checks

```bash
cd docker
docker-compose pull
docker-compose build
docker-compose up -d
```

### Zero-Downtime Deployment

For zero-downtime deployments:
1. Deploy new containers alongside old ones
2. Update load balancer to point to new containers
3. Wait for health checks to pass
4. Remove old containers

## 📝 Production Checklist

Before going live:

- [ ] All environment variables configured
- [ ] Database migrations run
- [ ] SSL certificates installed
- [ ] CORS configured for production domain
- [ ] Rate limiting configured
- [ ] Monitoring set up
- [ ] Logging configured
- [ ] Backups configured
- [ ] Health checks working
- [ ] Load testing completed
- [ ] Security audit completed
- [ ] Documentation updated

## 🆘 Troubleshooting

### Application Won't Start

1. Check environment variables
2. Verify database connectivity
3. Check Redis connectivity
4. Review application logs

### High Error Rates

1. Check database connection pool
2. Verify Redis is responding
3. Check worker logs
4. Review API rate limits

### Performance Issues

1. Monitor database query performance
2. Check Redis memory usage
3. Review worker processing times
4. Check API response times

## 📞 Support

For production issues:
1. Check application logs
2. Review health endpoints
3. Check infrastructure metrics
4. Contact DevOps team
