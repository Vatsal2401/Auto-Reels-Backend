# Review

Run code review on current changes using the code-reviewer agent.

## When to Use

- After completing a feature (before merge)
- After addressing PR feedback (verify fixes)
- Spot-checking changes mid-development

## Workflow

1. Determine what to review:
   - Default: all changes on current branch vs main (`git diff main...HEAD`)
   - `--staged`: only staged changes (`git diff --staged`)
2. Dispatch `code-reviewer` agent with:
   - The diff (staged or branch)
   - The full files that changed (not just diff lines)
   - The spec/plan if available (for context)
3. Agent reviews against checklist: Security → NestJS Patterns → Database Patterns → Code Quality → Performance → Best Practices
4. Agent reports findings with APPROVE / WARNING / BLOCK verdict
5. If BLOCK: must fix Critical issues before merge
6. If WARNING: Important issues noted, can merge with caution

## What Gets Checked

| Priority | Category | Examples |
|----------|----------|---------|
| CRITICAL | Security | SQL injection, hardcoded secrets, missing auth guards |
| HIGH | NestJS Patterns | Logic in controllers, wrong TypeORM API, console.log |
| HIGH | Database | N+1 queries, read-after-write on slave, no cache TTL |
| HIGH | Quality | Large files, deep nesting, any without justification |
| MEDIUM | Performance | Unbounded queries, sequential async, missing indexes |
| LOW | Best practices | Naming, commit messages, missing @ApiProperty |

## Usage

```
/review                    # Review all changes vs main
/review --staged           # Review only staged changes
```
