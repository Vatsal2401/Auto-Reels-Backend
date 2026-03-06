---
paths:
  - "**/*.ts"
---

# Performance Rules

> Backend performance patterns for NestJS + TypeORM + Redis.

## Database Performance
- **No N+1 queries** — use `relations` option or query builder `.leftJoinAndSelect()`
- **Paginate all list endpoints** — never return unbounded result sets
- **Index frequently filtered columns** — `userId`, `accountId`, `status`, `createdAt`
- **Use `select` to limit columns** — don't fetch entire entities when you need 2 fields
- **Batch operations** — use `save([...entities])` instead of looping `save(entity)`


```typescript
// BAD: N+1 query
const users = await this.userRepo.find();
for (const user of users) {
  user.account = await this.accountRepo.findOne({ where: { id: user.accountId } });
}

// GOOD: Single query with join
const users = await this.userRepo.find({ relations: ['account'] });
```

## Redis Caching
- Cache frequently read, rarely written data (user profiles, feature flags, plan limits)
- **Always set TTL** — no indefinite caching. Typical: 1h for profiles, 5m for lists
- **Invalidate on write** — delete cache key after any mutation
- **Cache serialization** — `JSON.stringify/parse` for objects, raw strings for simple values
- **Don't cache large datasets** — keep cached values under 1MB

## Query Builder Performance
```typescript
// Use query builder for complex queries instead of multiple finds
const result = await this.featureRepo
  .createQueryBuilder('f')
  .leftJoinAndSelect('f.user', 'u')
  .where('f.accountId = :accountId', { accountId })
  .andWhere('f.isActive = :isActive', { isActive: true })
  .orderBy('f.createdAt', 'DESC')
  .skip(offset)
  .take(limit)
  .getManyAndCount();
```

## Background Job Performance
- Move slow operations to BullMQ jobs (email sending, report generation, bulk updates)
- Set appropriate concurrency per queue
- Use batch processing for bulk operations (process 100 at a time, not 10,000)

## API Response Performance
- Return only what the client needs — use DTOs to shape response
- Compress responses for large payloads (NestJS compression middleware)
- Set appropriate HTTP cache headers for read-heavy endpoints

## Event Loop Blocking

Node.js is single-threaded. Synchronous or CPU-heavy operations in the request path block ALL concurrent requests.

**Never do these in a request handler or service method:**

```typescript
// BAD — synchronous file read blocks event loop
const config = fs.readFileSync('/path/to/file.json', 'utf8');

// BAD — heavy CPU work in request path
const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512');

// BAD — large JSON parse in request handler (>1MB payloads)
const data = JSON.parse(hugeJsonString); // blocks until complete

// BAD — tight loop with no yielding
for (let i = 0; i < 1_000_000; i++) {
  results.push(expensiveComputation(items[i]));
}
```

**Do this instead:**

```typescript
// GOOD — async file read
const config = await fs.promises.readFile('/path/to/file.json', 'utf8');

// GOOD — async crypto
const hash = await new Promise((resolve, reject) => {
  crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, key) =>
    err ? reject(err) : resolve(key.toString('hex')),
  );
});

// GOOD — move heavy work to BullMQ job
await this.queue.add('generate-report', { accountId, filters });
return { jobId, message: 'Report generation started' };

// GOOD — chunked processing with setImmediate to yield
async function processInChunks(items: Item[], chunkSize = 500): Promise<void> {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await Promise.all(chunk.map(processItem));
    // Yield to event loop between chunks
    await new Promise((resolve) => setImmediate(resolve));
  }
}
```

**Rules:**
- No `*Sync` methods from `fs`, `crypto`, `child_process` in production code
- JSON parsing of external/user payloads >1MB → stream with `JSONStream` or move to worker
- CPU-bound work (report generation, CSV parsing, image processing) → BullMQ background job
- Loops over >10,000 items → chunk and yield with `setImmediate`

## Memory Leak Prevention

Memory leaks cause gradual RSS growth, eventual OOM kills, and degraded performance before crash.

### Common Leak Patterns

```typescript
// BAD — event listener leak (listener added on every request, never removed)
@Injectable()
export class FeatureService {
  onModuleInit() {
    // This is fine — once at startup
    this.eventEmitter.on('feature.updated', this.handleUpdate);
  }

  async processRequest() {
    // BAD — new listener on every request!
    this.eventEmitter.on('feature.updated', (data) => { ... });
  }
}

// GOOD — register once, or remove after use
async processRequest() {
  const handler = (data) => { ... };
  this.eventEmitter.once('feature.updated', handler); // auto-removes after one call
}
```

```typescript
// BAD — unbounded array accumulation
@Injectable()
export class AnalyticsService {
  private buffer: AnalyticsEvent[] = []; // grows forever if flush fails

  track(event: AnalyticsEvent) {
    this.buffer.push(event);
  }
}

// GOOD — bounded buffer with max size
@Injectable()
export class AnalyticsService {
  private buffer: AnalyticsEvent[] = [];
  private readonly MAX_BUFFER = 10000;

  track(event: AnalyticsEvent) {
    if (this.buffer.length >= this.MAX_BUFFER) {
      this.logger.warn('analytics-buffer-full.dropping-oldest');
      this.buffer.shift();
    }
    this.buffer.push(event);
  }
}
```

```typescript
// BAD — unclosed stream/queryRunner
async exportData(accountId: number): Promise<void> {
  const queryRunner = this.connection.createQueryRunner();
  const stream = queryRunner.stream('SELECT * FROM prospects WHERE account_id = ?', [accountId]);
  // If error occurs, queryRunner is never released → connection pool leak
}

// GOOD — always release in finally
async exportData(accountId: number): Promise<void> {
  const queryRunner = this.connection.createQueryRunner();
  try {
    const stream = await queryRunner.stream('SELECT * FROM prospects WHERE account_id = ?', [accountId]);
    await this.processStream(stream);
  } finally {
    await queryRunner.release(); // Always release
  }
}
```

### Memory Leak Checklist

- **Event listeners** — Register at module init, not per-request. Use `.once()` for one-shot handlers. Remove listeners in `onModuleDestroy`
- **Streams** — Always handle `error` event. Close/destroy on completion. Release queryRunners in `finally`
- **Buffers/caches** — In-memory collections must have a max size or TTL. Use Redis for unbounded caches, not in-process Maps
- **Closures** — Avoid closures that capture large objects (entities, request objects) in long-lived callbacks or timers
- **setInterval** — Every `setInterval` must have a corresponding `clearInterval` in `onModuleDestroy`
- **Connection pools** — QueryRunners must be released in `finally` blocks. Monitor pool usage via Prometheus

### What to Move Out of Process Memory

| Data | Where | Why |
|------|-------|-----|
| Cache (any size) | Redis | Shared across instances, TTL, eviction policies |
| Session data | Redis | Survives restarts, shared across instances |
| Job queues | BullMQ (Redis-backed) | Persistent, retryable, distributed |
| Large result sets | Stream to client / S3 | Don't buffer entire dataset in memory |
| Analytics events | Kafka / ClickHouse | Fire-and-forget, don't accumulate |

## Anti-Patterns
- Do NOT use `synchronize: true` — it locks tables and is destructive in production
- Do NOT run migrations on application startup in production
- Do NOT make sequential external API calls — use `Promise.all` for independent calls
- Do NOT log entire request/response bodies — log IDs and metadata only
- Do NOT use `*Sync` methods (`readFileSync`, `pbkdf2Sync`) in production request paths
- Do NOT accumulate unbounded arrays or Maps in service-level properties
- Do NOT register event listeners per-request without removing them
- Do NOT hold QueryRunners or streams without `finally` cleanup
