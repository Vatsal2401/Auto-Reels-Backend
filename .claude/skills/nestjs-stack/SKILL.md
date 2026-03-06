---
name: nestjs-stack
description: Use when building NestJS modules, services, controllers, entities, DTOs, repositories, or any backend work in this project
---

# NestJS Stack Patterns

Patterns for our NestJS v7 + TypeORM v0.2 + Mongoose backend. This skill provides the actual patterns used in the codebase — follow these exactly.

## When to Activate
- Building or modifying NestJS modules
- Creating services, controllers, entities, DTOs
- Setting up TypeORM repositories
- Implementing Mongoose schemas
- Working with Redis caching
- Creating BullMQ background jobs
- Setting up Kafka producers/consumers
- Adding guards and decorators

## Module Structure

Every feature module follows this layout:
```
src/feature-name/
  feature-name.module.ts       — @Module with imports, providers, controllers, exports
  feature-name.controller.ts   — HTTP routes, guards, validation, Swagger docs
  feature-name.service.ts      — Business logic (may have multiple services)
  repositories/                — TypeORM custom repositories (@EntityRepository)
  entities/                    — TypeORM entities (MySQL)
  schema/                      — Mongoose schemas (MongoDB)
  dto/                         — Request/response DTOs with class-validator
  enums/                       — Module-specific enums
  types/                       — Module-specific TypeScript types
  helpers/                     — Module-specific utility functions
  constants/                   — Module-specific constants
  builders/                    — Query builders (if complex)
  utils/                       — Utility functions
```

Large modules (like `sequence`, `lead-finder`, `contacts`) can have 20+ services, 25+ entities, 60+ DTOs. Split services by responsibility.

## Controller Pattern (Actual)

```typescript
import { Controller, Get, Post, Patch, Delete, Body, Query, Param, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/common/access-control/permissions.guard';
import { OwnershipGuard } from 'src/common/access-control/ownership.guard';
import { RequiredPermissions } from 'src/common/access-control/decorators/required-permissions.decorator';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { Message } from 'src/common/decorators/message.decorator';
import { Permissions } from 'src/common/enums/permissions';
import { User } from 'src/user/entities/user.entity';

@ApiTags('/feature-name')
@ApiBearerAuth()
@Controller(['/feature-name', '/api/edge/feature-name'])
export class FeatureNameController {
  constructor(private readonly featureNameService: FeatureNameService) {}

  @ApiOperation({ summary: 'Get list of features' })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequiredPermissions([Permissions.FEATURE_READ])
  @Get('/')
  async findAll(@GetUser() user: User, @Query() query: ListFeatureDto) {
    return this.featureNameService.findAll(user, query);
  }

  @ApiOperation({ summary: 'Create a feature' })
  @UseGuards(JwtAuthGuard, PermissionsGuard, OwnershipGuard)
  @RequiredPermissions([Permissions.FEATURE_WRITE])
  @Message('Feature created successfully')
  @Post('/')
  async create(@GetUser() user: User, @Body() dto: CreateFeatureDto) {
    return this.featureNameService.create(user, dto);
  }

  @ApiOperation({ summary: 'Update a feature' })
  @UseGuards(JwtAuthGuard, PermissionsGuard, OwnershipGuard)
  @RequiredPermissions([Permissions.FEATURE_WRITE])
  @Patch('/:featureId')
  async update(
    @GetUser() user: User,
    @Param() { featureId }: FeatureIdDto,
    @Body() dto: UpdateFeatureDto,
  ) {
    return this.featureNameService.update(user, featureId, dto);
  }

  @ApiOperation({ summary: 'Delete a feature' })
  @UseGuards(JwtAuthGuard, PermissionsGuard, OwnershipGuard)
  @RequiredPermissions([Permissions.FEATURE_WRITE])
  @Message('Feature deleted successfully')
  @Delete('/:featureId')
  async delete(
    @GetUser() user: User,
    @Param() { featureId }: FeatureIdDto,
  ) {
    return this.featureNameService.delete(user, featureId);
  }
}
```

**Critical controller rules:**
- `@ApiTags()` and `@ApiBearerAuth()` at class level for Swagger
- `@ApiOperation({ summary: '...' })` on every endpoint
- `@Controller(['/path', '/api/edge/path'])` — dual routes pattern
- `@RequiredPermissions([Permissions.X])` — takes an **array**, NOT an object
- Guard order: `JwtAuthGuard` → `PermissionsGuard` → `OwnershipGuard`
- Controllers are thin — delegate ALL logic to services
- Never use `@Res()` — let `ApiRequestInterceptor` handle responses
- `@Message('...')` for success message in response

## Service Pattern (Actual)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Span } from '@salesahandy/observability';
import { GeneralException } from 'src/common/exceptions/handlers/general-exception.handler';
import { ApiErrors } from 'src/common/response/messages/api-errors';
import { RedisClientService } from 'src/redis/redis-client.service';
import { CacheKeys } from 'src/redis/constants/cache-keys';
import { stringifyError } from 'src/common/utils';

@Injectable()
export class FeatureNameService {
  private readonly logger = new Logger(FeatureNameService.name);

  constructor(
    @InjectRepository(FeatureRepository)
    private readonly featureRepo: FeatureRepository,
    private readonly redisClientService: RedisClientService,
  ) {}

  @Span()
  async findAll(user: User, query: ListFeatureDto): Promise<{ data: FeatureEntity[]; total: number }> {
    const cacheKey = CacheKeys.FEATURE_LIST(user.accountId);
    const cached = await this.redisClientService.client.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const [data, total] = await this.featureRepo.findByAccountId(
      user.shAccountId,
      query.skip || 0,
      query.take || 20,
    );

    await this.redisClientService.client.set(cacheKey, JSON.stringify({ data, total }), 'EX', 3600);
    return { data, total };
  }

  @Span()
  async create(user: User, dto: CreateFeatureDto): Promise<FeatureEntity> {
    const existing = await this.featureRepo.findOne({
      where: { featureName: dto.name, shAccountId: user.shAccountId },
    });
    if (existing) {
      throw new GeneralException(ApiErrors.DuplicateFeature);
    }

    const entity = this.featureRepo.create({
      ...dto,
      userId: user.id,
      shAccountId: user.shAccountId,
    });

    try {
      const saved = await this.featureRepo.save(entity);

      // Invalidate cache after write
      await this.redisClientService.client.del(CacheKeys.FEATURE_LIST(user.shAccountId));

      return saved;
    } catch (err) {
      this.logger.error(`create.error.${stringifyError(err)}`);
      throw new GeneralException(ApiErrors.SomethingWentWrong);
    }
  }
}
```

**Critical service rules:**
- Logger: `private readonly logger = new Logger(ClassName.name)` — NestJS Logger wraps Pino
- `@Span()` decorator from `@salesahandy/observability` for tracing on key methods
- Error logging: `this.logger.error(\`methodName.error.\${stringifyError(err)}\`)`
- User has `user.id`, `user.shAccountId`, `user.email`, `user.role`
- Throw `GeneralException(ApiErrors.X)` — never raw Error or HttpException
- Check `ApiErrors` for existing errors (300+) before creating new ones
- Use `stringifyError(err)` utility for error serialization in logs
- Redis via `this.redisClientService.client.get/set/del`

## Entity Pattern (TypeORM v0.2)

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('feature_table_name')
export class FeatureEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'sh_account_id' })
  shAccountId: number;

  @Column({ name: 'feature_name', length: 255 })
  featureName: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'status', type: 'tinyint', default: 1 })
  status: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', nullable: true })
  deletedAt: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => ShAccount)
  @JoinColumn({ name: 'sh_account_id' })
  shAccount: ShAccount;
}
```

**Key entity rules:**
- Column names are **snake_case** in DB, **camelCase** in TypeScript
- Always use `{ name: 'snake_case' }` in column decorators
- `shAccountId` is critical — almost every entity has it for multi-tenancy
- Soft deletes via `deletedAt` column (not TypeORM built-in soft delete)
- Use `tinyint` for status/boolean-like columns

## Repository Pattern (v0.2 — NOT DataSource)

```typescript
import { EntityRepository, Repository } from 'typeorm';

@EntityRepository(FeatureEntity)
export class FeatureRepository extends Repository<FeatureEntity> {
  async findByAccountId(
    shAccountId: number,
    skip: number,
    take: number,
  ): Promise<[FeatureEntity[], number]> {
    return this.createQueryBuilder('f')
      .where('f.shAccountId = :shAccountId', { shAccountId })
      .andWhere('f.deletedAt IS NULL')
      .orderBy('f.createdAt', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();
  }

  async findByIdAndAccountId(
    id: number,
    shAccountId: number,
  ): Promise<FeatureEntity> {
    return this.findOne({
      where: { id, shAccountId, deletedAt: null },
    });
  }
}
```

**CRITICAL:** Use `@EntityRepository` pattern. Do NOT use DataSource API (that's TypeORM v0.3+).

## DTO Pattern (Actual)

```typescript
import { IsNotEmpty, IsString, IsOptional, IsEnum, IsEmail, IsNumber, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateFeatureDto {
  @ApiProperty({ description: 'Feature name' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Optional email' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ enum: FeatureStatus, description: 'Feature status' })
  @IsEnum(FeatureStatus)
  status: FeatureStatus;
}

export class ListFeatureDto {
  @ApiPropertyOptional({ default: 0, description: 'Skip N records' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  skip?: number;

  @ApiPropertyOptional({ default: 20, description: 'Take N records' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  take?: number;
}

export class FeatureIdDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  featureId: number;
}
```

**DTO rules:**
- `class-validator` decorators on every field
- `@ApiProperty()` or `@ApiPropertyOptional()` for Swagger
- `@Type(() => Number)` for query/param number coercion (class-transformer)
- Global `RequestValidationPipe` handles: `whitelist`, `forbidNonWhitelisted`, `transform`
- Param DTOs use `@Type(() => Number)` since URL params are strings

## Response Format

All API responses go through `ApiRequestInterceptor`:

```json
// Success (via @Message decorator or return value)
{ "message": "Feature created successfully", "payload": { ... } }

// Error (via GeneralExceptionFilter)
{ "error": true, "type": "general", "code": 1001, "message": "Something went wrong" }

// Validation error (via ValidationExceptionFilter)
{ "error": true, "type": "validation", "messages": ["name should not be empty"] }
```

For custom HTTP status codes, use `SuccessResponseGenerator`:
```typescript
import { SuccessResponseGenerator } from 'src/common/response/success-response-generator';

return new SuccessResponseGenerator({
  message: 'Feature created',
  payload: savedEntity,
  httpCode: HttpStatus.CREATED,
});
```

## Error Handling (Actual)

Seven exception types in the codebase:

```typescript
// Most common — business logic errors
throw new GeneralException(ApiErrors.FeatureNotFound);
throw new GeneralException(ApiErrors.DuplicateFeature);
throw new GeneralException(ApiErrors.SomethingWentWrong);

// Auth errors — triggers AuthExceptionFilter
throw new AuthException(ApiErrors.InvalidAccessToken);

// Plan gating — user's plan doesn't allow this feature
throw new PlanPermissionException(ApiErrors.PlanPermissionDenied);

// Feature quota — user exceeded usage limit
throw new FeatureQuotaException(ApiErrors.FeatureQuotaExceeded);

// Rate limit exceeded
throw new RateLimitException(ApiErrors.RateLimitExceeded);

// System error — unexpected internal failure
throw new SystemException();

// Silent error — logged but no response to client
throw new SilentException();
```

Check existing `ApiErrors` (300+ defined) before creating new ones:
```typescript
// src/common/response/messages/api-errors.ts
export const ApiErrors = {
  InvalidAccessToken: errorCreator('Invalid token', 1001),
  PermissionDenied: errorCreator('Permission denied', 1001),
  SomethingWentWrong: errorCreator('Something went wrong', 1001),
  // ... 300+ more
};
```

## Dependency Injection

- Constructor injection — never use `@Inject()` unless needed for tokens
- Circular deps: `forwardRef(() => Module)` — document WHY in a comment
- Register providers in the closest module, export only what other modules need
- Use `@Global()` sparingly — only for truly cross-cutting concerns (Redis, Elasticsearch, ClickHouse)
- Custom injection tokens: `@Inject(CLICKHOUSE_CLIENT)` for ClickHouse

## Module Registration

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([FeatureRepository]),
    MongooseModule.forFeature([
      { name: FeatureLog.name, schema: FeatureLogSchema },
    ]),
    forwardRef(() => OtherModule), // Comment: circular because X needs Y
  ],
  controllers: [FeatureNameController],
  providers: [FeatureNameService, FeatureHelperService],
  exports: [FeatureNameService],
})
export class FeatureNameModule {}
```

## Mongoose Schema Pattern (MongoDB)

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, collection: 'feature_logs' })
export class FeatureLog extends Document {
  @Prop({ required: true })
  userId: number;

  @Prop({ required: true })
  shAccountId: number;

  @Prop({ type: Object })
  metadata: Record<string, any>;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export type FeatureLogDocument = FeatureLog & Document;
export const FeatureLogSchema = SchemaFactory.createForClass(FeatureLog);
```

## Background Jobs (BullMQ)

```typescript
// Queue names are constants
export const FEATURE_PROCESSING_QUEUE = 'featureProcessingQueue';

// In service — add job to queue
const queue = this.bullmqService.createQueue(FEATURE_PROCESSING_QUEUE);
await queue.add('process-feature', {
  featureId: feature.id,
  userId: user.id,
  shAccountId: user.shAccountId,
}, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: true,
  removeOnFail: true,
});

// Worker — create in module or service init
const worker = this.bullmqService.createWorker(
  FEATURE_PROCESSING_QUEUE,
  async (job) => {
    this.logger.log(`Processing job ${job.id}: ${JSON.stringify(job.data)}`);
    // ... idempotent processing logic ...
    this.logger.log(`Completed job ${job.id}`);
  },
  { concurrency: 5 },
);
```

**BullMQ rules:**
- Queue names are constants in `constants/` files
- Handlers MUST be idempotent — jobs may retry
- Always set `attempts` and `backoff`
- Log job start and completion with job ID
- Workers are created via `this.bullmqService.createWorker()`

## Kafka Events

```typescript
// Topics defined in configuration.ts under kafkaTopics
// Producer
await this.kafkaService.produce(kafkaTopics.featureCreated, [{
  key: String(feature.id),
  value: JSON.stringify({
    featureId: feature.id,
    userId: user.id,
    shAccountId: user.shAccountId,
    action: 'created',
  }),
}]);

// Consumer — events MUST be idempotent (duplicates are possible)
```

## Observability

```typescript
import { Span } from '@salesahandy/observability';

// Add @Span() to methods you want traced
@Span()
async findAll(user: User, query: ListFeatureDto) { ... }

// Logger pattern — NestJS Logger wrapping Pino
private readonly logger = new Logger(ClassName.name);

this.logger.log({ label: 'method-name:action', userId, featureId }, 'Description');
this.logger.error(`methodName.error.${stringifyError(err)}`);
this.logger.warn(`methodName.warning.${reason}`);
```

## Import Paths

Two path aliases, both map to `./src/*`:
```typescript
import { Something } from 'src/common/utils';  // src/* alias
import { Something } from '@/common/utils';     // @/* alias
```

Group imports: external deps → NestJS deps → internal modules → relative → types

## Anti-Patterns

- Do NOT put business logic in controllers — use services
- Do NOT use `@Res()` decorator — let `ApiRequestInterceptor` handle responses
- Do NOT use `DataSource` API — this is TypeORM v0.2, use `@EntityRepository` pattern
- Do NOT use `instanceToPlain`/`plainToInstance` — use `classToPlain`/`plainToClass` (class-transformer v0.2)
- Do NOT catch errors just to re-throw — let exception filters handle them
- Do NOT use `console.log` — use `new Logger(ClassName.name)`
- Do NOT use `synchronize: true` in any config — use migrations
- Do NOT use `@nestjs/config` v2 patterns — this is NestJS v7
- Do NOT use `structuredClone` or other Node 16+ APIs — this is Node 15
- Do NOT create new ApiErrors without checking existing 300+ errors first
- Do NOT forget `@ApiTags()` and `@ApiBearerAuth()` on controller classes
- Do NOT pass `{ permissions: [...] }` to `@RequiredPermissions` — it takes an array directly
