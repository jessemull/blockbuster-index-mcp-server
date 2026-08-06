---
name: commit
description: >-
  Prepare and create commits for Blockbuster Index MCP Server following
  Conventional Commits, governance rules, and quality gates. Use when staging,
  committing, or preparing changes for PR.
---

# Commit Changes

Read before committing:

- `CONTEXT.md`
- `AGENTS.md`
- `docs/GOVERNANCE.md`
- `docs/ARCHITECTURE.md`
- `docs/REVIEW.md`
- `docs/TESTING.md`

Safety rules:

- Only commit when the user explicitly requests it.
- Never use `--no-verify` unless the user explicitly requests it.
- Never amend commits that have been pushed to remote.
- Never force-push to `main`/`master`.

Commits must remain atomic, intentional, reproducible, reviewable, and semantically meaningful.

---

# Conventional Commit Format

```text
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

## Types

| Type       | Use When                              |
| ---------- | ------------------------------------- |
| `feat`     | new feature                           |
| `fix`      | bug fix                               |
| `refactor` | restructuring without behavior change |
| `perf`     | performance improvement               |
| `test`     | tests only                            |
| `docs`     | documentation only                    |
| `style`    | formatting/style-only                 |
| `chore`    | maintenance/tooling/config            |
| `build`    | build tooling/dependencies            |
| `ci`       | CI/CD changes                         |
| `revert`   | reverting previous commit             |

## Scopes

Use commitlint scopes: `amazon`, `bls`, `broadband`, `census`, `walmart`, `blockbuster-index`, `config`, `repositories`, `services`, `signals`, `types`, `util`, `ci`, `docs`, `deps`.

Prefer `npm run commit` / `make commit` (Commitizen) when interactive.

---

# Pre-Commit Checklist

## Change isolation

- [ ] One logical change per commit
- [ ] Unrelated refactors / formatting separated
- [ ] No debug artifacts, secrets, or local-only config

## Quality

On commit, husky runs `lint-staged` (ESLint + Prettier on staged files).
On push, husky runs lint + format-check + test + build.

Prefer `git push` over duplicating `make preflight` unless you need an extra local confirmation.

## Diff review

```bash
git diff --staged
```

Verify only intended files are staged.

---

# Anti-Patterns

## MUST NOT

- Commit broken builds or failing tests
- Commit secrets
- Mix unrelated changes
- Use vague messages (`fixed stuff`, `updates`)

---

# Output Expectations

When preparing a commit, provide:

## Summary

- what changed
- architectural impact
- affected signals/packages

## Validation Results

- lint/test status if run
- coverage concerns

## Commit Message

Final recommended Conventional Commit message.
