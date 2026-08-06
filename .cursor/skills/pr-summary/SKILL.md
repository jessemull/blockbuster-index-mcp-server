---
name: pr-summary
description: >-
  Generate a copy-pasteable GitHub PR description from the current branch diff.
  Fills `.github/PULL_REQUEST_TEMPLATE.md`. Use when the user runs /pr-summary,
  asks for a PR body, or pull request description before opening a PR.
disable-model-invocation: true
---

# PR Summary

Produce a **filled GitHub PR description** for the current branch matching `.github/PULL_REQUEST_TEMPLATE.md` exactly.

Content guidance:

- `docs/CONTRIBUTING.md` — What / Why / How / Testing
- `docs/REVIEW.md` — inform **Review Notes**

Do not invent or omit template sections.

---

## Workflow

### 1. Gather branch context

```bash
git fetch origin main
git branch --show-current
git status --short
git log --oneline origin/main..HEAD
git diff origin/main...HEAD --stat
git diff origin/main...HEAD
```

Include uncommitted changes in analysis if the working tree is dirty, and say so.

### 2. Infer metadata

| Field        | How                                                                |
| ------------ | ------------------------------------------------------------------ |
| Summary      | 1–3 sentences what + why                                           |
| Type         | One `[x]` from Conventional Commit types                           |
| Checklist    | `[x]` only when verified this session or clearly satisfied by diff |
| Review Notes | Approach, tests, risks                                             |

### 3. Checklist honesty

- Leave `make preflight` / push validation unchecked if not run this session
- Do not guess on security/architecture boxes

### 4. Output

1. One-line intro naming branch and diff scope
2. **One fenced `markdown` code block** with the fully filled PR body
3. Do not open a PR or push unless asked

If there is no diff vs `origin/main`, say so and stop.
