# PR summary (Blockbuster Index signal calculation server)

Generate a **copy-pasteable** GitHub PR description for the current branch.

---

## 1. Load the skill

Read and follow **`.cursor/skills/pr-summary/SKILL.md`** completely before writing output.

---

## 2. Template

Use **`.github/PULL_REQUEST_TEMPLATE.md`** as the exact section structure.

For content quality, also apply guidance from **`docs/CONTRIBUTING.md`** § PR description template (map What/Why/How/Testing into the GitHub sections per the skill).

---

## 3. Analyze the branch

From the repository root, diff against **`origin/main`**:

```bash
git fetch origin main
git branch --show-current
git status --short
git log --oneline origin/main..HEAD
git diff origin/main...HEAD --stat
git diff origin/main...HEAD
```

Include uncommitted changes in the analysis if the working tree is not clean, and say so in the summary.

Optional (when fast and relevant): run scoped checks — e.g. `make lint`, `npx jest` on touched tests. Do **not** run full `make preflight` unless the user asks.

---

## 4. Deliver

1. One-line intro naming branch and commit/diff scope.
2. **One fenced `markdown` code block** containing the fully filled PR body (this is the copy-paste target — do not skip the fence).
3. Do **not** open a PR or push unless the user asks.

If the branch has no commits and no diff vs `origin/main`, say so and stop — do not emit an empty template.
