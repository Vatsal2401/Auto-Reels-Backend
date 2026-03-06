---
paths:
  - "**/*.ts"
---

# Coding Style

> TypeScript + NestJS conventions for all source files.

## TypeScript Strict Mode
- `strict: true` in tsconfig — no exceptions
- No `any` without a `// justified: <reason>` comment
- Prefer `unknown` over `any` for truly unknown types
- Use discriminated unions over type assertions

## File Organization
- One class per file (service, controller, entity, DTO, etc.)
- File size: 200-400 lines typical, 800 lines absolute maximum
- Function length: 50 lines maximum
- Nesting depth: 4 levels maximum — extract early returns or helper functions
- Tests colocated: `user.service.ts` → `user.service.spec.ts`

## Naming Conventions
- **Files**: kebab-case with suffix — `user-login.dto.ts`, `user.service.ts`, `user.entity.ts`
- **Classes**: PascalCase with suffix — `UserService`, `CreateUserDto`, `UserEntity`
- **Interfaces**: PascalCase with `I` prefix — `IUserResponse`
- **Enums**: PascalCase — `UserStatus`, `PermissionType`
- **Constants**: SCREAMING_SNAKE_CASE — `MAX_RETRY_COUNT = 3`
- **DB columns**: snake_case — `created_at`, `user_id`
- **Routes**: kebab-case — `/api/edge/user-settings`

## Immutability
- Use spread operators for object updates: `{ ...existing, key: newValue }`
- Never mutate function parameters directly
- Use `Array.map/filter/reduce` over `push/splice/sort` (in-place)
- Mark function params as `readonly` when they shouldn't be modified

## Logging
- Use NestJS Logger: `private readonly logger = new Logger(ClassName.name)` — wraps Pino via `@salesahandy/observability`
- NEVER use `console.log` / `console.debug` / `console.error`
- Log at appropriate levels: `error` for failures, `warn` for recoverable, `log` for info
- Error format: `this.logger.error(\`methodName.error.\${stringifyError(err)}\`)`
- Structured log: `this.logger.log({ label: 'method:action', userId, entityId }, 'Description')`
- Include context: user ID, shAccountId, entity IDs
- Never log sensitive data: passwords, tokens, PII
- Use `stringifyError(err)` from `src/common/utils` for error serialization

## Imports
- Path aliases: `@/*` and `src/*` both map to `./src/*`
- Group: external deps → NestJS deps → internal modules → relative imports → types
- No circular imports — use `forwardRef(() => Module)` only when unavoidable

## Error Handling
- 7 exception types: `GeneralException`, `AuthException`, `PlanPermissionException`, `FeatureQuotaException`, `RateLimitException`, `SystemException`, `SilentException`
- Use `GeneralException(ApiErrors.X)` for business errors — never throw raw `HttpException` or `Error`
- Check `ApiErrors` for existing error codes before creating new ones (300+ exist)
- Always handle async errors — no unhandled promise rejections
- Use try/catch for external service calls (APIs, DB, Redis, Kafka)
- Use `stringifyError(err)` for error logging, not `err.message` or `JSON.stringify(err)`

## Observability
- Add `@Span()` from `@salesahandy/observability` on key service methods for tracing
- Add `@ApiOperation({ summary: '...' })` on every controller endpoint for Swagger

## No Debug Code in Production
- No `console.log` / `console.debug` — use `new Logger(ClassName.name)`
- No `debugger` statements
- No commented-out code blocks — use version control
- No TODO comments without a Jira ticket reference
