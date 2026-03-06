# E2E

Run end-to-end API tests for critical flows using supertest.

## When to Use

- After code review passes (before merge)
- After fixing E2E failures
- When validating a complete API flow works end-to-end
- As part of the `/plan` pipeline (step 9)

## Workflow

1. Dispatch `e2e-runner` agent
2. Agent reads spec/plan to identify critical API flows (high priority first)
3. For each flow:
   - Test happy path (correct auth, valid input → expected response)
   - Test auth guards (no token → 401, wrong permissions → 403)
   - Test validation (invalid DTO → 400 with error details)
   - Test business rules (duplicates, status transitions)
   - Test pagination (skip/take, total count)
4. Report pass/fail per flow with evidence

## What Gets Tested

| Priority | Flow type | Example |
|----------|-----------|---------|
| HIGH | CRUD operations | Create, read, update, delete entities |
| HIGH | Auth + permissions | Unauthenticated → 401, wrong role → 403 |
| HIGH | Input validation | Invalid DTO → 400 with validation errors |
| MEDIUM | Business rules | Duplicates, status transitions, limits |
| LOW | Edge cases | Empty results, max limits |

HIGH flows must pass 100% before merge. MEDIUM/LOW are informational.

## Usage

```
/e2e                          # Test all critical flows
/e2e [specific flow]          # Test a specific flow
```
