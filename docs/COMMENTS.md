# Comments

> **Precedence:** CONTEXT.md > GOVERNANCE.md > **COMMENTS.md**.
>
> **AI agents — read this file when:** adding comments, JSDoc, or reviewing documentation-in-code.

---

## Policy summary

Comments are a maintenance cost. Prefer self-documenting names, types, and structure.

Add comments only when they convey information the code cannot:

- **Intent / why** behind a non-obvious decision
- **Architecture trade-offs** and alternatives considered
- **Security constraints**
- **Performance trade-offs**
- **AWS, Puppeteer, or API quirks** and workarounds
- **Justification** for unavoidable `any` or lint suppressions

Do **not**:

- Restate what the next line does
- Leave `TODO` without ticket/context
- Keep commented-out dead code (delete it)

---

## Spacing rules (TypeScript)

### Standalone comments

- Empty line **above and below** for mid-block standalone comments
- At **block start**: empty line **below** only
- At **block end**: empty line **above** only

### JSDoc

- Place directly **above** the declaration
- **No** blank line between JSDoc and the symbol

### Example

```typescript
function processScores(scores: number[]): number[] {
  // Filter outliers before normalization

  const filtered = removeOutliers(scores);

  // Min-max normalize to 0–100

  return normalize(filtered);
}

/**
 * Uploads signal scores to S3 for website consumption.
 */
export async function uploadScores(key: string, body: unknown): Promise<void> {
  // implementation
}
```

---

## Public API documentation

Use JSDoc on exported functions, classes, and non-obvious types when callers need contracts beyond the type signature (units, invariants, side effects).
