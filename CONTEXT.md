# CONTEXT.md — Blockbuster Index MCP Server

> **This is the PRIMARY entry point for ALL AI agents working in this repository.**
> Read this file first. Follow the mandatory reading order below before making any changes.

---

## Mandatory Reading Order

Every agent MUST read the following documents **in order** before making any change:

1. **`CONTEXT.md`** (this file) — loading order, source-of-truth precedence, non-negotiable constraints, quality gates
2. **`AGENTS.md`** — complete development rules, architecture constraints, coding standards, and forbidden patterns
3. **`docs/GOVERNANCE.md`** — contribution workflow, PR process, review policy, release process
4. **`docs/ARCHITECTURE.md`** — system design, signal pattern, data flow, CloudFormation relationships
5. **`docs/TESTING.md`** — testing strategy, coverage requirements, mocking conventions
6. **`docs/COMMENTS.md`** — comment policy and documentation standards
7. **`docs/SECURITY.md`** — security policy, secret management, IAM guidance
8. **`docs/ENVIRONMENT.md`** — environment variables reference
9. **`docs/SIGNALS.md`** — signal calculation documentation

Read items 5–9 on every task. Do not skip them because the work “seems unrelated”; agents cannot know upfront which rules will apply.

---

## Source-of-Truth Precedence

When instructions conflict, the **higher-numbered source wins**:

| Priority    | Source                                                                    | Scope                                         |
| ----------- | ------------------------------------------------------------------------- | --------------------------------------------- |
| 1 (highest) | `CONTEXT.md`                                                              | Repository-wide constraints and quality gates |
| 2           | `docs/GOVERNANCE.md`                                                      | Contribution workflow and review policy       |
| 3           | `docs/ARCHITECTURE.md`                                                    | System design and layer boundaries            |
| 4           | Feature-specific documentation (`docs/SIGNALS.md`, `docs/ENVIRONMENT.md`) | Domain-level design decisions                 |
| 5 (lowest)  | Inline code comments                                                      | Local implementation notes                    |

**Lower-precedence instructions MUST NOT contradict higher-precedence instructions.** If a conflict is detected, flag it for human review and follow the higher-precedence source.

---

## Non-Negotiable Constraints

These constraints apply to **every change** in this repository. No exceptions without explicit human approval.

### Language & Type Safety

- **TypeScript strict mode**: always enabled; never weaken `tsconfig.json` strictness
- **No `any` without justification**: `@typescript-eslint/no-explicit-any` is an error in production code (relaxed only in `*.test.ts`)
- **Named exports preferred**: follow existing module patterns

### Architecture

- **Signal pattern**: each signal follows `entrypoint → service → repository`
- **No cross-signal coupling**: signals MUST NOT import from other signal packages
- **Shared code lives in** `src/util/`, `src/constants/`, `src/types/`, or `src/signals/shared-job-signal-orchestration/`
- **Config from env only**: all secrets and environment-specific values come from environment variables via `src/config/config.ts`

### Testing

- **80% coverage threshold**: branches, functions, lines, and statements — enforced in CI
- **Co-located tests**: `*.test.ts` alongside source files
- **Mock external I/O**: AWS SDK, network, filesystem — never hit real AWS in unit tests

### Git & Quality

- **Conventional Commits**: enforced by commitlint + Commitizen
- **Never bypass hooks**: no `--no-verify` unless the user explicitly requests it
- **No hardcoded secrets**: API keys, credentials, and tokens never appear in source

---

## Architecture Boundaries

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   entrypoint/   │ ──► │    service/      │ ──► │  repository/    │
│  (ECS task      │     │  (business       │     │  (DynamoDB,     │
│   bootstrap)    │     │   logic)         │     │   S3 access)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

| Rule                                              | Enforcement                     |
| ------------------------------------------------- | ------------------------------- |
| Signals MUST NOT import other signals             | Code review + architecture docs |
| Repositories own DynamoDB / S3 I/O                | Layer convention                |
| Services own business logic                       | Layer convention                |
| Entrypoints own orchestration / process lifecycle | Layer convention                |
| Shared helpers live in `src/util/`                | Code review                     |

---

## Mandatory Quality Gates

| When               | Gate                                                                                               | Failure policy |
| ------------------ | -------------------------------------------------------------------------------------------------- | -------------- |
| **Commit**         | Husky `pre-commit` — `lint-staged` (ESLint + Prettier on staged files)                             | Block commit   |
| **Commit message** | Husky `commit-msg` — commitlint (Conventional Commits + scope enum)                                | Block commit   |
| **Push**           | Husky `pre-push` — lint + format-check + test + build                                              | Block push     |
| **PR / CI**        | GitHub Actions: commitlint, lint, format-check, test (Jest 80%), build all signals; soft npm audit | Block merge    |

### When to run what (avoid duplicate work)

| Situation              | Command                               | Notes                                             |
| ---------------------- | ------------------------------------- | ------------------------------------------------- |
| **During development** | `make lint`, `make test`, scoped Jest | Fast iteration                                    |
| **Before push**        | **`git push`**                        | Husky runs full push validation                   |
| **Local full check**   | `make preflight`                      | Optional before PR; same suite as push + explicit |
| **Full repo audit**    | `make preflight`                      | Release / `repo-review` skill only                |

**Do not** run `make preflight` and then `git push` in the same session unless you need an extra local confirmation — push re-runs lint, format-check, tests, and build.

```bash
make lint         # ESLint
make format       # Prettier write
make test         # Jest
make build        # Webpack production bundle(s)
make preflight    # lint + format-check + test + build
```

---

## Escalation Rules — Human Review Required

The following changes **MUST** be reviewed and approved by a human maintainer. AI agents MUST NOT merge these autonomously.

- **New dependencies**: any addition to `package.json`
- **Security changes**: credentials, IAM policies, secret handling, logging of sensitive data
- **Architecture changes**: new signals, layer boundary modifications, new shared patterns
- **CI/CD changes**: any modification to `.github/workflows/`
- **Infrastructure changes**: any modification to `cloudformation/`
- **Governance document changes**: any edit to `CONTEXT.md`, `AGENTS.md`, or `docs/GOVERNANCE.md`
- **Coverage threshold changes**: reductions to Jest coverage thresholds
- **Breaking public API / contract changes**: S3 output shapes, DynamoDB schemas consumed by other systems

---

## Confirmation Requirement

Before implementing any changes, confirm you have read and understood:

- [ ] `CONTEXT.md` — this file (loading order, precedence, constraints, quality gates)
- [ ] `AGENTS.md` — development rules, architecture, coding standards, forbidden patterns
- [ ] `docs/GOVERNANCE.md` — contribution workflow and review policy
- [ ] `docs/ARCHITECTURE.md` — system design and layer boundaries
- [ ] `docs/TESTING.md` — testing strategy and coverage
- [ ] `docs/COMMENTS.md` — comment and documentation policy
- [ ] `docs/SECURITY.md` — security policy and secrets
- [ ] `docs/ENVIRONMENT.md` — environment variables
- [ ] `docs/SIGNALS.md` — signal calculation documentation

**If any of the above documents do not yet exist, note their absence and proceed with the rules defined in `CONTEXT.md` and `AGENTS.md` as the authoritative sources.**

---

## Project Summary

| Field       | Value                                           |
| ----------- | ----------------------------------------------- |
| Project     | Blockbuster Index MCP Server                    |
| Type        | TypeScript Node.js signal calculation server    |
| Runtime     | Node.js 20                                      |
| Language    | TypeScript (strict)                             |
| Compute     | AWS ECS Fargate                                 |
| Storage     | DynamoDB + S3                                   |
| IaC         | CloudFormation                                  |
| Logging     | Bunyan → CloudWatch                             |
| Testing     | Jest (80% coverage)                             |
| Lint/Format | ESLint + Prettier + eslint-plugin-perfectionist |
| Git         | Husky + lint-staged + Commitizen + Commitlint   |
| CI          | GitHub Actions                                  |
