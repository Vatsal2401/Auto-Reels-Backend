---
paths:
  - "**/*.ts"
---

# Skill Loading for Subagents

> Rules auto-load for all subagents. Skills do NOT. This rule bridges the gap.

## When You're About to Write Code

Before writing or modifying TypeScript files, check if any of these skills should be invoked:

| Trigger | Skill to invoke | Why |
|---|---|---|
| Building or modifying NestJS modules, services, controllers | `nestjs-stack` | Module structure, DI patterns, controller/service patterns, DTOs |
| Adding auth guards or JWT protection to endpoints | `auth-and-guards` | JwtAuthGuard, GetUser decorator, feature flag checks |
| Working with Redis, S3, BullMQ queues, AI service integrations | `infrastructure-services` | Queue patterns, S3 uploads, BullMQ job processing |
| Preparing features for production, adding monitoring/alerting | `production-readiness` | Observability, performance targets, deployment checklist, graceful shutdown |
| Writing or modifying tests (`.spec.ts`, `.e2e-spec.ts`) | `backend-testing` | Mock patterns, test structure, verification commands |
| Running E2E API tests | `e2e-api` | Supertest patterns, auth tokens, response assertions |
| After all tasks pass verification | `capture-learnings` | Captures reusable knowledge to learning.md |

## How to Invoke

Use the `Skill` tool with the skill name:
```
Skill: nestjs-stack
Skill: auth-and-guards
Skill: infrastructure-services
Skill: production-readiness
Skill: backend-testing
```

## Why This Exists

Claude Code auto-loads:
- `.claude/CLAUDE.md` — project config, verification commands
- `.claude/rules/*.md` — coding rules (this file, coding-style, nestjs-patterns, database-patterns, etc.)

Claude Code does NOT auto-load:
- `.claude/skills/*/SKILL.md` — must be invoked via `Skill` tool

Subagents (implementers, reviewers) get rules automatically but miss skills unless told to invoke them.
