---
name: signal-development
description: >-
  End-to-end workflow for adding or modifying a Blockbuster Index signal:
  entrypoint, service, repository, types, constants, tests, CloudFormation,
  and docs. Use when creating a new signal or substantially changing one.
---

# Signal Development

Read first:

- `CONTEXT.md`, `AGENTS.md`
- `docs/ARCHITECTURE.md`, `docs/SIGNALS.md`, `docs/ENVIRONMENT.md`
- `.cursor/rules/030-signals.mdc`, `.cursor/rules/010-architecture.mdc`

New signals and CloudFormation changes require **human approval** before merge.

---

## Checklist — New Signal

1. **Types** — `src/types/<signal>.ts` (and exports)
2. **Constants** — `src/constants/<signal>.ts` as needed
3. **Repository** — `src/repositories/<signal>/` DynamoDB access
4. **Service** — `src/services/<signal>/` business logic
5. **Entrypoint** — `src/signals/<signal>/entrypoint.ts` + calculation modules
6. **Shared reuse** — prefer `shared-job-signal-orchestration` / generic sliding-window when applicable
7. **Dev runner** — `dev/runners/<signal>.dev.ts`
8. **Tests** — co-located `*.test.ts` for logic + entrypoint orchestration
9. **Build** — verify webpack `SIGNAL_TYPE=<signal>` build
10. **Docker** — verify container build with `SIGNAL_TYPE`
11. **CloudFormation** — task definition, DynamoDB tables, EventBridge schedule, IAM
12. **Env** — update `docs/ENVIRONMENT.md` + `.env.example`
13. **Docs** — update `docs/SIGNALS.md` and README signal lists if needed

---

## Local Verification

```bash
make signal SIGNAL=<name>
make test
SIGNAL_TYPE=<name> make build
```

---

## Anti-Patterns

- Copy-pasting an entire signal without extracting shared logic
- Cross-importing another signal's modules
- Shipping without S3/DynamoDB contract documentation
- Skipping CloudFormation or env documentation
