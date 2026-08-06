---
name: debugging
description: >-
  Systematic reproduce → isolate → fix workflow for Node.js/TypeScript/AWS
  signal failures. Use when investigating bugs, test failures, or ECS task errors.
---

# Debugging

Do not blind-patch. Follow reproduce → isolate → fix → verify.

---

## 1. Reproduce

- Capture exact command, env, signal name, and error message
- Prefer failing Jest test if possible
- For ECS: CloudWatch logs (`CW_LOG_GROUP` / bunyan JSON)

## 2. Isolate

- Bisect layer: entrypoint vs service vs repository vs AWS/network
- Check config/env missing values first (`src/config/config.ts`)
- Check retries/timeouts for transient AWS/scraping failures

## 3. Fix

- Smallest change that addresses root cause
- Add regression test that fails without the fix
- Avoid unrelated cleanup in the same change

## 4. Verify

```bash
npx jest path/to/relevant.test.ts
make test
```

For local signal behavior:

```bash
make signal SIGNAL=<name>
```

---

## Common Failure Modes

| Symptom                                      | Likely area                    |
| -------------------------------------------- | ------------------------------ |
| Missing env / undefined table                | config / ENVIRONMENT           |
| DynamoDB ConditionalCheckFailed / validation | repository item shape          |
| S3 AccessDenied                              | IAM / bucket config            |
| Puppeteer timeout                            | selectors, network, retries    |
| Coverage drop in CI                          | missing tests for new branches |
| Webpack wrong entry                          | `SIGNAL_TYPE`                  |

---

## Output

- Root cause summary
- Evidence (log lines / failing assertion)
- Fix + tests added
- Remaining risks
