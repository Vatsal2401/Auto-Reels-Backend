---
paths:
  - "**/*.ts"
---

# Security & Compliance Rules

> Mandatory checks for every code change. Violations in this file are CRITICAL in code review.

## Secrets Management

- **NEVER** hardcode secrets (API keys, passwords, tokens, connection strings) in source code
- All secrets come from environment variables via `AppConfigService`
- `.env` files are gitignored — never commit them
- If you see a secret in code, flag it immediately and rotate the key
- Log structured metadata (userId, entityId) — never log tokens, passwords, or full request bodies

```typescript
// BAD — hardcoded secret
const apiKey = 'sk-live-abc123xyz';

// BAD — secret in log
this.logger.log(`Token: ${user.accessToken}`);

// GOOD — from config
const apiKey = this.appConfigService.externalApiKey;

// GOOD — structured log without secrets
this.logger.log({ label: 'auth:login', userId: user.id, email: user.email });
```

## PII Classification

These fields are **Personally Identifiable Information** — handle with care:

| PII Level | Fields | Rules |
|-----------|--------|-------|
| **HIGH** (credentials) | password, accessToken, refreshToken, apiToken, jwtSecret | Never log, never return in API, hash before storing |
| **HIGH** (identity) | email, phone, SSN, government IDs | Encrypt at rest if possible, mask in logs |
| **MEDIUM** (personal) | firstName, lastName, companyName, jobTitle, address | Don't log unnecessarily, exclude from bulk exports unless requested |
| **LOW** (behavioral) | IP address, userAgent, timezone, lastLoginAt | OK to log for security, respect retention policy |

```typescript
// BAD — returning password hash in API response
return this.userRepo.findOne({ where: { id } });

// GOOD — select only needed fields, exclude sensitive ones
return this.userRepo.findOne({
  where: { id },
  select: ['id', 'email', 'firstName', 'lastName', 'role', 'status'],
});
```

## Input Validation (OWASP: Injection Prevention)

- **All** external input MUST go through class-validator DTOs — no raw `req.body` usage
- **All** database queries use parameterized queries (TypeORM query builder or `find()`)
- **Never** interpolate user input into SQL strings
- `RequestValidationPipe` with `whitelist: true, forbidNonWhitelisted: true` strips unknown fields
- Sanitize HTML input where users can enter rich text (`sanitize-html` library exists in the project)

```typescript
// BAD — SQL injection via string interpolation
const result = await connection.query(`SELECT * FROM users WHERE email = '${email}'`);

// GOOD — parameterized query
const result = await this.userRepo.findOne({ where: { email } });

// GOOD — query builder with parameters
const result = await this.userRepo
  .createQueryBuilder('u')
  .where('u.email = :email', { email })
  .getOne();
```

## Authentication & Authorization Checks

Every endpoint MUST declare its auth requirement:

```typescript
// Protected endpoint (most common) — user must be logged in + have permission
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequiredPermissions([Permissions.FEATURE_READ])

// Internal endpoint (cron jobs, microservice callbacks)
@UseGuards(CronAccessTokenGuard)

// Public endpoint — MUST have a comment explaining why it's public
// Public: signup flow, no auth needed
@Post('/signup')
```
- **Never** leave an endpoint without a guard unless it's intentionally public (document why)
- Guard order matters: `JwtAuthGuard` → `PermissionsGuard` → `OwnershipGuard`
- `@RequiredPermissions([Permissions.X])` — takes array, check existing Permissions enum before creating new ones


## Anti-Patterns (Security)

- Do NOT return full entity objects with relations to the client — use DTOs to shape response
- Do NOT log full request/response bodies — log metadata only
- Do NOT store passwords in plaintext — use `bcrypt` (already in the project)
- Do NOT trust client-side data for authorization — always verify on server
- Do NOT expose internal error details — use exception filters
- Do NOT skip input validation for "internal" endpoints — microservices can be compromised too
