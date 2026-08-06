---
name: repo-review
description: >-
  Full-repository audit for Blockbuster Index signal calculation server with fixed output
  sections and Ready/Needs work verdict. Use for release readiness or broad
  health checks — not for single-PR review (use pr-review).
---

# Repo Review

Diff-agnostic full audit. For PR diffs, use `pr-review` instead.

Read: `CONTEXT.md`, `AGENTS.md`, `docs/GOVERNANCE.md`, `docs/ARCHITECTURE.md`, `docs/REVIEW.md`, `docs/TESTING.md`, `docs/SECURITY.md`.

---

## Process

1. Survey structure (`src/`, `cloudformation/`, `.github/`, `docs/`, `.cursor/`)
2. Spot-check architecture boundaries (no cross-signal imports)
3. Spot-check tests and coverage config (80%)
4. Spot-check security (secrets, IAM snippets, logging)
5. Spot-check governance freshness (CONTEXT/AGENTS/docs consistency)
6. Run `make preflight` when practical; record results

---

## Output format

```markdown
## Repo summary

<2–3 sentences + overall risk>

## Areas reviewed

Architecture · Testing · Security · CI · Docs · Tooling

## Strengths

- …

## [MUST]

- …

## [SHOULD]

- …

## [NICE TO HAVE]

- …

## [OUT OF SCOPE]

- …

## [VERIFY]

- …

## Verification

- [ ] `make preflight` — …

## Counts

MUST `n` · SHOULD `n` · NICE `n` · OUT OF SCOPE `n` · VERIFY `n`

## Verdict

**Ready** | **Needs work**
```

Always include every section; use `(no items)` when empty.
