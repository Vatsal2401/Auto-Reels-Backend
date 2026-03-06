---
paths:
  - "**/*.spec.ts"
  - "**/*.e2e-spec.ts"
  - "**/*.ts"
---

# Testing Rules

> Jest unit tests, NestJS E2E tests. Reference CLAUDE.md for verification commands.

## Testing Strategy (Selective)
- **Services with business logic** → Jest unit tests with mocked repositories
- **Custom repositories with complex queries** → Jest tests with query builder mocks
- **DTOs with validation logic** → Unit tests for class-validator decorators
- **Guards and interceptors** → Unit tests with mocked ExecutionContext
- **Simple controllers (thin, delegate to service)** → No unit test needed (E2E covers)
- **Entity definitions** → No test needed
- **Critical API flows** → E2E tests via supertest

## Unit Test Pattern
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('FeatureService', () => {
  let service: FeatureService;
  let repository: jest.Mocked<Repository<FeatureEntity>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureService,
        {
          provide: getRepositoryToken(FeatureEntity),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(FeatureService);
    repository = module.get(getRepositoryToken(FeatureEntity));
  });

  it('should return features for a user', async () => {
    const mockFeatures = [{ id: 1, userId: 42 }];
    repository.find.mockResolvedValue(mockFeatures as any);

    const result = await service.findByUserId(42);

    expect(repository.find).toHaveBeenCalledWith({ where: { userId: 42 } });
    expect(result).toEqual(mockFeatures);
  });
});
```

## E2E Test Pattern
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

describe('FeatureController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/feature-name (GET)', () => {
    return request(app.getHttpServer())
      .get('/feature-name')
      .set('Authorization', 'Bearer <test-token>')
      .expect(200)
      .expect((res) => {
        expect(res.body.payload).toBeDefined();
      });
  });
});
```

## Mocking Rules
- Mock at the boundary: repositories, external services, Redis, Kafka
- Never mock the class under test
- Use `jest.fn()` for simple mocks, `jest.spyOn()` when you need the original behavior
- Reset mocks in `beforeEach` — avoid test pollution

## Verification
Run commands from CLAUDE.md `## Verification Commands` section:
- `test` — run all unit tests
- `typecheck` — ensure types are correct
- `lint` — check code style

## Anti-Patterns
- Do NOT test TypeORM entity definitions (they're declarations, not logic)
- Do NOT test simple getter/setter services with no logic
- Do NOT mock everything — mock only external dependencies
- Do NOT write tests that duplicate the implementation (assert behavior, not implementation)
