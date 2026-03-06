# Fix

Lightweight path for small bug fixes and changes that don't need the full `/plan` pipeline.

Use this when the change is small (< 5 files), the root cause is known, and no design decisions are needed.

## Workflow

1. Understand the issue — read relevant code, reproduce if needed
2. Make the fix — keep changes minimal and focused
3. Run all verification commands from `CLAUDE.md` → Verification Commands section
4. If verification fails: fix and re-run (loop step 3)
5. Commit with conventional commit message (`fix: <description>`)
6. If on a feature branch: push. If on main: create a branch first, then push.

## When to use /fix vs /plan

- **/fix**: Root cause is known, change is small, no design decisions needed
- **/plan**: Feature is new, scope is unclear, multiple approaches possible, touches many files

## Usage

```
/fix [description of the bug or issue]
```
