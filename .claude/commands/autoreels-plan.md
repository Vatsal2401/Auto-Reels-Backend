# Auto Reels Plan

Kick off the full feature lifecycle for the AI Auto Reels platform — from idea to merge-ready branch.

## Workflow

1. **Branch**: create feature branch (`feat/<name>`) from current branch — never work directly on main
2. Invoke `superpowers:brainstorming` — clarify requirements, propose approaches, write spec
3. Invoke `superpowers:writing-plans` — create detailed implementation plan with acceptance criteria
4. Dispatch `task-coverage-reviewer` agent — validate tasks cover the plan exactly (no more, no less)
5. If GAPS_FOUND: fix plan and re-validate (loop step 4)
6. If APPROVED: hand off to `superpowers:subagent-driven-development` for execution
7. Dispatch `code-reviewer` agent — full feature branch review against spec + plan
8. If BLOCK: fix issues and re-review (loop step 7)
9. Dispatch `e2e-runner` agent — API integration tests for critical flows
10. If failures: fix and re-run (loop step 9)
11. Invoke `capture-learnings` skill — extract reusable knowledge to learning.md
12. Invoke `superpowers:finishing-a-development-branch` — merge, PR, or cleanup

## Usage

```
/autoreels-plan [description of what you want to build]
```

## Context

This project is an AI-powered faceless video generation platform (Auto Reels). Features typically involve:
- AI pipelines (OpenAI, ElevenLabs, Google GenAI, Replicate)
- Video rendering via BullMQ queues + Remotion/Lambda
- TypeORM entities + PostgreSQL migrations
- NestJS v10 modules, services, controllers
- User credits, feature flags (`user_settings`), S3 storage
