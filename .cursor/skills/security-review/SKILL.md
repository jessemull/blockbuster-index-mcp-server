---
name: security-review
description: >-
  Security audit for Blockbuster Index signal calculation server: secrets, IAM, logging,
  dependencies, and network exposure. Use when reviewing security-sensitive
  changes or running a security pass.
---

# Security Review

Read: `docs/SECURITY.md`, `CONTEXT.md` escalation rules.

Security-sensitive changes require human review.

---

## Checklist

### Secrets

- [ ] No hardcoded credentials/tokens in source or CloudFormation
- [ ] `.env` not committed; `.env.example` has placeholders only
- [ ] New secrets documented and loaded via config/env

### Logging

- [ ] No secrets/PII in bunyan logs
- [ ] Error logs include operational context without sensitive payloads

### AWS / IAM

- [ ] Least-privilege task roles
- [ ] No overly broad `*` permissions added without justification
- [ ] S3 buckets not unintentionally public

### Dependencies

- [ ] New packages justified and approved
- [ ] No abandoned/high-risk packages
- [ ] Lockfile updated intentionally

### Network / Scraping

- [ ] Reasonable timeouts
- [ ] No credential leakage in scrape URLs/headers committed to repo

---

## Output

Use severity tags aligned with `docs/REVIEW.md`:

- **[MUST]** security blockers
- **[SHOULD]** important hardening in touched files
- **[NICE TO HAVE]** polish
- **[VERIFY]** concrete validation steps

End with a short verdict: **Pass** | **Needs work**.
