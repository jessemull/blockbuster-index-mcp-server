---
name: pr-review
description: >-
  Review pull requests for Blockbuster Index signal calculation server: diff-first, code-only,
  fixed-section task lists. Use when reviewing a PR/branch, triaging review
  feedback, or deciding merge blockers.
---

# PR Review

**Severity definitions:** `docs/REVIEW.md`

**Governance:** skim `CONTEXT.md` + `AGENTS.md`; load other docs only when the diff touches that domain.

---

## What PR review is (and is not)

**Review:** code, tests, and architecture **in the diff**.

**Not review:** PR description quality, commit message format, template checklists, or backlog work unrelated to this branch (unless this PR newly violates them).

---

## Principles

1. **Diff-first** — read the change before generic checklists.
2. **Risk-scoped depth** — lite for tiny PRs; deep for AWS/IAM, new signals, deps, large refactors.
3. **One bullet = one task** — imperative, fixable.
4. **Checklists are internal** — work through `docs/REVIEW.md`; never paste checklist tables into output.
5. **Fixed sections** — always render all output sections; use `(no items)` when empty.
6. **No hedging** in MUST/SHOULD/NICE bullets.

---

## Step 1 — Gather context

```bash
git fetch origin main
git log --oneline origin/main..HEAD
git diff origin/main...HEAD --stat
git diff origin/main...HEAD --shortstat
git diff origin/main...HEAD
```

Collect: scope, risk, architecture one-liner, files changed table, strengths, breaking changes, test plan.

---

## Step 2 — Depth

| Depth        | When                                                 |
| ------------ | ---------------------------------------------------- |
| **Lite**     | Docs/lockfile only, or < ~50 LOC TS                  |
| **Standard** | Typical 1–2 module feature/fix                       |
| **Deep**     | New signal, CloudFormation/IAM, new deps, > ~400 LOC |

---

## Step 3 — Apply REVIEW.md domains (internal)

| If the diff touches…        | Apply                              |
| --------------------------- | ---------------------------------- |
| Any TypeScript              | Architecture                       |
| Services / scoring          | TypeScript craftsmanship + testing |
| Repositories / CFN          | AWS                                |
| Env / logging / IAM         | Security                           |
| Tests                       | Testing                            |
| Performance-sensitive loops | Performance                        |

---

## Step 4 — Classify findings

| Bucket             | Blocks merge? | Meaning                            |
| ------------------ | ------------- | ---------------------------------- |
| **[MUST]**         | Yes           | Fix in this branch                 |
| **[SHOULD]**       | Yes           | Fix in this branch before merge    |
| **[NICE TO HAVE]** | No            | Actionable polish in touched files |
| **[OUT OF SCOPE]** | No            | Pre-existing / other backlog       |
| **[VERIFY]**       | No            | Concrete check needed              |

---

## Output format

Always include every section:

```markdown
## PR summary

<2–3 sentences: what changed, risk level, verdict>

## Files changed

| File              | Change  |
| ----------------- | ------- |
| `path/to/file.ts` | <brief> |

## Scope

- Commits: `N` · Files: `M` · `+additions / -deletions`
- Areas: `<signals|services|repositories|ci|docs>`
- Type: fix | refactor | feat | docs | chore
- **Risk:** Low | Medium | High — <one line>
- **Architecture:** OK | Concern — <one line>

## Reviewed areas

Architecture · Testing · … (N/A: …)

## Strengths

- <concrete positive>

## Breaking changes

- `<symbol>` — <impact>

## [MUST]

- `path/to/file.ts:42` — <imperative task>

## [SHOULD]

- `path/to/file.ts:10` — <imperative task>

## [NICE TO HAVE]

- `path/to/file.ts:88` — <imperative task>

## [OUT OF SCOPE]

- `path/to/existing.ts:12` — <issue>; pre-existing

## [VERIFY]

- `path/to/file.ts:55` — Run `<command>` to confirm <behavior>

## Verification

- [x] Read full diff `origin/main...HEAD`
- [ ] CI not checked locally

## Test plan

- `<command>` — <what it validates>

## Counts

MUST `n` · SHOULD `n` · NICE `n` · OUT OF SCOPE `n` · VERIFY `n`

## Verdict

**Approve** | **Request changes**
```

### Verdict rules

- **Request changes** — any MUST or SHOULD item
- **Approve** — MUST and SHOULD are `(no items)`

### Banned output

- "Follow-up PR", "consider…", "probably fine"
- "Run make preflight" without a specific observed failure
- Omitting a required section
