# Testing

> **Precedence:** CONTEXT.md > GOVERNANCE.md > ARCHITECTURE.md > **TESTING.md**.
>
> **AI agents — read this file when:** writing tests, changing coverage config, or reviewing test quality.

---

## Strategy

| Layer                  | What to test                     | How                                |
| ---------------------- | -------------------------------- | ---------------------------------- |
| Helpers / pure scoring | Normalization, filters, slopes   | Unit tests                         |
| Services               | Business logic with mocked repos | Unit tests                         |
| Repositories           | DynamoDB marshalling/calls       | Unit tests + `aws-sdk-client-mock` |
| Entrypoints            | Orchestration happy/sad paths    | Unit tests with mocked services    |

Integration against real AWS is **out of scope** for the default Jest suite.

---

## Layout

- Co-located: `foo.ts` → `foo.test.ts`
- No separate top-level unit `tests/` directory
- Jest discovers `*.test.ts` by default

---

## Coverage

Configured in `jest.config.js`:

- **80%** global thresholds for branches, functions, lines, statements
- Enforced in GitHub Actions PR and deploy workflows
- Do not lower thresholds without a governance change

```bash
make test
make coverage
```

---

## Mocking

- Prefer patterns in `jest.setup.js` (logger, retry, S3)
- Use `aws-sdk-client-mock` for AWS SDK v3 clients
- Never call real DynamoDB, S3, or Puppeteer in unit tests
- Fake clocks/timers for time-dependent logic when needed

---

## Philosophy

Tests should serve **documentation**, **confidence**, and **safety**.

### Do test

- Public APIs and functions with logic
- Business rules and scoring
- Edge cases and error handling
- Integration points (with mocks)

### Do not overtest

- Internal implementation details
- Third-party library behavior
- Trivial getters / pure pass-throughs

### Structure

```typescript
it('should [expected behavior] when [condition]', async () => {
  // Arrange
  // Act
  // Assert
});
```

Guidelines:

- One concept per test
- Descriptive names
- Fast and isolated
- Assert _what_, not _how_

---

## Commands

| Command                         | Purpose                     |
| ------------------------------- | --------------------------- |
| `make test`                     | Full Jest suite             |
| `make test-watch`               | Watch mode                  |
| `npx jest path/to/file.test.ts` | Scoped run                  |
| `make coverage`                 | Coverage + open HTML report |
