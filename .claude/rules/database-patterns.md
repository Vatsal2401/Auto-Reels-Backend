---
paths:
  - "**/*.ts"
---

# Database Patterns

> TypeORM v0.3 + PostgreSQL (Supabase) patterns. DataSource API — NOT the v0.2 `@EntityRepository` pattern.

## TypeORM v0.3 — PostgreSQL

### Entity Pattern
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('table_name')
export class FeatureEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'feature_name', length: 255 })
  featureName: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

### Repository Pattern (v0.3 — NOT `@EntityRepository`)
```typescript
// In module: TypeOrmModule.forFeature([FeatureEntity])
// In service constructor:
@InjectRepository(FeatureEntity)
private readonly featureRepo: Repository<FeatureEntity>

// Usage
async findByUserId(userId: string): Promise<FeatureEntity[]> {
  return this.featureRepo.find({ where: { userId } });
}

async create(data: Partial<FeatureEntity>): Promise<FeatureEntity> {
  const entity = this.featureRepo.create(data);
  return this.featureRepo.save(entity);
}
```

### Query Builder
```typescript
// For complex queries
const result = await this.featureRepo
  .createQueryBuilder('feature')
  .where('feature.userId = :userId', { userId })
  .andWhere('feature.isActive = true')
  .orderBy('feature.createdAt', 'DESC')
  .getMany();
```

### Transactions
```typescript
// Use DataSource for transactions
import { DataSource } from 'typeorm';

constructor(private readonly dataSource: DataSource) {}

async createWithRelated(data: CreateDto): Promise<void> {
  await this.dataSource.transaction(async (manager) => {
    const entity = manager.create(FeatureEntity, data);
    await manager.save(entity);
    // other writes in same transaction...
  });
}
```

### Migrations
```bash
# Generate migration after entity changes
npm run migration:generate -- src/database/migrations/MigrationName

# Run pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert
```
- **NEVER use `synchronize: true` in production** — always use migrations
- Migration files live in `src/database/migrations/`
- Data source config: `src/database/data-source.ts`

## Redis — BullMQ Queues & Caching
```typescript
// BullMQ queue injection (via @nestjs/bullmq or bullmq directly)
@InjectQueue('queue-name') private readonly queue: Queue

// Add job with retry
await this.queue.add('job-type', payload, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
});

// Optional: ioredis for direct caching
const cached = await this.redis.get(`key:${id}`);
if (!cached) {
  const data = await this.repo.findOne({ where: { id } });
  await this.redis.set(`key:${id}`, JSON.stringify(data), 'EX', 3600);
  return data;
}
return JSON.parse(cached);
```

## Critical Rules
- **No `@EntityRepository`** — TypeORM v0.3 uses `@InjectRepository(Entity)` + `Repository<Entity>`
- **No raw SQL** unless absolutely necessary — use TypeORM query builder
- **No `synchronize: true`** — use migrations
- **No N+1 queries** — use `relations` option or query builder joins
- **Always filter by `userId`** — never return data across users
- **Column names**: snake_case in DB (`created_at`), camelCase in TypeScript (`createdAt`)
- **UUIDs** preferred for primary keys (`@PrimaryGeneratedColumn('uuid')`)
- **jsonb** for flexible metadata fields in PostgreSQL
