# Security

> **Precedence:** CONTEXT.md > GOVERNANCE.md > **SECURITY.md**.
>
> **AI agents — read this file when:** handling secrets, IAM, logging, dependencies, or security review.

---

## Secrets

- **Never** hardcode API keys, tokens, passwords, or AWS credentials in source or CloudFormation.
- Load configuration from environment variables via `src/config/config.ts`.
- Document variables in `docs/ENVIRONMENT.md` and provide placeholders in `.env.example`.
- Store CI secrets in GitHub Actions secrets.
- Never commit `.env` files.

---

## Logging

- Use bunyan (`src/util/logger`) — not `console.log` in signal/library code.
- **Never** log tokens, credentials, or sensitive payloads.
- Include operational context (signal, state, operation) for diagnosis.
- Prefer structured fields over string interpolation of secrets.

---

## AWS IAM & infrastructure

- Least privilege for ECS task roles and policies.
- Broadening IAM or security groups requires human review.
- S3 buckets should not be public unless explicitly required and reviewed.
- Infrastructure changes live in `cloudformation/` and require human approval.

---

## Dependencies

- New npm dependencies require human approval (`docs/GOVERNANCE.md`).
- Prefer maintained packages with clear licenses (MIT/BSD/Apache).
- Keep `package-lock.json` intentional — no drive-by churn.
- Audit when adding or upgrading (`npm audit` as appropriate).

---

## Network & scraping

- Use HTTPS endpoints.
- Apply timeouts and retries for external calls.
- Do not commit session cookies, scrapers' credentials, or captured PII fixtures with real data.

---

## Incident response

If a secret is leaked:

1. Rotate the credential immediately.
2. Remove it from git history if committed (human-led).
3. Notify maintainers.
4. Add regression safeguards (gitignore, scanning, docs).
