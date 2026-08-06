## Summary

<!-- What does this PR do? Why? -->

## Type

- [ ] Feature (new functionality)
- [ ] Fix (bug fix)
- [ ] Refactor (code improvement, no behavior change)
- [ ] Test (adding/updating tests)
- [ ] Docs (documentation only)
- [ ] Chore (dependencies, CI, tooling)

## Checklist

### Required

- [ ] `make preflight` passes (or push validation: lint + format-check + test + build)
- [ ] PR CI green (commitlint, preflight, build all signals)
- [ ] Tests added/updated for changes
- [ ] Coverage remains ≥ 80%
- [ ] No new lint/format violations

### Architecture

- [ ] Signal pattern followed (`entrypoint → service → repository`)
- [ ] No cross-signal coupling
- [ ] Config/env changes documented (`.env.example` + `docs/ENVIRONMENT.md`)

### Security

- [ ] No hardcoded secrets
- [ ] No sensitive data in logs

## Review Notes

<!-- Anything reviewers should focus on? -->
