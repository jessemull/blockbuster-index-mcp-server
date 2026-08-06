# Gemini Agent Instructions — Blockbuster Index MCP Server

Before making any changes to this repository:

1. Read `CONTEXT.md` — mandatory loading order, precedence chain, quality gates
2. Read `AGENTS.md` — complete development rules and constraints
3. Read all mandatory `docs/` listed in CONTEXT.md

Do NOT duplicate governance from AGENTS.md or docs/ here. This file exists only as an entry point redirect.

## Quick Reference

- Install: `npm install`
- Hooks: installed via `npm prepare` (husky)
- Preflight: `make preflight` (optional; `git push` runs push validation)
- Test: `make test`
- Lint: `make lint`
- Format: `make format`
- Build: `make build`
- Local signal: `make signal SIGNAL=<name>`
