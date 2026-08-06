# Start feature branch (Blockbuster Index MCP Server)

Branch name: **$ARGUMENTS**

If `$ARGUMENTS` is empty, stop and ask for a feature branch name (Conventional Commit scope style, e.g. `feat/amazon-retry` or `chore/governance-docs`).

---

## 1. Load governance (CONTEXT.md mandatory reading order)

Read these files **in order** before any implementation work:

1. `CONTEXT.md`
2. `AGENTS.md`
3. `docs/GOVERNANCE.md`
4. `docs/ARCHITECTURE.md`
5. `docs/TESTING.md`
6. `docs/COMMENTS.md`
7. `docs/SECURITY.md`
8. `docs/ENVIRONMENT.md`
9. `docs/SIGNALS.md`

Complete the **Confirmation Requirement** checklist at the bottom of `CONTEXT.md`. If a listed doc is missing, note it and treat `CONTEXT.md` + `AGENTS.md` as authoritative.

Do not skip docs because the task “seems unrelated.”

---

## 2. Sync `main` and create the feature branch

From the repository root:

```bash
git fetch origin main
git checkout main
git pull origin main
git checkout -b $ARGUMENTS
```

Rules:

- Branch from **updated `main`**, not from a stale local branch.
- Use the branch name exactly as provided in `$ARGUMENTS`.
- Do not commit or push unless the user asks.
- If the branch already exists locally, stop and ask whether to check it out or use a different name.
- In **git worktrees**, if `main` is checked out elsewhere, branch from `origin/main` instead: `git checkout -b $ARGUMENTS origin/main`.

---

## 3. Confirm hooks

Ensure dependencies (and husky) are installed:

```bash
npm install
test -f .husky/pre-commit && echo OK
```

---

## 4. Confirm when finished

Reply with a short summary that includes:

- [ ] All mandatory docs read (list any that were missing)
- [ ] `CONTEXT.md` Confirmation Requirement acknowledged
- [ ] `main` pulled successfully (include the `main` HEAD short SHA)
- [ ] Husky hooks present
- [ ] Now on branch `$ARGUMENTS` (include `git branch --show-current` and `git status --short`)

Then ask what task to work on next (or wait for the user’s assignment).

---

## 5. When a task is assigned (plan-first)

If the user assigns a scoped architecture or audit task (branch + checklist in the prompt):

1. **Switch to Plan mode** (or produce a plan only — no file edits in the first response).
2. Explore the scoped directories listed in the prompt.
3. Output a written plan (files, steps, risks, verification) and **stop for approval**.
4. Implement only after the user explicitly approves the plan.
