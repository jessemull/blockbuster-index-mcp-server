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
- Each signal has its **own ECS task role** (amazon, walmart, census, broadband, bls, blockbuster-index) exporting `${Environment}-Blockbuster<Signal>TaskRoleArn`. Roles only include DynamoDB/S3 permissions that signal needs (amazon/walmart also read census for workforce normalization).
- EventBridge invoke role may `iam:PassRole` the execution role plus all six task roles.
- Broadening IAM or security groups requires human review.
- S3 buckets should not be public unless explicitly required and reviewed.
- Infrastructure changes live in `cloudformation/` and require human approval.

### Deploy order (per-signal roles)

Cutover is **two-phase** so CloudFormation does not delete an export still imported by task stacks.

**Phase 1 — cluster stack only (`blockbuster-index-cluster-dev` / `-prod`):**

- Keep shared `ECSTaskRole` + `${Environment}-BlockbusterTaskRoleArn` export.
- Create the six per-signal roles + their exports.
- EventBridge `PassRole` allows execution role, shared role, and all six signal roles.

**Phase 2 — all six task-definition stacks:**

- Redeploy each `blockbuster-index-<signal>-task-stack-<env>` so `TaskRoleArn` imports the per-signal export (e.g. `…BlockbusterAmazonTaskRoleArn`).
- Prefer the GitHub Deploy workflow per signal (rebuilds image + updates the task stack).

**Phase 3 — cluster cleanup (after Phase 2):**

- Remove shared `ECSTaskRole` and `${Environment}-BlockbusterTaskRoleArn`.
- Trim EventBridge `PassRole` to execution + the six signal roles only.

Also ensure the CI/deploy IAM principal has `iam:PassRole` on the new role ARNs.

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
