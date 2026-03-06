---
name: e2e-api
description: Use when running E2E API tests via supertest — patterns for endpoint testing, auth, validation, and error handling
---

# E2E API Testing Patterns

Patterns for end-to-end API testing using NestJS testing utilities and supertest.

## When to Activate
- Running E2E tests for API endpoints
- Setting up test infrastructure for integration tests
- Validating complete request/response cycles

## Test Setup

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';

describe('FeatureController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply the same pipes as production
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });
});
```

## Auth Patterns

```typescript
// Helper to get auth token for test user
async function getAuthToken(app: INestApplication, role: string = 'admin'): Promise<string> {
  // Implementation depends on your auth setup
  // Option 1: Call login endpoint
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: `test-${role}@example.com`, password: 'test-password' });
  return res.body.payload.token;

  // Option 2: Generate JWT directly
  // const jwtService = app.get(JwtService);
  // return jwtService.sign({ userId: 1, role, permissions: [...] });
}

// Usage in tests
let adminToken: string;
let memberToken: string;

beforeAll(async () => {
  adminToken = await getAuthToken(app, 'admin');
  memberToken = await getAuthToken(app, 'member');
});
```

## Response Assertion Patterns

All responses follow `ApiRequestInterceptor` format:
```typescript
// Success response
{
  message: "Feature created successfully",
  payload: { id: 1, name: "Test", ... }
}

// Error response
{
  message: "Feature not found",
  statusCode: 404
}
```

```typescript
// Assert success
.expect(200)
.expect((res) => {
  expect(res.body.message).toBe('Features fetched successfully');
  expect(res.body.payload).toBeDefined();
  expect(Array.isArray(res.body.payload.data)).toBe(true);
});

// Assert validation error
.expect(400)
.expect((res) => {
  expect(res.body.message).toContain('validation');
});

// Assert not found
.expect(404)
.expect((res) => {
  expect(res.body.message).toContain('not found');
});
```

## Common Flow Patterns

### CRUD Flow
```typescript
describe('/feature-name', () => {
  let createdId: number;

  it('POST / — creates feature', async () => {
    const res = await request(app.getHttpServer())
      .post('/feature-name')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test Feature', status: 'ACTIVE' })
      .expect(201);

    createdId = res.body.payload.id;
    expect(createdId).toBeDefined();
  });

  it('GET / — lists features', async () => {
    await request(app.getHttpServer())
      .get('/feature-name')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.payload.data.length).toBeGreaterThan(0);
      });
  });

  it('GET /:id — gets single feature', async () => {
    await request(app.getHttpServer())
      .get(`/feature-name/${createdId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.payload.id).toBe(createdId);
      });
  });

  it('PUT /:id — updates feature', async () => {
    await request(app.getHttpServer())
      .put(`/feature-name/${createdId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated Feature' })
      .expect(200);
  });

  it('DELETE /:id — deletes feature', async () => {
    await request(app.getHttpServer())
      .delete(`/feature-name/${createdId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });
});
```

### Auth Guard Flow
```typescript
describe('Auth guards', () => {
  it('returns 401 without token', () => {
    return request(app.getHttpServer())
      .get('/feature-name')
      .expect(401);
  });

  it('returns 403 without required permission', () => {
    return request(app.getHttpServer())
      .post('/feature-name')
      .set('Authorization', `Bearer ${memberToken}`) // member lacks CREATE permission
      .send({ name: 'Test' })
      .expect(403);
  });
});
```

### Validation Flow
```typescript
describe('DTO validation', () => {
  it('rejects missing required fields', () => {
    return request(app.getHttpServer())
      .post('/feature-name')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({}) // missing name and status
      .expect(400);
  });

  it('rejects invalid enum value', () => {
    return request(app.getHttpServer())
      .post('/feature-name')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test', status: 'INVALID' })
      .expect(400);
  });

  it('strips unknown fields (whitelist)', () => {
    return request(app.getHttpServer())
      .post('/feature-name')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test', status: 'ACTIVE', hackerField: 'injected' })
      .expect(400); // forbidNonWhitelisted rejects unknown fields
  });
});
```

### Pagination Flow
```typescript
describe('Pagination', () => {
  it('returns paginated results with total', async () => {
    const res = await request(app.getHttpServer())
      .get('/feature-name?skip=0&take=5')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.payload).toHaveProperty('data');
    expect(res.body.payload).toHaveProperty('total');
    expect(res.body.payload.data.length).toBeLessThanOrEqual(5);
  });

  it('returns second page', async () => {
    const res = await request(app.getHttpServer())
      .get('/feature-name?skip=5&take=5')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.payload.data).toBeDefined();
  });
});
```

## Database Cleanup

```typescript
// Option 1: Transaction rollback (cleanest)
let queryRunner: QueryRunner;

beforeEach(async () => {
  queryRunner = getConnection().createQueryRunner();
  await queryRunner.startTransaction();
});

afterEach(async () => {
  await queryRunner.rollbackTransaction();
  await queryRunner.release();
});

// Option 2: Truncate tables between tests
afterEach(async () => {
  const connection = getConnection();
  const entities = connection.entityMetadatas;
  for (const entity of entities) {
    const repository = connection.getRepository(entity.name);
    await repository.clear();
  }
});
```

## Common Gotchas
- Always `await app.close()` in `afterAll` — prevents open handle warnings
- Apply the same `ValidationPipe` as production — tests should match real behavior
- Use `beforeAll` not `beforeEach` for app initialization — it's slow
- Test response structure matches `ApiRequestInterceptor` format (`{ message, payload }`)
- For read-after-write tests, queries hit the master (same connection in test env)
