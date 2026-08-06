# Contributing

> **Precedence:** CONTEXT.md > GOVERNANCE.md > ARCHITECTURE.md > **CONTRIBUTING.md** > inline comments.
>
> **AI agents — read this file when:** creating a branch, writing a commit message, preparing a PR, or advising on the contribution workflow.

---

## Getting started

### Prerequisites

- Node.js 22+ (see `.nvmrc`)
- npm
- AWS credentials (for ECS/bastion workflows)
- Docker (optional, for container signal runs)

### Bootstrap

```bash
git clone https://github.com/jessemull/blockbuster-index-mcp-server.git
cd blockbuster-index-mcp-server
npm install
cp .env.example .env   # fill in values; never commit .env
```

Husky hooks install via the `prepare` script on `npm install`.

### Verify

```bash
make preflight
```

---

## Branch naming

| Prefix                         | Use                                   |
| ------------------------------ | ------------------------------------- |
| `feat/<short-description>`     | New features                          |
| `fix/<short-description>`      | Bug fixes                             |
| `refactor/<short-description>` | Restructuring without behavior change |
| `docs/<short-description>`     | Documentation only                    |
| `test/<short-description>`     | Adding or fixing tests                |
| `chore/<short-description>`    | Tooling, CI, dependency updates       |
| `perf/<short-description>`     | Performance improvements              |

Use lowercase kebab-case.

---

## Commit conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/). Prefer `make commit` (Commitizen).

### Format

```
<type>(<scope>): <subject>
```

### Types

`feat`, `fix`, `refactor`, `test`, `docs`, `style`, `perf`, `chore`, `build`, `ci`, `revert`

### Scopes

Enforced by commitlint: `amazon`, `bls`, `broadband`, `census`, `walmart`, `blockbuster-index`, `config`, `repositories`, `services`, `signals`, `types`, `util`, `ci`, `docs`, `deps`

### Rules

- Subject: imperative, lowercase, no period, max 72 characters
- Body explains _why_
- Breaking changes: `!` after type/scope or `BREAKING CHANGE:` footer

---

## PR process

### Before opening a PR

1. Quality gates: commits run lint-staged; **`git push` runs full lint + format-check + test + build**. Optionally run `make preflight` before opening a PR.
2. Keep PRs focused — one logical change.
3. Update documentation when architecture, signals, env vars, or developer workflow change.

### PR description template (content guidance)

Map into `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## What

<1-3 sentences>

## Why

<problem / motivation>

## How

<technical approach; reviewer focus>

## Testing

<tests added; commands run>
```

### PR size guidelines

| Size   | Lines changed | Review expectation |
| ------ | ------------- | ------------------ |
| Small  | < 100         | Same-day           |
| Medium | 100–400       | 1–2 business days  |
| Large  | 400+          | Split if possible  |

---

## Code review expectations

### Authors

- Respond to all review comments
- Don't resolve conversations you didn't start
- Prefer fixup commits during review; squash on merge when appropriate

### Reviewers

- Use severity tiers from `docs/REVIEW.md` (MUST / SHOULD / NICE TO HAVE)
- Approve once all MUST items are resolved; SHOULD items must also be fixed before merge when using the agent `pr-review` skill
- Be specific: file, line, imperative fix

---

## Testing requirements

- Behavior changes require tests
- Bug fixes require regression tests
- Mock AWS/network — no real cloud calls in unit tests
- See `docs/TESTING.md`

---

## Merge criteria

A PR may merge when **all** are true:

1. CI is green (commitlint, lint, format-check, test with 80% coverage, build all signals)
2. At least one human reviewer has approved (when review is required)
3. All MUST-level review comments are resolved
4. No unresolved merge conflicts
5. Branch is up to date with the target branch
6. PR description is complete
7. Governance/infra/security changes follow `docs/GOVERNANCE.md`

### Merge strategy

- Squash and merge for feature branches with fixups
- Never force-push to `main`
