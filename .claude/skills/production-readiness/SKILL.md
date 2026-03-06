---
name: production-readiness
description: Use when preparing features for production deployment — monitoring, alerting, performance targets, graceful shutdown, and operational readiness checklists
---

# Production Readiness Skill

> Patterns for building production-grade NestJS services: observability, performance targets, graceful lifecycle management, and deployment checklists.

## When to Use This Skill

- Preparing a new feature or module for production deployment
- Adding monitoring, metrics, or alerting to existing services
- Reviewing operational readiness before a release
- Debugging production performance issues
- Setting up health checks or graceful shutdown

---

## 1. Observability Stack

### Logger Setup

Every service MUST use the NestJS Logger (wraps Pino via `@salesahandy/observability`):


### Log Format Rules
**Rules:**
- Always include `userId` and `shAccountId` for traceability in the log line
- Never log tokens, passwords, or full request/response bodies
- Use `stringifyError(err)` from `src/common/utils` — never `err.message` alone

### Distributed Tracing

Use `@Span()` from `@salesahandy/observability` on all key service methods:

```typescript
import { Span } from '@salesahandy/observability';

@Injectable()
export class FeatureService {
  @Span()
  async create(user: User, dto: CreateFeatureDto): Promise<FeatureEntity> {
    // Automatically traced with OpenTelemetry
  }

  @Span()
  async findAll(user: User, query: ListFeaturesDto): Promise<FeatureEntity[]> {
    // Each span appears in trace waterfall
  }
}
```

**Where to add `@Span()`:**
- All critical public service methods which could be required for debugging
- Repository methods with complex queries (joins, subqueries)
- External service calls (HTTP, Kafka produce, S3 operations)

**Where NOT to add `@Span()`:**
- Simple getters/setters
- Pure utility functions
- Private helper methods (unless they make external calls)

### Swagger Documentation

Every controller MUST have complete Swagger coverage:

```typescript
@ApiTags('Features')
@ApiBearerAuth()
@Controller(['/features', '/api/edge/features'])
export class FeatureController {
  @ApiOperation({ summary: 'Create a new feature' })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequiredPermissions([Permissions.FEATURE_WRITE])
  @Message('Feature created successfully')
  @Post('/')
  async create(@GetUser() user: User, @Body() dto: CreateFeatureDto) {
    return this.featureService.create(user, dto);
  }
}
```

**Required decorators:**
- Class level: `@ApiTags()`, `@ApiBearerAuth()`
- Method level: `@ApiOperation({ summary: '...' })` on every endpoint
- DTO level: `@ApiProperty()` or `@ApiPropertyOptional()` on every field

---

## 2. Performance Targets

### Response Time Budgets

| Endpoint Type | Target P95 | Max P99 | Action if Exceeded |
|--------------|-----------|---------|-------------------|
| Simple CRUD (get by ID) | <50ms | <200ms | Check indexes, add cache |
| List with pagination | <200ms | <500ms | Add Redis cache, optimize query |
| Search (Elasticsearch) | <300ms | <1s | Check ES cluster health, query optimization |
| Complex aggregation | <1s | <3s | Move to ClickHouse, background job |
| File upload (S3) | <5s | <30s | Stream upload, presigned URLs |
| Bulk operation | Background job | N/A | Use BullMQ, return job ID |

### Query Performance

```typescript
// BAD — fetching everything when you need 2 fields
const users = await this.userRepo.find({ where: { shAccountId } });
const names = users.map((u) => u.firstName);

// GOOD — select only needed fields
const users = await this.userRepo.find({
  where: { shAccountId },
  select: ['id', 'firstName'],
});

// GOOD — query builder for complex queries with performance hints
const results = await this.featureRepo
  .createQueryBuilder('f')
  .select(['f.id', 'f.name', 'f.status'])
  .where('f.shAccountId = :shAccountId', { shAccountId })
  .orderBy('f.createdAt', 'DESC')
  .take(25)
  .skip(0)
  .getMany();
```

### Pagination — MANDATORY for List Endpoints

Every endpoint that returns a list MUST support pagination:

```typescript
// DTO
export class ListFeaturesDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;
}

// Service
async findAll(user: User, query: ListFeaturesDto): Promise<[FeatureEntity[], number]> {
  const { page = 1, limit = 25 } = query;
  return this.featureRepo.findAndCount({
    where: { shAccountId: user.shAccountId },
    take: limit,
    skip: (page - 1) * limit,
    order: { createdAt: 'DESC' },
  });
}
```

### Caching Strategy

```typescript
// Cache-aside pattern with Redis
async findById(id: number, shAccountId: number): Promise<FeatureEntity> {
  const cacheKey = CacheKeys.feature(id);

  try {
    const cached = await this.redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (err) {
    this.logger.warn(`findById.cache-miss.${stringifyError(err)}`);
  }

  const entity = await this.featureRepo.findOne({
    where: { id, shAccountId },
  });

  if (!entity) throw new GeneralException(ApiErrors.feature.notFound);

  try {
    await this.redisClient.set(cacheKey, JSON.stringify(entity), 'EX', 3600);
  } catch (err) {
    this.logger.warn(`findById.cache-set-failed.${stringifyError(err)}`);
  }

  return entity;
}

// CRITICAL: Invalidate on write
async update(id: number, dto: UpdateFeatureDto): Promise<FeatureEntity> {
  await this.featureRepo.update(id, dto);
  await this.redisClient.del(CacheKeys.feature(id)); // Invalidate
  return this.featureRepo.findOne({ where: { id } });
}
```

**Cache TTL Guidelines:**
| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| User profile | 5-15 min | Changes infrequently, moderate staleness OK |
| Permissions/roles | 5 min | Security-sensitive, needs freshness |
| Feature flags | 1-5 min | Changes via admin, needs propagation |
| List counts | 1-5 min | Approximate OK for UI |
| Entity by ID | 30-60 min | Invalidated on write |
| Config/settings | 15-30 min | Rarely changes |

---

## 3. Graceful Lifecycle Management

### Application Shutdown

NestJS `OnModuleDestroy` and `OnApplicationShutdown` for cleanup:

```typescript
@Injectable()
export class FeatureService implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    // Close connections, flush buffers, complete in-flight requests
    this.logger.log('FeatureService shutting down...');
  }
}
```

### Queue Worker Shutdown

BullMQ workers MUST handle graceful shutdown to avoid losing jobs:

```typescript
// Worker should finish current job before shutting down
@OnQueueActive()
async onActive(job: Job): Promise<void> {
  this.logger.log({ label: 'job-started', jobId: job.id, queue: job.queue.name });
}

@OnQueueCompleted()
async onCompleted(job: Job): Promise<void> {
  this.logger.log({ label: 'job-completed', jobId: job.id, queue: job.queue.name });
}
```

### Connection Pool Management

- MySQL: `connectionLimit: 60` (configured in `database-config`)
- Redis: Multiple pools (client, group1-3 queues, subscriber)
- Monitor pool exhaustion via Prometheus metrics

---

## 4. Pre-Deployment Checklist

Use this checklist before any feature goes to production.

### Functionality
- [ ] All acceptance criteria from spec are met
- [ ] Edge cases handled (empty state, max limits, concurrent access)
- [ ] Error responses match API contract (`GeneralException` with `ApiErrors`)

### Security
- [ ] Auth guards on all protected endpoints (`JwtAuthGuard` + `PermissionsGuard`)
- [ ] `@RequiredPermissions([Permissions.X])` with correct permission
- [ ] Input validation via class-validator DTOs (no raw `req.body`)
- [ ] Multi-tenant isolation: all queries filter by `shAccountId`
- [ ] No secrets in code, logs, or error responses
- [ ] Audit logging for sensitive operations

### Performance
- [ ] List endpoints paginated (skip/take, max 100 per page)
- [ ] Frequently queried columns have DB indexes
- [ ] N+1 queries resolved (use `relations` or query builder joins)
- [ ] Redis cache for read-heavy data with TTL and invalidation
- [ ] `select` specific fields instead of full entity where possible
- [ ] Independent async operations use `Promise.all`

### Reliability
- [ ] External calls wrapped in try/catch with fallbacks
- [ ] Timeouts on all external calls (HTTP, Redis, ES)
- [ ] BullMQ jobs have retry config (attempts, backoff)
- [ ] Kafka consumers are idempotent
- [ ] Batch operations chunked (not unbounded)
- [ ] Transactions for multi-table atomic writes

### Observability
- [ ] `@Span()` on key service methods
- [ ] Structured logging with `userId`, `shAccountId` context
- [ ] Error logging uses `stringifyError(err)`
- [ ] `@ApiOperation()` on every controller method
- [ ] `@ApiProperty()` on every DTO field

### Testing
- [ ] Unit tests for business logic and utility functions
- [ ] Edge case tests (null, empty, boundary values)
- [ ] All tests pass: `npm run test -- --passWithNoTests`
- [ ] Typecheck passes: `npx tsc --noEmit`
- [ ] Lint passes: `npm run lint`
- [ ] Build succeeds: `npm run build`

### Database
- [ ] Migrations created for schema changes (never `synchronize: true`)
- [ ] New entities have `shAccountId`, `createdAt`, `updatedAt`
- [ ] Soft delete (`deletedAt`) for user-facing data
- [ ] Read-after-write uses master connection
- [ ] Indexes on foreign keys and frequently filtered columns

---

## 5. Common Production Issues & Fixes

| Issue | Symptom | Fix |
|-------|---------|-----|
| Connection pool exhaustion | Requests hang, then timeout | Check for leaked connections (missing `release()` in queryRunner) |
| Redis memory spike | OOM errors | Verify TTL on all cache keys, check for missing invalidation |
| Kafka consumer lag | Events processing slowly | Check consumer group, increase partitions, optimize handler |
| N+1 queries | Endpoint slow, DB CPU high | Use `relations` option or query builder joins |
| Missing index | Slow queries on filtered columns | Add `@Index()` to entity or migration |
| Slave replication lag | Stale reads after write | Use master for read-after-write, add delay or verify |
| Memory leak in worker | Process RSS grows over time | Check for accumulated arrays, event listener leaks, unclosed streams |
| Unhandled promise rejection | Process crash | Wrap all async code in try/catch, use `stringifyError` |

---

## 6. Migration Safety

Database migrations in production MUST be backward-compatible:

```typescript
// BAD — breaking migration (drops column that running code needs)
await queryRunner.query('ALTER TABLE features DROP COLUMN old_status');

// GOOD — safe migration (add new, backfill, then remove old in NEXT release)
// Migration 1: Add new column
await queryRunner.query('ALTER TABLE features ADD COLUMN status_v2 VARCHAR(50)');
// Migration 2 (next release): Backfill and switch
// Migration 3 (next next release): Drop old column
```

**Rules:**
- Never drop columns or tables in the same release that removes code references
- Add columns as nullable or with defaults
- Backfill data in a separate migration or background job
- Test migrations on a production-sized dataset before deploying
