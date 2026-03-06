---
name: auth-and-guards
description: Use when adding authentication, authorization, guards, permissions, plan gating, or feature quotas to endpoints
---

# Auth & Guards Patterns

Complete authentication and authorization patterns from the actual codebase. 25 guards, 19 decorators, 7 exception types.

## When to Activate
- Adding auth guards to endpoints
- Implementing permission checks
- Adding plan-based access control
- Adding feature quota enforcement
- Working with ownership/team access
- Creating rate-limited endpoints
- Implementing new guards or decorators

## Guard Stack (Order Matters)

The full guard stack applied to a typical protected endpoint:

```typescript
@UseGuards(
  JwtAuthGuard,           // 1. Validate JWT, extract user
  PermissionsGuard,       // 2. Check RBAC permissions
  OwnershipGuard,         // 3. Verify user owns the entity
  PlanPermissionGuard,    // 4. Check user's plan allows this
  FeatureQuotaGuard,      // 5. Check feature usage limits
  RateLimitGuard,         // 6. Per-endpoint rate limiting
)
```

Not all guards are needed on every endpoint. Common combinations:

```typescript
// Standard protected endpoint (most common)
@UseGuards(JwtAuthGuard, PermissionsGuard)

// Protected + ownership check (edit/delete own resources)
@UseGuards(JwtAuthGuard, PermissionsGuard, OwnershipGuard)

// Protected + plan gating (premium features)
@UseGuards(JwtAuthGuard, PermissionsGuard, PlanPermissionGuard)

// Protected + feature quota (limited-use features)
@UseGuards(JwtAuthGuard, PermissionsGuard, FeatureQuotaGuard)

// API token auth (external API access, not JWT)
@UseGuards(ApiTokenAuthGuard)

// Cron job (internal, token-based)
@UseGuards(CronAccessTokenGuard)

// External service callback (APUS, TrulyInbox)
@UseGuards(ApusAccessTokenGuard)
```

## All Guards (25 Total)

### Authentication Guards
| Guard | File | Purpose |
|-------|------|---------|
| `JwtAuthGuard` | `common/guards/jwt-auth.guard.ts` | Main JWT auth via Passport |
| `ApiTokenAuthGuard` | `common/guards/api-token-auth.guard.ts` | API token + MCP JWT |
| `McpJwtAuthGuard` | `common/guards/mcp-jwt-auth.guard.ts` | MCP RS256 JWT |
| `UserVerificationGuard` | `common/guards/user-verification.guard.ts` | Email verified check |

### Access Control Guards
| Guard | File | Purpose |
|-------|------|---------|
| `PermissionsGuard` | `common/access-control/permissions.guard.ts` | RBAC enforcement |
| `OwnershipGuard` | `common/access-control/ownership.guard.ts` | Entity ownership |
| `ResourceControlGuard` | `common/access-control/resource-control.guard.ts` | Resource identifiers |
| `AgencyPermissionsGuard` | `common/access-control/agency-permissions.guard.ts` | Agency RBAC |
| `FeatureQuotaGuard` | `common/access-control/feature-quota.guard.ts` | Usage limits |
| `PlanPermissionGuard` | `common/access-control/plan-permission.guard.ts` | Plan-based gating |
| `RateLimitGuard` | `common/access-control/rate-limit.guard.ts` | Per-endpoint rate limit |
| `GlobalRateLimitGuard` | `common/access-control/global-rate-limit.guard.ts` | Global rate limit |
| `PopulateUserGuard` | `common/access-control/populate-user.guard.ts` | Load user details |
| `PopulateUserAccountDetailsGuard` | `common/access-control/populate-user-account-details.guard.ts` | Load subscription data |

### Specialized Guards
| Guard | File | Purpose |
|-------|------|---------|
| `CronAccessTokenGuard` | `common/guards/cron-access-token.guard.ts` | Cron job auth (header: `cvt`) |
| `ApusAccessTokenGuard` | `common/guards/apus-access-token.guard.ts` | APUS service (header: `x-apus-token`) |
| `TrulyInboxTokenGuard` | `common/guards/truly-inbox-token.guard.ts` | TrulyInbox integration |
| `LeadFinderAccountVerificationGuard` | `common/guards/lead-finder-account-verification.guard.ts` | Lead finder |
| `ChromeExtensionGuard` | `common/guards/chrome-extension.guard.ts` | Chrome extension auth |
| `V2RequestVerificationGuard` | `common/guards/v2-request-verification.guard.ts` | V2 API compat |
| `BodyLimitGuard` | `common/guards/body-limit.guard.ts` | Request body size |
| `CalendlyEventGuard` | `common/guards/calendly-event.guard.ts` | Calendly webhook |

## Decorators (19 Total)

### Parameter Decorators (Extract from Request)

```typescript
// Most commonly used — extract user from JWT payload
@GetUser() user: User

// Extract JWT token string
@GetToken() token: string

// Extract client IP
@RealIp() ip: string

// Extract User-Agent
@GetUserAgent() userAgent: string

// Extract request source header
@GetSource() source: string

// Extract application identifier
@GetApplication() app: string

// Extract lead finder account
@GetLeadFinderAccount() account: LeadFinderAccount
```

### Metadata Decorators (Set on Method/Controller)

```typescript
// Response message for ApiRequestInterceptor
@Message('Feature created successfully')

// RBAC permissions — takes ARRAY directly (NOT object)
@RequiredPermissions([Permissions.FEATURE_READ])
@RequiredPermissions([Permissions.FEATURE_WRITE], ApiErrors.CustomError)

// Plan gating — exclude/include specific plan IDs
@RequiredPlans([PlanId.Starter, PlanId.Trial])  // excluded plans
@RequiredPlans([], ApiErrors.PlanDenied, [PlanId.Pro, PlanId.Scale])  // included plans

// Resource control — restrict by resource identifier
@RequiredResources(['feature-module'])

// Feature quota — check usage limits
@RequiredFeaturesQuota([FeatureCode.EMAIL_VERIFICATION])

// Ownership entity mapping — for OwnershipGuard
@GetEntity(Entity.Feature, ({ params }) => params.featureId)
@GetEntity(Entity.Sequence, ({ body }) => body.sequenceId)

// Shared resource access
@GetSharedResources(Entity.Feature, ({ params }) => params.featureId)

// Rate limit override (per endpoint)
@ApiRateLimit(100)  // 100 requests per window
@NoRateLimit()      // Disable rate limiting

// Body size limit
@BodyLimit(1000000)  // 1MB
```

## Permission System (Hierarchical)

Permissions follow a hierarchical pattern:
```
SCOPE.RESOURCE.ACTION

Scopes (least to most access):
  OWN     — only user's own resources (default, no prefix)
  TEAM    — team members' resources
  ACCOUNT — entire account's resources
  AGENCY  — agency-level access
  ALL     — system admin access
```

### Examples
```typescript
// Sequence permissions
Permissions.SEQUENCE_READ          // Own sequences only
Permissions.TEAM_SEQUENCE_READ     // Team's sequences
Permissions.ACCOUNT_SEQUENCE_READ  // All account sequences

// The PermissionsGuard checks hierarchically:
// If user has ACCOUNT.SEQUENCE.READ → they can also read team + own
// If user has TEAM.SEQUENCE.READ → they can read team + own
// If user has SEQUENCE.READ → they can only read own
```

### 150+ Permission Strings
```typescript
export enum Permissions {
  // Sequences
  SEQUENCE_READ = 'SEQUENCE.READ',
  SEQUENCE_WRITE = 'SEQUENCE.WRITE',
  SEQUENCE_UPDATE = 'SEQUENCE.UPDATE',
  SEQUENCE_DELETE = 'SEQUENCE.DELETE',
  SEQUENCE_UPDATE_STATUS = 'SEQUENCE.UPDATE_STATUS',
  TEAM_SEQUENCE_READ = 'TEAM.SEQUENCE.READ',
  ACCOUNT_SEQUENCE_READ = 'ACCOUNT.SEQUENCE.READ',
  // ... per resource: READ, WRITE, UPDATE, DELETE, UPDATE_STATUS
  // ... per scope: OWN (no prefix), TEAM, ACCOUNT

  // Webhooks
  WEBHOOKS_READ = 'WEBHOOKS.READ',
  WEBHOOKS_WRITE = 'WEBHOOKS.WRITE',

  // And 130+ more...
}
```

## Ownership Guard Usage

The OwnershipGuard checks if the user owns the entity they're accessing:

```typescript
@UseGuards(JwtAuthGuard, PermissionsGuard, OwnershipGuard)
@RequiredPermissions([Permissions.SEQUENCE_WRITE])
@GetEntity(Entity.Sequence, ({ params }) => params.sequenceId)
@Patch('/:sequenceId')
async updateSequence(
  @GetUser() user: User,
  @Param() { sequenceId }: SequenceIdDto,
  @Body() dto: UpdateSequenceDto,
) {
  return this.sequenceService.update(user, sequenceId, dto);
}
```

The `@GetEntity` decorator tells OwnershipGuard:
- Which entity type to look up (`Entity.Sequence`)
- How to extract the entity ID from the request (`params.sequenceId`)

The guard then checks:
1. Does the user own this entity? (userId match)
2. Does the user's team own it? (teamId match via permissions)
3. Does the user's account own it? (shAccountId match via permissions)

## Exception Types (7 Total)

```typescript
// Business logic errors (most common)
import { GeneralException } from 'src/common/exceptions/handlers/general-exception.handler';
throw new GeneralException(ApiErrors.FeatureNotFound);
throw new GeneralException(ApiErrors.SomethingWentWrong, 'Custom message');
throw new GeneralException(ApiErrors.CustomError, null, { extra: 'data' });

// Auth failures
import { AuthException } from 'src/common/exceptions/handlers/auth-exception.handler';
throw new AuthException(ApiErrors.InvalidAccessToken);

// Plan restrictions
import { PlanPermissionException } from 'src/common/exceptions/handlers/plan-permission-exception.handler';
throw new PlanPermissionException(ApiErrors.PlanPermissionDenied);

// Feature quota exceeded
import { FeatureQuotaException } from 'src/common/exceptions/handlers/feature-quota-exception.handler';
throw new FeatureQuotaException(ApiErrors.FeatureQuotaExceeded);

// Rate limit
import { RateLimitException } from 'src/common/exceptions/handlers/rate-limit.exception.handler';
throw new RateLimitException(ApiErrors.RateLimitExceeded);

// Internal system error
throw new SystemException();

// Logged but silent to client
throw new SilentException();
```

### Error Response Format
```json
{
  "error": true,
  "type": "general",      // general | auth | planPermission | featureQuotaUsage | rateLimit | validation | system | silent
  "code": 1001,
  "message": "Something went wrong",
  "payload": null
}
```

## JWT Token Types

The JWT strategy supports multiple token types:
```typescript
enum JwtPayloadType {
  User = 'user',                              // Standard user login
  AgencyUser = 'agencyUser',                  // Agency panel user
  VerficationLink = 'verificationLink',       // Email verification
  AgencyVerificationLink = 'agencyVerificationLink',
}
```

Token extraction: `customJwtTokenExtractor` from `src/common/extractor/`

## Common Controller Pattern (Full Example)

```typescript
@ApiTags('/feature-name')
@ApiBearerAuth()
@Controller(['/feature-name', '/api/edge/feature-name'])
export class FeatureNameController {
  constructor(private readonly featureNameService: FeatureNameService) {}

  @ApiOperation({ summary: 'List features' })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequiredPermissions([Permissions.FEATURE_READ])
  @UseInterceptors(AccessDelegatorMiddleware)
  @Get('/')
  async findAll(@GetUser() user: User, @Query() query: ListFeatureDto) {
    return this.featureNameService.findAll(user, query);
  }

  @ApiOperation({ summary: 'Create feature' })
  @UseGuards(JwtAuthGuard, PermissionsGuard, PlanPermissionGuard, FeatureQuotaGuard)
  @RequiredPermissions([Permissions.FEATURE_WRITE])
  @RequiredPlans([StarterPlanId])
  @RequiredFeaturesQuota([FeatureCode.FEATURE_CREATION])
  @Message('Feature created successfully')
  @Post('/')
  async create(@GetUser() user: User, @Body() dto: CreateFeatureDto) {
    return this.featureNameService.create(user, dto);
  }

  @ApiOperation({ summary: 'Update feature' })
  @UseGuards(JwtAuthGuard, PermissionsGuard, OwnershipGuard)
  @RequiredPermissions([Permissions.FEATURE_WRITE])
  @GetEntity(Entity.Feature, ({ params }) => params.featureId)
  @Patch('/:featureId')
  async update(
    @GetUser() user: User,
    @Param() { featureId }: FeatureIdDto,
    @Body() dto: UpdateFeatureDto,
  ) {
    return this.featureNameService.update(user, featureId, dto);
  }
}
```

## Anti-Patterns

- Do NOT pass `{ permissions: [...] }` to `@RequiredPermissions` — it takes an array directly
- Do NOT forget `@ApiTags()` and `@ApiBearerAuth()` on controller class
- Do NOT use `@Res()` — let interceptors handle response formatting
- Do NOT put auth logic in services — use guards
- Do NOT hardcode permission strings — use `Permissions` enum
- Do NOT create custom exception classes — use the 7 existing ones
- Do NOT forget `@GetEntity()` when using `OwnershipGuard`
- Do NOT mix guard order — auth first, then permissions, then ownership
