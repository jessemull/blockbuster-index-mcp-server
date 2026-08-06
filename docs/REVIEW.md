# PR Review Framework

> **Precedence:** CONTEXT.md > GOVERNANCE.md > ARCHITECTURE.md > **REVIEW.md** > inline comments.
>
> **AI agents — read this file when:** reviewing a PR, writing review comments, triaging review feedback, or deciding whether an issue is blocking.

---

## Severity tiers

### MUST (blocking)

The PR **cannot merge** until these are resolved.

- Architecture violations (wrong layering, cross-signal imports)
- Security issues (hardcoded secrets, secrets in logs)
- Crash-inducing bugs / unhandled failures in critical paths
- Data loss or corrupt published S3/DynamoDB contracts
- Governance violations (breaking non-negotiable constraints)
- Type safety violations (`any` misuse)
- New behavior without tests
- Coverage threshold regressions

### SHOULD (significant)

Fix in this branch before merge (same actionability as MUST for agents using `pr-review`).

- Performance regressions (N+1 DynamoDB, unbounded memory)
- Testing gaps (missing edge cases on touched logic)
- Weak error logging / missing context
- Missing env documentation for new variables
- Insufficient docs for calculation changes

### NICE TO HAVE (non-blocking)

- Naming improvements
- Minor style beyond linters
- Small readability refactors in touched files

---

## PR hygiene review

- [ ] PR description follows the template
- [ ] Focused on a single logical change
- [ ] Conventional Commits
- [ ] No unrelated bundled changes
- [ ] Size appropriate (< 400 lines preferred; large PRs justified)

---

## Architecture review checklist

- [ ] `entrypoint → service → repository` respected
- [ ] No cross-signal imports
- [ ] Shared logic in util / shared orchestration / generics
- [ ] Config via `src/config/config.ts`
- [ ] CloudFormation updated when infra required

---

## TypeScript review

- [ ] Strict typing; no unjustified `any`
- [ ] Explicit types on public APIs
- [ ] No empty catch blocks
- [ ] Alphabetization / perfectionist rules pass
- [ ] Comment policy followed (`docs/COMMENTS.md`)

---

## AWS review

- [ ] DynamoDB access confined to repositories
- [ ] S3 uploads use shared helpers
- [ ] IAM least privilege preserved
- [ ] Env vars documented in `docs/ENVIRONMENT.md` + `.env.example`
- [ ] No breaking output contract without coordination

---

## Security review

- [ ] No hardcoded secrets
- [ ] No sensitive data in logs
- [ ] Dependencies reviewed if changed
- [ ] Scraping credentials not committed

---

## Performance review

- [ ] No unnecessary loops on large datasets
- [ ] Batch AWS operations where appropriate
- [ ] Reasonable Puppeteer timeouts / retries
- [ ] Logging not excessively verbose at info

---

## Testing review

- [ ] New behavior has tests
- [ ] Bug fixes include regression tests
- [ ] Edge cases covered
- [ ] Mocks used (no real AWS in unit tests)
- [ ] Co-located `*.test.ts` naming
- [ ] Coverage remains ≥ 80%

---

## Logging & observability

- [ ] Bunyan used (not `console.log`)
- [ ] Errors include context
- [ ] Retry attempts logged appropriately

---

## Documentation review

- [ ] README / docs updated when behavior changes
- [ ] Signal calculation changes reflected in `docs/SIGNALS.md`
- [ ] Env changes reflected in `docs/ENVIRONMENT.md` + `.env.example`

---

## Automatic fail signals

Fail (MUST) if the PR introduces:

- Massive unstructured functions / god files without modularization
- Copy-paste duplication across signals that should be shared
- Silent catch blocks
- Hardcoded secrets
- Cross-signal imports
- Lowered coverage thresholds
- Hand-waved CloudFormation/IAM broadening

---

## Final reviewer questions

1. Would I be comfortable deploying this to production right now?
2. If this breaks at 2 AM, will the logs help diagnose it?
3. Does this make the codebase easier or harder to work in?
4. Are edge cases covered?
5. Is this the simplest solution that meets requirements?
