---
name: backend-testing
description: Use when implementing tests or verifying task completion — provides selective testing strategy, actual mock patterns, and verification commands for our NestJS stack
---

# Backend Testing Strategy

Selective testing for our NestJS v7 + TypeORM v0.2 stack. Based on actual test patterns from the codebase.

## When to Activate
- Writing tests for a completed task
- Deciding whether a change needs a test
- Running verification after task completion
- Setting up test infrastructure

## Selective Testing Decision

| Change Type | Test Required | Test Type |
|---|---|---|
| Service with business logic | YES | Jest unit test (mock repos + services) |
| Custom repository with complex queries | YES | Jest unit test (query builder assertions) |
| DTO with validation decorators | YES | Jest unit test (validate/reject) |
| Guards / interceptors / pipes | YES | Jest unit test (mock ExecutionContext) |
| Helper/utility functions | YES | Jest unit test (pure function tests) |
| Controller (thin, delegates to service) | NO | E2E covers it |
| Entity definition (no logic) | NO | It's a declaration |
| Module registration | NO | Build verification covers it |
| Simple CRUD service (no business logic) | NO | E2E covers it |

## Jest Configuration

The project uses this configuration:
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleDirectories: ['node_modules', '<rootDir>/src'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
};
```

**Key:** Both `@/*` and `src/*` path aliases are mapped. Tests use Node test environment.

## Mock Directory Structure

The project has a centralized mock directory at the root:
```
mock/
├── services/              — 24+ service mock factories
│   ├── sequence.service.mock.ts
│   ├── email-account.service.mock.ts
│   └── ...
├── repositories/          — 11+ repository mock objects
│   ├── user.repository.mock.ts
│   ├── sequence.repository.mock.ts
│   └── ...
└── data/                  — Test data sets
    ├── weighted-avg-data/
    ├── api-token-service/
    └── ...
```

### Service Mock Factory Pattern (Actual)
```typescript
// mock/services/feature.service.mock.ts
export const FeatureServiceMock = {
  findByAccountId: () => {
    return {
      id: 1218,
      shAccountId: 4,
      userId: 4,
      featureName: 'test-feature',
      status: 1,
      isActive: true,
      createdAt: '2024-01-09T07:20:31.925Z',
      modifiedAt: '2024-01-16T11:23:19.000Z',
      deletedAt: null,
      user: {
        id: 4,
        role: 'admin',
        shAccountId: 4,
        firstName: 'Test',
        lastName: 'User',
        email: 'test@saleshandy.com',
      },
    };
  },
  getFeaturesByUserId: () => {
    return [/* Array of detailed entity objects */];
  },
};

// Repository Mock Pattern
export const FeatureRepositoryMock = {
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
  findByAccountId: jest.fn(),
};
```

**Mock factories return realistic data** with complete entity graphs (relations, nested objects).

## Testing Patterns (From Actual Codebase)

### Pattern 1: Service Test with NestJS TestingModule (50+ mock providers)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';

describe('FeatureService', () => {
  let service: FeatureService;
  let featureRepo: jest.Mocked<FeatureRepository>;
  let redisClientService: jest.Mocked<RedisClientService>;

  // Shared mock user — reused across tests
  const mockUser = {
    id: 537,
    role: 'admin',
    shAccountId: 445,
    firstName: 'Test',
    lastName: 'User',
    email: 'test@saleshandy.com',
    verified: true,
    status: 1,
    timeZone: 'Asia/Kolkata',
    shAccount: {
      id: 445,
      teamSize: '0',
      createdAt: '2022-01-05T13:06:50.008Z',
    },
  } as unknown as User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureService,
        { provide: Logger, useValue: { log: jest.fn(), error: jest.fn(), warn: jest.fn() } },
        {
          provide: getRepositoryToken(FeatureRepository),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            createQueryBuilder: jest.fn(),
            findByAccountId: jest.fn(),
          },
        },
        {
          provide: RedisClientService,
          useValue: {
            client: {
              get: jest.fn(),
              set: jest.fn(),
              del: jest.fn(),
            },
          },
        },
        // Services with many dependencies may need 50+ mock providers
        // Use { provide: ServiceName, useValue: {} } for deps not being tested
        { provide: KafkaService, useValue: { produce: jest.fn() } },
        { provide: BullmqService, useValue: { createQueue: jest.fn(), createWorker: jest.fn() } },
        { provide: AppConfigService, useValue: { someConfig: 'value' } },
        // ... more as needed
      ],
    }).compile();

    service = module.get(FeatureService);
    featureRepo = module.get(getRepositoryToken(FeatureRepository));
    redisClientService = module.get(RedisClientService);
  });

  describe('findAll', () => {
    it('should return cached data when available', async () => {
      const cached = JSON.stringify({ data: [{ id: 1 }], total: 1 });
      redisClientService.client.get.mockResolvedValue(cached);

      const result = await service.findAll(mockUser, { skip: 0, take: 20 });

      expect(redisClientService.client.get).toHaveBeenCalledWith(
        expect.stringContaining('feature:list'),
      );
      expect(featureRepo.findByAccountId).not.toHaveBeenCalled();
      expect(result).toEqual({ data: [{ id: 1 }], total: 1 });
    });

    it('should query DB and cache when no cache', async () => {
      redisClientService.client.get.mockResolvedValue(null);
      featureRepo.findByAccountId.mockResolvedValue([[{ id: 1 }] as any, 1]);

      const result = await service.findAll(mockUser, { skip: 0, take: 20 });

      expect(featureRepo.findByAccountId).toHaveBeenCalledWith(445, 0, 20);
      expect(redisClientService.client.set).toHaveBeenCalled();
      expect(result.total).toBe(1);
    });
  });

  describe('create', () => {
    it('should throw GeneralException on duplicate', async () => {
      featureRepo.findOne.mockResolvedValue({ id: 1 } as any);

      await expect(service.create(mockUser, { name: 'Test' }))
        .rejects.toThrow(GeneralException);
    });

    it('should invalidate cache after creation', async () => {
      featureRepo.findOne.mockResolvedValue(null);
      featureRepo.create.mockReturnValue({ name: 'Test' } as any);
      featureRepo.save.mockResolvedValue({ id: 1, name: 'Test' } as any);

      await service.create(mockUser, { name: 'Test' });

      expect(redisClientService.client.del).toHaveBeenCalledWith(
        expect.stringContaining('feature:list'),
      );
    });
  });
});
```

### Pattern 2: Utility Function Tests (Pure Functions)

```typescript
describe('Date Helper Functions', () => {
  const baseDate = new Date('2024-03-15T10:30:00.123Z');

  describe('subtractIntervalFromDate', () => {
    it('should subtract days correctly', () => {
      const result = subtractIntervalFromDate(baseDate, 5, DateHelper.Days, false);
      expect(result).toEqual(new Date('2024-03-10T10:30:00.123Z'));
    });

    it('should handle month boundary correctly', () => {
      const result = subtractIntervalFromDate(
        new Date('2024-03-02T15:30:00Z'), 5, DateHelper.Days, false,
      );
      expect(result).toEqual(new Date('2024-02-26T15:30:00Z'));
    });

    it('should handle leap year dates', () => {
      const leapYearDate = new Date('2024-02-29T10:30:00Z');
      expect(
        subtractIntervalFromDate(leapYearDate, 1, DateHelper.Months, false),
      ).toEqual(new Date('2024-01-29T10:30:00Z'));
    });

    it('should not modify original date (immutability)', () => {
      const originalDate = new Date(baseDate);
      subtractIntervalFromDate(baseDate, 5, DateHelper.Days, true);
      expect(baseDate).toEqual(originalDate);
    });
  });
});
```

### Pattern 3: Private Method Testing (Bracket Notation)

```typescript
describe('FeatureHelperService', () => {
  let service: FeatureHelperService;

  beforeEach(() => {
    // Direct instantiation for simple tests
    service = new FeatureHelperService(
      {} as any, // deps not being tested
      {} as any,
    );
  });

  describe('extractValidationMessages', () => {
    it('should extract messages from errors with constraints', () => {
      const errors = [{
        constraints: {
          isString: 'name must be a string',
          isNotEmpty: 'name should not be empty',
        },
        children: [],
      }];

      // Bracket notation for private method access
      const result = service['extractValidationMessages'](errors);
      expect(result).toEqual([
        'name must be a string',
        'name should not be empty',
      ]);
    });
  });
});
```

### Pattern 4: Query Builder String Assertion

```typescript
describe('QueryBuilder', () => {
  it('should generate correct SQL for filter payload', () => {
    const builder = new ProspectQueryBuilderFilterService(
      mockUser.accessibleUserIds,
      fields,
      payload,
    );

    const query = builder.buildQuery();
    const expectedQuery = `SELECT DISTINCT p.id FROM prospect p INNER JOIN...`;

    // Normalize whitespace for comparison
    expect(removeExtraSpaceFromString(query)).toBe(
      removeExtraSpaceFromString(expectedQuery),
    );
  });
});
```

## Testing DTOs

```typescript
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

describe('CreateFeatureDto', () => {
  it('should validate correct input', async () => {
    const dto = plainToClass(CreateFeatureDto, { name: 'Test', status: 'ACTIVE' });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should reject empty name', async () => {
    const dto = plainToClass(CreateFeatureDto, { name: '', status: 'ACTIVE' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('name');
  });

  it('should reject invalid enum value', async () => {
    const dto = plainToClass(CreateFeatureDto, { name: 'Test', status: 'INVALID' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
```

**IMPORTANT:** Use `plainToClass` (class-transformer v0.2), NOT `plainToInstance`.

## What to Mock vs What NOT to Mock

**Mock these (external boundaries):**
- TypeORM repositories (`getRepositoryToken()`)
- `RedisClientService` (`.client.get/set/del`)
- `KafkaService` (`.produce`)
- `BullmqService` (`.createQueue/createWorker`)
- `HttpService` (`.post/get`)
- `AppConfigService` (config values)
- `S3ManagerService` (AWS S3 operations)
- Mongoose models (`getModelToken()`)
- NestJS Logger

**Don't mock these:**
- The class under test
- `class-validator` — run actual validation
- `class-transformer` — use actual transforms
- Pure utility functions — test them directly

## Environment Variables for Tests

```typescript
// Set before tests if needed
process.env.SH_S3_REGION = 'us-west-2';
process.env.SH_S3_ATTACHMENT_BUCKET_NAME = 'test-attachments';
```

## Verification Commands

Run these after EVERY task. Read the **Verification Commands** section in `CLAUDE.md` for exact commands (typecheck, lint, test, build). ALL must pass before marking a task complete.
