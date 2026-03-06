---
name: capture-learnings
description: Use after a feature is complete and verified — captures reusable knowledge to learning.md for future sessions
---

# Capture Learnings

Extract and record reusable knowledge from the just-completed work.

## When to Activate
- After all tasks pass verification
- After E2E tests pass
- Before invoking finishing-a-development-branch
- When explicitly requested via `/learn` command

## The Process

### Step 1: Reflect on the Work
Review what was just built:
- Read the spec and plan
- Review the git diff (what actually changed)
- Check any issues encountered during implementation

### Step 2: Extract Learnings
For each category, ask: "Would knowing this have saved time or prevented a mistake?"

**Patterns That Work:**
- New patterns discovered or confirmed
- Approaches that worked better than alternatives tried

**Gotchas:**
- Surprising behaviors encountered
- Things that looked right but weren't
- TypeORM/NestJS version-specific edge cases

**Performance Insights:**
- Measurable improvements found
- Query optimization discoveries
- Caching strategy outcomes

**Debugging Discoveries:**
- Root causes of bugs found
- Debugging techniques that helped
- Common error patterns specific to our stack

**Architecture Decisions:**
- Decisions made during implementation that deviate from or refine the spec
- Trade-offs evaluated and their outcomes

### Step 3: Write to learning.md

Append entries to the appropriate section in `.claude/learning.md`:

Format per entry:
```markdown
- **[Date] [Feature]: [Insight]** — [Details/context]
```

Example:
```markdown
## Patterns That Work
- **2026-02-25 User Settings: @EntityRepository with custom query builder methods** — Keeps complex queries out of services. Repository becomes the query abstraction, service handles business logic only.

## Gotchas
- **2026-02-25 User Settings: TypeORM v0.2 `save()` does upsert, not insert** — If entity has an ID, `save()` does UPDATE. For guaranteed INSERT, use `insert()`. Caused duplicate data bug.
- **2026-02-25 User Settings: class-transformer v0.2 uses `classToPlain` not `instanceToPlain`** — The newer API doesn't exist in v0.2. Import from 'class-transformer' directly.
```

### Step 4: Announce
Report what was captured:
```
Captured N learnings to learning.md:
- [Category]: [Brief description]
- [Category]: [Brief description]
```

## What NOT to Capture
- Session-specific details (file paths changed, exact error messages)
- Obvious things (e.g., "TypeScript catches type errors")
- Anything already documented in CLAUDE.md or rules
- Speculative insights not confirmed by evidence

## What to Capture
- Anything that would save >5 minutes if known in advance
- Patterns confirmed across 2+ instances
- Gotchas that are specific to our stack combination (NestJS v7 + TypeORM v0.2)
- Performance numbers with context
