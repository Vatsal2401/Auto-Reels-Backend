---
paths:
  - "**/*.ts"
---

# NestJS Patterns

> NestJS v10 patterns for the Auto Reels project.

## Module Structure
Every feature module follows this layout:
```
src/feature-name/
  feature-name.module.ts       — @Module with imports, providers, controllers, exports
  feature-name.controller.ts   — HTTP routes, guards, Swagger docs
  feature-name.service.ts      — Business logic (can have multiple services)
  entities/                    — TypeORM entities (PostgreSQL)
  dto/                         — Request/response DTOs with class-validator
  enums/                       — Module-specific enums
  types/                       — Module-specific types
  helpers/                     — Helper utilities
  constants/                   — Module-specific constants
```

## Controller Pattern
```typescript
@ApiTags('feature-name')
@ApiBearerAuth()
@Controller('feature-name')
export class FeatureNameController {
  constructor(private readonly featureNameService: FeatureNameService) {}

  @ApiOperation({ summary: 'Create feature' })
  @UseGuards(JwtAuthGuard)
  @Post('/')
  async create(
    @GetUser() user: User,
    @Body() createDto: CreateFeatureDto,
  ) {
    return this.featureNameService.create(user, createDto);
  }
}
```
**CRITICAL:** Always add `@ApiTags()`, `@ApiBearerAuth()` at class level and `@ApiOperation()` per method.

## Module Registration Pattern (TypeORM v0.3)
```typescript
@Module({
  imports: [TypeOrmModule.forFeature([FeatureEntity])],
  controllers: [FeatureController],
  providers: [FeatureService],
  exports: [FeatureService],
})
export class FeatureModule {}
```

## Service Pattern
```typescript
@Injectable()
export class FeatureService {
  private readonly logger = new Logger(FeatureService.name);

  constructor(
    @InjectRepository(FeatureEntity)
    private readonly featureRepo: Repository<FeatureEntity>,
  ) {}

  async findByUserId(userId: string): Promise<FeatureEntity[]> {
    return this.featureRepo.find({ where: { userId } });
  }
}
```
- Services contain business logic — controllers are thin
- Logger: `private readonly logger = new Logger(ClassName.name)`
- Throw NestJS built-in exceptions (`BadRequestException`, `NotFoundException`, etc.)
- Error logging: `this.logger.error(err.message, err.stack)`

## DTO Validation
```typescript
import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFeatureDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: FeatureStatus })
  @IsEnum(FeatureStatus)
  status: FeatureStatus;
}
```
- Use `class-validator` decorators — NOT manual validation
- `@ApiProperty()` / `@ApiPropertyOptional()` for Swagger
- `@Type(() => Number)` for query/param number coercion
- Global `ValidationPipe` handles: `whitelist`, `forbidNonWhitelisted`, `transform`

## Auth Guard
- `@UseGuards(JwtAuthGuard)` — protect endpoints
- `@GetUser() user: User` — extract user from JWT (custom decorator in `src/auth/`)
- `@Public()` decorator if endpoint is public (skips JwtAuthGuard)

## Dependency Injection
- Constructor injection is standard
- `@Inject()` only for custom tokens
- Circular deps: `forwardRef(() => Module)` — document WHY in a comment
- Register providers in the closest module, export only what other modules need

## BullMQ Queue Pattern
```typescript
// Producer — inject queue
@InjectQueue('video-render') private readonly renderQueue: Queue

// Add job
await this.renderQueue.add('render', payload, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });

// Consumer — processor class
@Processor('video-render')
export class RenderProcessor extends WorkerHost {
  async process(job: Job): Promise<void> { ... }
}
```

## Anti-Patterns
- Do NOT put business logic in controllers — use services
- Do NOT use `@Res()` decorator — return values from controller methods
- Do NOT use `classToPlain`/`plainToClass` — use `instanceToPlain`/`plainToInstance` (class-transformer v0.5)
- Do NOT catch errors just to re-throw — let NestJS exception filters handle them
- Do NOT use `console.log` — use `new Logger(ClassName.name)`
- Do NOT use `@EntityRepository` pattern — that's TypeORM v0.2; use `@InjectRepository(Entity)`
