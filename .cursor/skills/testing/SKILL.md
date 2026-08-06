---
name: testing
description: >-
  Jest testing workflow for Blockbuster Index signal calculation server: coverage, mocks,
  co-located tests, and testing philosophy. Use when writing, fixing, or
  reviewing tests.
---

# Testing

Read: `docs/TESTING.md`, `AGENTS.md` § Testing Rules, `jest.config.js`, `jest.setup.js`.

---

## Goals

Tests provide documentation, confidence, and safety for refactoring.

---

## Workflow

1. Identify behavior under test (public API / scoring / orchestration).
2. Add or update co-located `*.test.ts`.
3. Mock AWS / network / logger per `jest.setup.js` and `aws-sdk-client-mock`.
4. Cover happy path, failure path, and edge cases.
5. Run:

```bash
make test
# or scoped:
npx jest path/to/file.test.ts
```

6. Confirm global coverage still meets 80% when changing shared modules.

---

## Patterns

```typescript
it('should [expected behavior] when [condition]', async () => {
  // Arrange
  // Act
  // Assert
});
```

### MUST

- [ ] Deterministic (no real AWS/network/Puppeteer)
- [ ] Assert behavior, not private implementation
- [ ] Entrypoint tests mock services/repos

### MUST NOT

- ❌ Lower coverage thresholds
- ❌ Overtest trivial pass-throughs
- ❌ Leave new scoring logic untested

---

## Output

When asked to add tests, report:

- files added/updated
- scenarios covered
- commands run and results
