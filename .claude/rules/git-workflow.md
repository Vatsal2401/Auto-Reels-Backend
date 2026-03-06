---
paths:
  - "**/*"
---

# Git Workflow

> Feature branches off main, conventional commits.

## Branch Naming
- Feature: `feat/<short-description>`
- Fix: `fix/<short-description>`
- Refactor: `refactor/<short-description>`

## Conventional Commits
Format: `<type>: <description>`

| Type | When |
|---|---|
| `feat` | New feature or functionality |
| `fix` | Bug fix |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or updating tests |
| `docs` | Documentation changes |
| `chore` | Build, tooling, dependency updates |
| `perf` | Performance improvement |
| `style` | Formatting, white-space (no logic change) |

- Keep subject under 72 characters, imperative mood, no period at end
- Body optional — use for context on why, not what

## Pull Request Workflow
1. Create feature branch from latest `main`
2. Implement via Claude Code workflow
3. Verify: typecheck + lint + test + build
4. Push branch, create PR with summary + test plan
5. Review (human and/or code-reviewer agent)
6. Squash-merge to main, delete branch

## Commit Frequency
- Commit after each completed task
- Each commit leaves codebase in working state
- Don't bundle unrelated changes
