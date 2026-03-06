# Setup Guide

Copy the `.claude/` directory into your NestJS backend repo root.

## Quick Start

```bash
# From your project root
npx degit your-org/bootstrap-backend/.claude .claude
```

## What's Included

```
.claude/
  CLAUDE.md              — Master config (CUSTOMIZE THIS FIRST)
  learning.md            — Cross-session knowledge (starts empty)
  SETUP.md               — This file
  rules/                 — Auto-loaded coding rules
    coding-style.md      — TypeScript + NestJS conventions
    nestjs-patterns.md   — Module/controller/service/DTO patterns
    database-patterns.md — TypeORM v0.2, Mongoose, Redis patterns
    security-compliance.md — Secrets, PII, multi-tenancy, audit, OWASP
    reliability.md       — Error handling, timeouts, retries, graceful degradation
    testing.md           — Selective testing strategy
    git-workflow.md      — Branch naming, conventional commits
    performance.md       — Query, caching, background job patterns
    skill-loading.md     — Bridges rules → skills for subagents
  agents/                — Specialized review agents
    code-reviewer.md     — Security, patterns, quality review
    spec-reviewer.md     — Per-task spec compliance check
    task-coverage-reviewer.md — Plan vs spec alignment
    e2e-runner.md        — API integration test runner
  commands/              — Slash commands (/plan, /fix, /debug, etc.)
    sh-plan.md           — Full feature lifecycle
    fix.md               — Quick bug fix
    debug.md             — Root cause investigation
    review.md            — Code review
    verify.md            — Verification loop
    e2e.md               — E2E API tests
    learn.md             — Capture learnings
    address-pr.md        — Handle PR feedback
  skills/                — Invocable domain skills
    nestjs-stack/        — Module/service/controller/DTO patterns
    auth-and-guards/     — 25 guards, 19 decorators, 7 exception types, permissions
    infrastructure-services/ — Redis, S3, ES, ClickHouse, BullMQ, Kafka patterns
    production-readiness/— Monitoring, performance targets, deployment checklists
    backend-testing/     — Test patterns, mock directory, jest config
    capture-learnings/   — Knowledge extraction
    e2e-api/             — API E2E test patterns
```

## Customizing for Your Stack

### CLAUDE.md (MUST customize)

| Section | What to change | Example |
|---------|---------------|---------|
| Tech Stack | Your actual stack + versions | NestJS v9, TypeORM v0.3, Node 18 |
| Version Constraints | Your version-specific restrictions | "Use DataSource API, not @EntityRepository" |
| Module Structure | Your project layout | Add `interceptors/`, `pipes/` if used |
| Error Handling | Your error pattern | Custom exception classes |
| Auth & Authorization | Your auth setup | OAuth2, API keys, etc. |
| DB Access Rules | Your DB setup | Single DB vs master-slave |
| Verification Commands | Your actual commands | `pnpm test`, `yarn lint`, etc. |

### Rules (customize per project)

| Rule | What to customize | When |
|------|------------------|------|
| `coding-style.md` | Logger, error handling, import paths | If different from Pino/GeneralException |
| `nestjs-patterns.md` | Module structure, guard names, response format | If using different interceptors/guards |
| `database-patterns.md` | ORM version, DB topology, cache strategy | If TypeORM v0.3, single DB, no Redis |
| `testing.md` | Test framework, mock patterns | If using Vitest, different test setup |
| `security-compliance.md` | PII fields, auth patterns, audit requirements | If different auth or compliance needs |
| `reliability.md` | Timeout values, retry policies, fallback hierarchy | If different SLAs or infrastructure |
| `performance.md` | Query patterns, caching rules | If different DB or cache layer |
| `skill-loading.md` | Skill names and triggers | If you add/remove skills |

### What's Generic (no changes needed)

These work regardless of stack:
- `git-workflow.md` — Branch naming, conventional commits
- All commands (`/plan`, `/fix`, `/debug`, `/review`, `/verify`, `/e2e`, `/learn`, `/address-pr`)
- `task-coverage-reviewer.md` — Spec vs plan alignment
- `capture-learnings/` skill — Knowledge extraction pattern
- `learning.md` — Template for accumulated knowledge

## Requirements

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed
- [Superpowers plugin](https://github.com/AidanTilgner/superpowers-marketplace) installed for workflow orchestration

## Verify Installation

```bash
# In your project root
claude

# Try a command
/verify
```

If `/verify` runs the verification commands from your CLAUDE.md, setup is complete.
