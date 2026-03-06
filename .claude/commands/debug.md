# Debug

Investigate and fix bugs using a systematic approach. Use when the root cause is unknown.

## Workflow

1. Invoke `superpowers:systematic-debugging` — reproduce, isolate, identify root cause
2. Once root cause is identified: make the fix
3. Run all verification commands from `CLAUDE.md` → Verification Commands section
4. If verification fails: fix and re-run (loop step 3)
5. Commit with conventional commit message (`fix: <description>`)

## When to use /debug vs /fix

- **/debug**: Root cause is unknown, needs investigation first
- **/fix**: Root cause is known, just need to make the change

## Usage

```
/debug [description of the bug or unexpected behavior]
```
