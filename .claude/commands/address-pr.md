# Address PR

Handle PR review feedback — read comments, implement changes, verify, push.

## Workflow

1. Invoke `superpowers:receiving-code-review` — read feedback with technical rigor, don't blindly agree
2. For each feedback item: assess whether the suggestion is correct before implementing
3. Make the changes — or explain in a comment why you disagree
4. Run all verification commands from `CLAUDE.md` → Verification Commands section
5. Commit with: `fix: address PR feedback — <summary>`
6. Push to branch

## Usage

```
/address-pr [PR number or URL]
```
