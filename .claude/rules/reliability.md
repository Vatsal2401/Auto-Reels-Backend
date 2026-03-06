---
paths:
  - "**/*.ts"
---

# Reliability & Resilience Rules

> Patterns for building services that degrade gracefully, recover automatically, and never lose data silently.

## Error Handling — External Calls

Every call to an external system (DB, Redis, Kafka, HTTP, S3, Elasticsearch) MUST have error handling:

```typescript
// BAD — unhandled external call
const cached = await this.redisClient.get(cacheKey);
const result = await this.httpService.get(url).toPromise();

// GOOD — wrapped with fallback
try {
  const cached = await this.redisClient.get(cacheKey);
  if (cached) return JSON.parse(cached);
} catch (err) {
  this.logger.warn(`${methodName}.cache-miss.${stringifyError(err)}`);
  // Fall through to DB query
}
```

### Fallback Hierarchy

When an external dependency fails, follow this priority:

| Dependency | Fallback | Action |
|-----------|----------|--------|
| Redis cache | DB query | Log warning, serve from source-of-truth |
| Elasticsearch | DB LIKE query | Log warning, slower but functional |
| Kafka produce | Retry queue (BullMQ) | Log error, enqueue for retry |
| S3 upload | Throw with context | Log error, user retries |
| External HTTP API | Cached response or error | Log error, return stale if acceptable |
| MySQL slave (read) | Master connection | Log warning, read from writer |

## Timeouts

Every external call MUST have a timeout. Never wait forever:

```typescript
// BAD — no timeout on HTTP call
const response = await this.httpService.get(url).toPromise();

// GOOD — explicit timeout
const response = await this.httpService
  .get(url, { timeout: 5000 })
  .toPromise();

// GOOD — Redis with operation timeout
const cached = await Promise.race([
  this.redisClient.get(cacheKey),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Redis timeout')), 3000),
  ),
]);
```

### Recommended Timeouts

| Operation | Timeout | Rationale |
|-----------|---------|-----------|
| Redis get/set | 3s | Fast cache, fail fast |
| MySQL simple query | 100s | Single table, indexed |
| MySQL complex join | 100s | Multi-table, reporting |
| Elasticsearch query | 40s | Search should be fast |
| External HTTP API | 100s | Depends on SLA |
| Kafka produce | 200s | Broker acknowledgment |
| ClickHouse analytics | 60s | Heavy aggregation queries |

## Retry Patterns

### BullMQ Job Retries

All BullMQ jobs MUST configure retry behavior:

```typescript
// GOOD — configured retries with backoff
await this.queue.add('process-prospect', payload, {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000, // 1s, 2s, 4s
  },
  removeOnComplete: true
});
```


### Database Transactions

Multi-step writes that must be atomic MUST use transactions:

```typescript
// GOOD — transaction for multi-table writes
async transferOwnership(fromUserId: number, toUserId: number, entityIds: number[]): Promise<void> {
  const queryRunner = this.connection.createQueryRunner();
  await queryRunner.startTransaction();

  try {
    await queryRunner.manager.update(Entity, { id: In(entityIds) }, { ownerId: toUserId });
    await queryRunner.manager.save(AuditLog, {
      action: 'ownership_transfer',
      fromUserId,
      toUserId,
      entityIds,
    });
    await queryRunner.commitTransaction();
  } catch (err) {
    await queryRunner.rollbackTransaction();
    throw err;
  } finally {
    await queryRunner.release();
  }
}
```

### Distributed Operations (Cross-Service)

For operations spanning multiple services (e.g., DB + Kafka + Redis):

```typescript
// GOOD — write to DB first (source of truth), then async side effects
async createCampaign(user: User, dto: CreateCampaignDto): Promise<CampaignEntity> {
  // Step 1: DB write (transactional, source of truth)
  const campaign = await this.campaignRepo.save({
    ...dto,
    shAccountId: user.shAccountId,
    status: CampaignStatus.DRAFT,
  });

  // Step 2: Async side effects (can be retried independently)
  try {
    await this.kafkaService.produce('campaign.created', { campaignId: campaign.id });
  } catch (err) {
    this.logger.error(`${this.createCampaign.name}.kafka-publish-failed.${stringifyError(err)}`);
    // Campaign still exists in DB — Kafka event can be replayed
  }

  try {
    await this.redisClient.del(CacheKeys.campaignList(user.shAccountId));
  } catch (err) {
    this.logger.warn(`${this.createCampaign.name}.cache-invalidation-failed.${stringifyError(err)}`);
    // Cache will expire via TTL — not critical
  }

  return campaign;
}
```

**Rule: DB write is the source of truth. Side effects (cache, events, search index) are eventually consistent.**

## Batch Processing Safety

Large batch operations MUST be chunked to prevent timeouts and memory issues:

```typescript
// BAD — unbounded batch
const allProspects = await this.prospectRepo.find({ where: { campaignId } });
for (const prospect of allProspects) {
  await this.processProspect(prospect);
}

// GOOD — chunked processing with progress tracking
const BATCH_SIZE = 200; // Use project constants
let offset = 0;
let processed = 0;

while (true) {
  const batch = await this.prospectRepo.find({
    where: { campaignId },
    take: BATCH_SIZE,
    skip: offset,
  });

  if (batch.length === 0) break;

  await Promise.all(batch.map((p) => this.processProspect(p)));
  processed += batch.length;
  offset += BATCH_SIZE;

  this.logger.log(`${methodName}.progress.${processed} processed`);
}
```

## Anti-Patterns (Reliability)

- Do NOT swallow errors silently — always log before ignoring
- Do NOT use `catch () {}` empty blocks — at minimum log a warning
- Do NOT assume Redis/Kafka/ES is always available — code for failure
- Do NOT process unbounded data sets in a single operation — chunk everything
- Do NOT mix transactional and non-transactional writes in the same operation without clear ordering
- Do NOT retry indefinitely — set max attempts and alert on exhaustion
- Do NOT log `error.message` only — use `stringifyError(err)` for full context including stack trace
