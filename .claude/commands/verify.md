# Verify

Run the full verification loop on the current codebase. All checks must pass.

## When to Use

- After completing a task (before committing)
- Before creating a PR
- After fixing issues flagged by code review
- Anytime you want to confirm the codebase is healthy

## Verification Steps

Read the **Verification Commands** section in `CLAUDE.md` for the exact commands. Run ALL in sequence. Stop and report on first failure:

1. **Typecheck** — Expected: zero errors
2. **Lint** — Expected: zero errors, zero warnings. If failures are auto-fixable, run the lint-fix command.
3. **Tests** — Expected: all tests pass. If no tests exist: acceptable.
4. **Build** — Expected: build succeeds.

## Output Format

```
Verification Report:
  Typecheck:   PASS / FAIL (N errors)
  Lint:        PASS / FAIL (N issues)
  Tests:       PASS / FAIL (N/N passing)
  Build:       PASS / FAIL (built in Xs)

  Status: READY FOR PR / NOT READY — [first failure reason]
```

## Usage

```
/verify
```
