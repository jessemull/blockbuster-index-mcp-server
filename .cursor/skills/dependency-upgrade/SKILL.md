---
name: dependency-upgrade
description: >-
  Guide npm dependency additions and upgrades for Blockbuster Index MCP Server.
  New dependencies require human approval. Use when changing package.json or
  evaluating libraries.
---

# Dependency Upgrade

Read: `docs/SECURITY.md`, `docs/GOVERNANCE.md`, `CONTEXT.md` escalation rules.

**New dependencies require human approval.** Do not add packages autonomously.

---

## Workflow

1. State the problem the dependency solves.
2. Check whether existing code/deps already cover it.
3. Evaluate: maintenance, license, size, transitive risk, TypeScript types.
4. Prefer minimal, well-known packages aligned with the stack (AWS SDK v3, axios, etc.).
5. Get explicit human approval before editing `package.json`.
6. After approval:

```bash
npm install <package>
# or version bump
npm update <package>
```

7. Run `make preflight`.
8. Update docs if the dependency changes developer workflow.
9. Commit with scope `deps` (e.g. `chore(deps): add foo`).

---

## MUST NOT

- Add deps “just in case”
- Commit lockfile churn unrelated to the change
- Bypass approval for “tiny” packages
- Introduce GPL into application runtime without legal/human review

---

## Output

- Justification
- Alternatives considered
- Risks
- Approval status
- Verification commands run
