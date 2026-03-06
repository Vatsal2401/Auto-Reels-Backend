---
name: infrastructure-services
description: Use when working with Redis, S3, Elasticsearch/OpenSearch, ClickHouse, BullMQ queues, Kafka events, or service-broker patterns
---

# Infrastructure Services Patterns

Patterns for all infrastructure integrations in the codebase: Redis, AWS S3, Elasticsearch/OpenSearch, ClickHouse, BullMQ, Kafka, and the service-broker pattern.

## When to Activate
- Working with Redis caching
- Uploading/downloading files from S3
- Searching or indexing with Elasticsearch/OpenSearch
- Writing analytics to ClickHouse
- Creating background job queues
- Producing/consuming Kafka events
- Calling external microservices

## Redis (Multiple Connections)

The `RedisClientService` has multiple Redis connections:

```typescript
@Injectable()
export class RedisClientService {
  public readonly client: Redis;            // Main cache operations
  readonly group1Queue: Redis;              // Isolated queue connection
  readonly group2Queue: Redis;              // Isolated queue connection
  readonly group3Queue: Redis;              // Isolated queue connection
  readonly sequenceScoreSubscriber: Redis;  // Pub/sub for scoring
}
```

### Cache-Aside Pattern (Actual)

```typescript
import { RedisClientService } from 'src/redis/redis-client.service';
import { CacheKeys } from 'src/redis/constants/cache-keys';

@Injectable()
export class FeatureService {
  constructor(private readonly redisClientService: RedisClientService) {}

  @Span()
  async findAll(user: User, query: ListDto) {
    // 1. Check cache
    const cacheKey = CacheKeys.FEATURE_LIST(user.shAccountId);
    const cached = await this.redisClientService.client.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // 2. Query DB
    const [data, total] = await this.featureRepo.findByAccountId(
      user.shAccountId, query.skip, query.take,
    );

    // 3. Cache result with TTL
    await this.redisClientService.client.set(
      cacheKey,
      JSON.stringify({ data, total }),
      'EX',
      3600,  // 1 hour TTL
    );

    return { data, total };
  }

  async create(user: User, dto: CreateDto) {
    const saved = await this.featureRepo.save(entity);

    // 4. Invalidate cache on write
    await this.redisClientService.client.del(
      CacheKeys.FEATURE_LIST(user.shAccountId),
    );

    return saved;
  }
}
```

### Cache Key Constants Pattern

```typescript
// src/redis/constants/cache-keys.ts
export const CacheKeys = {
  USER_PROFILE: (userId: number) => `user:profile:${userId}`,
  FEATURE_LIST: (shAccountId: number) => `feature:list:${shAccountId}`,
  PERMISSIONS: (userId: number) => `permissions:${userId}`,
  PLAN_RESTRICTIONS: (planId: number) => `plan:restrictions:${planId}`,
  // Typed functions — key structure is: domain:resource:identifier
};
```

**Redis rules:**
- Always use `CacheKeys` constants — never hardcode key strings
- Always set TTL with `'EX', seconds` — no indefinite caching
- Invalidate on write — `del` the cache key after mutations
- Use `this.redisClientService.client` for cache operations
- Pattern-based invalidation: `client.keys()` for wildcard cleanup (use sparingly)

## AWS S3 (Dual SDK)

The project uses **both** AWS SDK v2 (streaming) and v3 (async operations):

```typescript
import { S3ManagerService } from 'src/common/services/aws/s3-manager.service';

@Injectable()
export class FeatureService {
  constructor(private readonly s3ManagerService: S3ManagerService) {}

  // Upload file
  async uploadFile(buffer: Buffer, fileName: string) {
    return this.s3ManagerService.uploadFileToS3Bucket(
      this.appConfigService.s3FeatureBucketName,
      fileName,
      buffer,
    );
  }

  // Stream upload for large files (CSV exports, etc.)
  async exportToCsv() {
    const { promise, s3WriteStream } = this.s3ManagerService.uploadFileToS3ViaStream({
      bucket: this.appConfigService.s3ExportBucketName,
      key: `exports/${userId}/${Date.now()}.csv.gz`,
      contentType: 'text/csv',
      contentEncoding: 'gzip',
    });

    // Pipe data to stream
    dataStream.pipe(s3WriteStream);

    // Wait for upload to complete
    await promise;
  }

  // Get signed download URL (30 min default)
  getDownloadUrl(key: string): string {
    return this.s3ManagerService.getSignedUrl(
      key,
      this.appConfigService.s3FeatureBucketName,
      1800,  // 30 minutes
    );
  }

  // Get file from S3
  async getFile(key: string) {
    return this.s3ManagerService.getS3ObjectStream(
      key,
      this.appConfigService.s3FeatureBucketName,
    );
  }

  // Delete file
  async deleteFile(key: string) {
    return this.s3ManagerService.deleteObject(
      key,
      this.appConfigService.s3FeatureBucketName,
    );
  }
}
```

**S3 bucket names** are in `AppConfigService` (8 different buckets for different purposes: attachments, CSV imports, exports, images, etc.)

## Elasticsearch / OpenSearch

The project uses OpenSearch client (compatible with Elasticsearch):

```typescript
import { ElasticsearchClientService } from 'src/elasticsearch/services/elasticsearch-client.service';

@Injectable()
export class NoteSearchService {
  constructor(
    private readonly esClient: ElasticsearchClientService,
  ) {}

  // Search documents
  async searchNotes(shAccountId: number, query: string, pagination: { from: number; size: number }) {
    return this.esClient.search({
      index: this.esClient.indices.PROSPECT_NOTE,
      body: {
        query: {
          bool: {
            must: [
              { match: { shAccountId } },
              { multi_match: { query, fields: ['content', 'title'] } },
            ],
          },
        },
      },
      from: pagination.from,
      size: pagination.size,
    });
  }

  // Index a document
  async indexNote(noteId: string, note: NoteDocument) {
    return this.esClient.index({
      index: this.esClient.indices.PROSPECT_NOTE,
      id: noteId,
      body: note,
    });
  }

  // Bulk operations
  async bulkIndexNotes(notes: NoteDocument[]) {
    const body = notes.flatMap((note) => [
      { index: { _index: this.esClient.indices.PROSPECT_NOTE, _id: note.id } },
      note,
    ]);
    return this.esClient.bulk({ body });
  }

  // Delete document
  async deleteNote(noteId: string) {
    return this.esClient.delete({
      index: this.esClient.indices.PROSPECT_NOTE,
      id: noteId,
    });
  }
}
```

**Elasticsearch is a `@Global()` module** — inject `ElasticsearchClientService` anywhere.

## ClickHouse (Analytics)

Used for time-series analytics data:

```typescript
import { Inject } from '@nestjs/common';
import { CLICKHOUSE_CLIENT } from 'src/database-config/clickhouse.constants';
import { ClickHouseClient } from '@clickhouse/client';

@Injectable()
export class AnalyticsRepository {
  constructor(
    @Inject(CLICKHOUSE_CLIENT) private readonly clickhouse: ClickHouseClient,
  ) {}

  async insertEvents(events: AnalyticsEvent[]) {
    await this.clickhouse.insert({
      table: 'analytics_events',
      values: events,
      format: 'JSONEachRow',
    });
  }

  async querySequenceStats(shAccountId: number, dateRange: DateRange) {
    const result = await this.clickhouse.query({
      query: `
        SELECT
          sequenceId,
          count() as totalSent,
          countIf(event = 'opened') as totalOpened,
          countIf(event = 'clicked') as totalClicked
        FROM analytics_events
        WHERE shAccountId = {shAccountId:UInt32}
          AND createdAt BETWEEN {startDate:DateTime} AND {endDate:DateTime}
        GROUP BY sequenceId
      `,
      query_params: {
        shAccountId,
        startDate: dateRange.start,
        endDate: dateRange.end,
      },
    });

    return result.json();
  }
}
```

**ClickHouse is a `@Global()` module** — inject via `@Inject(CLICKHOUSE_CLIENT)`.

## BullMQ (Background Jobs)

### Queue Creation

```typescript
import { BullmqService } from 'src/contacts/services/bullmq.service';

// Queue name constants
export const FEATURE_PROCESSING_QUEUE = 'featureProcessingQueue';

@Injectable()
export class FeatureService {
  private featureQueue: Queue;

  constructor(private readonly bullmqService: BullmqService) {
    this.featureQueue = this.bullmqService.createQueue(FEATURE_PROCESSING_QUEUE);
  }

  // Add job to queue
  async processAsync(feature: FeatureEntity, user: User) {
    await this.featureQueue.add(
      'process-feature',  // Job name
      {
        featureId: feature.id,
        userId: user.id,
        shAccountId: user.shAccountId,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }
}
```

### Worker Creation

```typescript
@Injectable()
export class FeatureWorkerService implements OnModuleInit {
  private readonly logger = new Logger(FeatureWorkerService.name);

  constructor(private readonly bullmqService: BullmqService) {}

  onModuleInit() {
    this.bullmqService.createWorker(
      FEATURE_PROCESSING_QUEUE,
      async (job) => {
        this.logger.log(`Processing job ${job.id}: ${JSON.stringify(job.data)}`);

        try {
          // MUST be idempotent — jobs may retry
          await this.processFeature(job.data);
          this.logger.log(`Completed job ${job.id}`);
        } catch (err) {
          this.logger.error(`Failed job ${job.id}: ${stringifyError(err)}`);
          throw err;  // Let BullMQ handle retry
        }
      },
      { concurrency: 5 },
    );
  }
}
```

### Existing Queue Names (Constants)

```typescript
export const PROSPECT_IMPORT_QUEUE_NAME = 'prospectImportCsvQueue';
export const SEQUENCE_PROSPECT_IMPORT_QUEUE_NAME = 'sequenceProspectImportCsvQueue';
export const PROSPECT_BULK_ACTION_QUEUE_NAME = 'prospectBulkActionQueue';
export const SEQUENCE_PROSPECT_BULK_ACTION_QUEUE_NAME = 'sequenceProspectBulkActionQueue';
export const PROSPECT_BULK_TAG_ASSIGN_QUEUE_NAME = 'prospectTagAssignQueue';
export const PROSPECT_BULK_UNSUBSCRIBE_QUEUE_NAME = 'prospectUnsubscribeQueue';
export const PROSPECT_BULK_ADD_TO_SEQUENCE_QUEUE_NAME = 'prospectAddToSequenceQueue';
export const SEQUENCE_EVALUATION_BULK_QUEUE_NAME = 'sequence-evaluation-bulk';
```

**Prometheus monitoring:** All queues have Prometheus gauges tracking waiting/active/delayed jobs.

## Kafka (Event Streaming)

```typescript
import { KafkaService } from 'src/kafka/kafka.service';

@Injectable()
export class FeatureService {
  constructor(private readonly kafkaService: KafkaService) {}

  async create(user: User, dto: CreateDto) {
    const saved = await this.featureRepo.save(entity);

    // Produce event
    await this.kafkaService.produce(kafkaTopics.featureCreated, [{
      key: String(saved.id),
      value: JSON.stringify({
        featureId: saved.id,
        userId: user.id,
        shAccountId: user.shAccountId,
        action: 'created',
        timestamp: new Date().toISOString(),
      }),
    }]);

    return saved;
  }
}
```

**Kafka topics** are defined in `src/app-config/configuration.ts` under `kafkaTopics`.

**Consumer rules:**
- Events MUST be idempotent — duplicates are possible
- Check if event was already processed before acting
- Log topic, key, and processing status

## Service Broker Pattern (Microservice Calls)

External services are called through dedicated service classes in `src/service-broker/`:

```typescript
import { HttpService } from '@nestjs/axios';
import { MicroserviceException } from 'src/common/exceptions/handlers/microservice-exception.handler';

@Injectable()
export class ExternalFeatureService {
  private readonly baseUrl: string;
  private readonly logger = new Logger(ExternalFeatureService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly appConfigService: AppConfigService,
  ) {
    this.baseUrl = this.appConfigService.externalServiceBaseUrl;
  }

  async processFeature(payload: ProcessPayload) {
    try {
      const { data } = await this.httpService
        .post(`${this.baseUrl}/process`, payload)
        .toPromise();
      return data.payload;
    } catch (err) {
      this.logger.error(`processFeature.error.${stringifyError(err)}`);
      if (err.response instanceof HttpException) {
        const { data, status } = err.response;
        throw new MicroserviceException(data, status);
      }
      throw new SystemException();
    }
  }
}
```

**10+ microservice URLs** configured in `AppConfigService`:
- Email sender service
- Scheduler service
- Warmup service
- Lead finder services (RocketReach, Prospeo, FindyEmail)
- And more

## Batch Processing Constants

```typescript
export const MAX_BATCH_SIZE_EXPORT = 10000;
export const PROSPECT_EXPORT_SIZE_FOR_BATCH = 600;
export const PROSPECT_IMPORT_BATCH_SIZE = 700;
export const TOTAL_PROSPECT_IMPORT_LIMIT = 100000;
export const BULK_ACTION_BATCH_SIZE = 200;
```

Process large datasets in batches — never load entire datasets into memory.

## Observability Across Infrastructure

```typescript
import { Span } from '@salesahandy/observability';

// Add @Span() to infrastructure methods for tracing
@Span()
async getS3ObjectStream(key: string, bucket: string) { ... }

@Span()
async search(params: SearchRequest) { ... }

@Span()
async canActivate(context: ExecutionContext): Promise<boolean> { ... }
```

## Anti-Patterns

- Do NOT hardcode Redis cache keys — use `CacheKeys` constants
- Do NOT create Redis/S3/ES clients directly — use existing services
- Do NOT forget TTL on Redis cache entries
- Do NOT forget cache invalidation after writes
- Do NOT make BullMQ handlers non-idempotent — jobs retry
- Do NOT make Kafka consumers non-idempotent — events may duplicate
- Do NOT call microservices directly with axios — use service-broker pattern
- Do NOT load large datasets into memory — use batch processing
- Do NOT forget `@Span()` on key infrastructure methods
