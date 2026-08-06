# AGENTS.md — Blockbuster Index MCP Server

> Complete development rules and constraints for AI agents and human contributors.
> This file is the authoritative reference for all coding standards, architecture rules, and workflow requirements.

---

## Repository Overview

| Field            | Value                                                                     |
| ---------------- | ------------------------------------------------------------------------- |
| **Project**      | Blockbuster Index MCP Server — retail/digital commerce signal calculation |
| **Architecture** | Modular signal microservices on AWS ECS Fargate                           |
| **Language**     | TypeScript (strict) on Node.js 22                                         |
| **Storage**      | DynamoDB (signal data) + S3 (published scores)                            |
| **IaC**          | CloudFormation                                                            |
| **Testing**      | Jest with 80% global coverage thresholds                                  |
| **Analysis**     | ESLint + Prettier + eslint-plugin-perfectionist                           |
| **CI/CD**        | GitHub Actions                                                            |
| **Git Hooks**    | Husky + lint-staged + Conventional Commits                                |

### Repository Structure

```
blockbuster-index-mcp-server/
├── src/
│   ├── config/                 # Env-backed application config
│   ├── constants/              # Shared constants (signals, weights, retry)
│   ├── repositories/           # DynamoDB data access (per-signal + generic)
│   ├── services/               # Business logic (per-signal + generic)
│   ├── signals/                # ECS entrypoints + signal calculation logic
│   │   ├── amazon/
│   │   ├── bls/
│   │   ├── broadband/
│   │   ├── census/
│   │   ├── walmart/
│   │   ├── blockbuster-index/
│   │   └── shared-job-signal-orchestration/
│   ├── types/                  # Shared TypeScript types
│   └── util/                   # Logger, S3, retry, normalization helpers
├── cloudformation/             # ECS, DynamoDB, S3 infrastructure
├── dev/runners/                # Local signal runners
├── scripts/                    # Bastion, ECS, local signal helpers
├── docs/                       # Governance + domain documentation
├── .cursor/                    # Cursor rules, skills, commands
├── .github/                    # CI workflows + PR/issue templates
├── .husky/                     # Git hooks
├── CONTEXT.md                  # Primary AI entry point
├── AGENTS.md                   # This file
├── Makefile                    # Developer commands
├── package.json
├── jest.config.js
├── eslint.config.js
└── webpack.config.js
```

---

## Development Commands

All commands are available via `make` targets (preferred) or npm scripts. Run **`make`** or **`make help`** for a compact list.

### Quality / CI

| Command             | Description                                                         |
| ------------------- | ------------------------------------------------------------------- |
| `make lint`         | ESLint on TypeScript sources                                        |
| `make format`       | Prettier write                                                      |
| `make format-check` | Prettier check (no write)                                           |
| `make test`         | Jest test suite                                                     |
| `make test-watch`   | Jest watch mode                                                     |
| `make coverage`     | Jest with coverage + open HTML report                               |
| `make build`        | Webpack production build (requires `SIGNAL_TYPE` for single signal) |
| `make clean`        | Remove `dist/`                                                      |
| `make preflight`    | lint + format-check + test + build                                  |
| `make ci`           | Alias for `preflight`                                               |

### Local signals / AWS

| Command                               | Description                             |
| ------------------------------------- | --------------------------------------- |
| `make signal SIGNAL=<name>`           | Run a signal locally via `dev/runners/` |
| `make signal-container SIGNAL=<name>` | Build and run signal in Docker          |
| `make ecs-run SIGNAL=<name>`          | Run a single ECS Fargate task (dev)     |
| `make ecs-run-all`                    | Run all signal ECS tasks                |
| `make bastion`                        | SSH to bastion host                     |
| `make commit`                         | Interactive Commitizen commit           |

---

## Language & Framework Rules

### TypeScript

- Strict mode is **always enabled**. Do not weaken `tsconfig.json`.
- Do **not** use `any` in production code without a justification comment. Tests may use `any` where needed.
- Prefer `interface` for object shapes; use `type` for unions/intersections/aliases.
- Prefer named exports over default exports.
- Use explicit return types on public functions and class methods.

### Naming

| Element               | Convention         | Example                       |
| --------------------- | ------------------ | ----------------------------- |
| Files                 | `kebab-case.ts`    | `amazon-signal-repository.ts` |
| Classes               | `PascalCase`       | `AmazonSignalRepository`      |
| Functions / variables | `camelCase`        | `getAmazonScores`             |
| Constants             | `UPPER_SNAKE_CASE` | `SIGNAL_WEIGHTS`              |
| Types / Interfaces    | `PascalCase`       | `SignalScore`                 |
| Test files            | `<module>.test.ts` | `amazon-service.test.ts`      |

### Error Handling

- Never swallow errors with empty `catch` blocks.
- Log errors with context via the bunyan logger (`src/util/logger`).
- Use the shared retry helper (`src/util/helpers/retry`) for transient AWS/network failures.
- Fail fast on missing required configuration.

### Immutability & Style

- Prefer `const`; avoid reassignment.
- Prefer pure functions for scoring/normalization math.
- Keep functions small and single-purpose.
- Alphabetize imports, named import members, object keys, and type properties when practical (enforced by `eslint-plugin-perfectionist`).

---

## Architecture Rules

### Signal Pattern

```
entrypoint → service → repository
```

| Layer        | Responsibility                                               |
| ------------ | ------------------------------------------------------------ |
| `entrypoint` | Process bootstrap, orchestration, upload results, exit codes |
| `service`    | Business logic, scoring, aggregation, sliding windows        |
| `repository` | DynamoDB reads/writes; no business decisions                 |
| `util/s3`    | S3 upload helpers shared across signals                      |

### Boundaries

- Signals **MUST NOT** import from other signal directories under `src/signals/<other>/`.
- Cross-signal shared job scraping/orchestration lives in `src/signals/shared-job-signal-orchestration/`.
- Shared math/helpers live in `src/util/helpers/`.
- Shared constants live in `src/constants/`.
- Shared types live in `src/types/`.

### Webpack / Deployment

- Each signal builds via webpack with `SIGNAL_TYPE` selecting `src/signals/<signal>/entrypoint.ts`.
- Docker image accepts `SIGNAL_TYPE` build arg.
- CloudFormation task definitions must stay in sync when adding a signal.

### Config

- Read configuration only through `src/config/config.ts`.
- New env vars MUST be documented in `docs/ENVIRONMENT.md` and `.env.example`.

---

## Performance Rules

- Prefer batch DynamoDB operations over per-item loops when volume is high.
- Avoid N+1 repository calls inside hot loops.
- Scraping (Puppeteer) must use reasonable timeouts and retries.
- Do not load entire large datasets into memory when streaming/parsing is available (CSV loaders).
- Keep CloudWatch log volume meaningful — not per-item spam at `info` level.

---

## Logging Rules

- Use bunyan via `src/util/logger` — never `console.log` in production paths.
- **NEVER** log secrets, tokens, AWS credentials, or full request bodies containing PII.
- Include enough context to diagnose failures (signal name, state, operation).
- Use appropriate levels: `debug` for verbose, `info` for lifecycle, `warn`/`error` for failures.

---

## Security Rules

### Secrets

- **NEVER** hardcode API keys, tokens, passwords, or AWS credentials in source.
- Use environment variables; document them in `docs/ENVIRONMENT.md` and `.env.example`.
- Store CI/CD secrets in GitHub Actions secrets — never in repository files.

### AWS

- Follow least-privilege IAM in CloudFormation.
- Do not broaden security group or IAM permissions without human review.
- Prefer SDK defaults and region from config (`AWS_REGION`).

### Dependencies

- Audit dependencies for known vulnerabilities before adding.
- Pin versions appropriately via `package-lock.json`.
- New dependencies require human approval (see Escalation Rules in `CONTEXT.md`).

---

## Testing Rules

### Requirements

- Unit tests required for services, repositories, helpers, and signal calculation logic.
- Entrypoint tests should cover orchestration happy/sad paths with mocked dependencies.
- Every new logic file should have a corresponding `*.test.ts`.

### Coverage

- Global minimum: **80%** branches, functions, lines, statements (`jest.config.js`).
- Coverage is enforced in PR CI and deploy workflows.

### Mocking

- Mock AWS SDK with `aws-sdk-client-mock` where applicable.
- Reuse patterns from `jest.setup.js` (logger, retry, S3 mocks).
- Never call real AWS, real network, or real Puppeteer in unit tests.

### Structure

```typescript
it('should [expected behavior] when [condition]', () => {
  // Arrange
  // Act
  // Assert
});
```

### Philosophy

- Tests document behavior, provide confidence, and enable safe refactoring.
- Cover happy path, sad path, and edge cases.
- Do not overtest: skip trivial getters, third-party library behavior, and pure pass-throughs.
- Prefer behavior assertions over implementation details.

---

## Comment Policy

See `docs/COMMENTS.md` for the complete policy.

**Summary**: comments are a maintenance cost. Write self-documenting code first. Add comments only when:

- **Intent is non-obvious**: the _why_ behind a decision
- **Architecture decisions**: trade-offs and rationale
- **Security constraints**: why an approach is security-critical
- **Performance trade-offs**: why a less readable approach was chosen
- **AWS / scraping quirks**: platform-specific workarounds

Do **not** write comments that restate what the code does.

Standalone comments should have a blank line above and below (except at block start/end). JSDoc sits directly above the declaration with no blank line between.

---

## Forbidden Patterns

| Pattern                                                | Why It's Banned            | Alternative                          |
| ------------------------------------------------------ | -------------------------- | ------------------------------------ |
| `any` in production code without justification         | Defeats type safety        | Proper types / generics              |
| Business logic in repositories                         | Mixed concerns             | Move to services                     |
| DynamoDB/S3 calls in entrypoints (except via services) | Skips layering             | Use services                         |
| Cross-signal imports                                   | Coupling / brittle deploys | Shared util or orchestration package |
| Empty `catch` / silent failures                        | Hides production bugs      | Log + rethrow or typed failure       |
| Hardcoded secrets                                      | Security risk              | Env vars via `config.ts`             |
| `console.log` in library/signal code                   | Unstructured logs          | Bunyan logger                        |
| God files (>500 lines) without modularization          | Unmaintainable             | Extract modules                      |
| Reducing coverage thresholds                           | Weakens safety net         | Add tests                            |
| `--no-verify` on commit/push                           | Bypasses governance        | Fix the underlying failure           |
| Editing governance docs without human approval         | Process integrity          | Propose PR for review                |

---

## AI Assistant Rules

### Mandatory

- **READ** `CONTEXT.md` before starting any work.
- **PUSH** to validate — `git push` runs the full gate via husky; do **not** run `make preflight` before every push unless you need an extra local confirmation. Use scoped tests + `make lint` while iterating.
- **EXPLAIN** architectural decisions in the PR description.
- **TEST** every new logic file — no untested logic may be submitted.
- **FORMAT** all changes with Prettier before committing.
- **USE** Conventional Commits format: `type(scope): description`
  - Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`
  - Scope: see commitlint scope enum (e.g. `amazon`, `bls`, `signals`, `docs`, `ci`)

### Prohibited

- **DO NOT** add dependencies without human approval.
- **DO NOT** modify CI workflows (`.github/workflows/`) without human approval.
- **DO NOT** modify CloudFormation without human approval.
- **DO NOT** change governance documents (`CONTEXT.md`, `AGENTS.md`, `docs/GOVERNANCE.md`) without human approval.
- **DO NOT** introduce any Forbidden Pattern listed above.
- **DO NOT** disable lint rules without a justification comment and human approval.
- **DO NOT** skip tests or reduce coverage thresholds.

### PR Requirements

Every pull request must:

1. Pass push validation (husky on `git push`) and CI (build, lint, test, coverage).
2. Include a description explaining _what_ changed and _why_.
3. Include tests for all new or changed logic.
4. Not reduce test coverage below 80%.
5. Follow Conventional Commits for commit messages.
6. Be scoped to a single concern — no mixed refactors and features.
7. Update `docs/ENVIRONMENT.md` and `.env.example` if env vars changed.

---

## Git Conventions

### Branch naming

| Prefix                         | Use                                   |
| ------------------------------ | ------------------------------------- |
| `feat/<short-description>`     | New features                          |
| `fix/<short-description>`      | Bug fixes                             |
| `refactor/<short-description>` | Restructuring without behavior change |
| `docs/<short-description>`     | Documentation only                    |
| `test/<short-description>`     | Adding or fixing tests                |
| `chore/<short-description>`    | Tooling, CI, dependency updates       |
| `perf/<short-description>`     | Performance improvements              |

Use lowercase kebab-case descriptions.

### Commits

- Prefer `npm run commit` / `make commit` (Commitizen).
- Subject: imperative mood, lowercase, no period, max 72 characters.
- Body explains _why_, not _what_.
