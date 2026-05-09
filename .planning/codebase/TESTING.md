# Testing Patterns

**Analysis Date:** 2026-05-09

## Test Framework

**Runner:**

- Vitest `^3.0.7` (root `package.json` `devDependencies`); each workspace package runs `vitest run` from its own `package.json`.

**Config:**

- `packages/core/vitest.config.ts` — `test.include`: `tests/**/*.test.ts`
- `apps/api/vitest.config.ts` — `test.include`: `tests/**/*.test.ts`
- `apps/web/vite.config.ts` — `test` block: `environment: "jsdom"`, `setupFiles: "./tests/setup.ts"`, `include`: `["tests/**/*.test.tsx"]`.

**Assertion library:**

- Vitest `describe` / `it` / `expect` (`packages/core/tests/buildTerminalList.test.ts`, `apps/api/tests/protocol.test.ts`).
- `@testing-library/react` + `@testing-library/jest-dom` wired in web setup (`apps/web/tests/setup.ts`).

**Run commands:**

```bash
pnpm test              # all packages (root: pnpm -r test)
pnpm --filter @octogent/api test
pnpm --filter @octogent/web test
pnpm --filter @octogent/core test
```

CI runs `pnpm test` after `pnpm lint` in `.github/workflows/ci.yml`.

## Test File Organization

**Location:**

- **Core:** `packages/core/tests/` (not under `src/`).
- **API:** `apps/api/tests/`.
- **Web:** `apps/web/tests/` plus shared helpers such as `apps/web/tests/test-utils/`.

**Naming:**

| Package | Typical pattern |
|--------|------------------|
| `packages/core` | `tests/**/*.test.ts` |
| `apps/api` | `tests/**/*.test.ts` |
| `apps/web` | `tests/**/*.test.tsx` (majority); one `.test.ts` file exists |

**Structural note:**

- Web Vitest `include` in `apps/web/vite.config.ts` is **`tests/**/*.test.tsx`**. The file `apps/web/tests/terminalReplay.test.ts` uses a **`.test.ts`** suffix; align new web tests with the configured glob (`.test.tsx`) or widen `include` to cover `.test.ts` if intentional.

## Test Structure

**Suite organization:**

```typescript
import { describe, expect, it, vi } from "vitest";

import { replayTerminalHistory } from "../src/components/terminalReplay";

describe("replayTerminalHistory", () => {
  it("clears selection and restores the previous scroll position after replay", () => {
    const reset = vi.fn();
    // ...
    expect(clearSelection).toHaveBeenCalledTimes(2);
  });
});
```

*(from `apps/web/tests/terminalReplay.test.ts`)*

**Domain / hexagonal-style core test:**

```typescript
import { describe, expect, it } from "vitest";

import { InMemoryTerminalSnapshotReader } from "../src/adapters/InMemoryTerminalSnapshotReader";
import { buildTerminalList } from "../src/application/buildTerminalList";

describe("buildTerminalList", () => {
  it("returns terminals sorted by creation time", async () => {
    const reader = new InMemoryTerminalSnapshotReader([/* ... */]);
    const result = await buildTerminalList(reader);
    expect(result.map((t) => t.terminalId)).toEqual([/* ... */]);
  });
});
```

*(from `packages/core/tests/buildTerminalList.test.ts`)*

**Patterns:**

- Use **async** `it` when awaiting application functions.
- Prefer explicit fake adapters (`InMemoryTerminalSnapshotReader`) over hitting real I/O in `packages/core`.

## Mocking

**Framework:** Vitest `vi` (`apps/web/tests/terminalReplay.test.ts`, `apps/api/tests/createApiServer.test.ts`).

**Module mock with hoist:**

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
}));

vi.mock("node-pty", () => ({
  spawn: spawnMock,
}));

import { createApiServer } from "../src/createApiServer";
```

*(from `apps/api/tests/createApiServer.test.ts`)*

**What to mock:**

- External processes (`node-pty` `spawn`), `requestAnimationFrame` / DOM where needed (`apps/web/tests/terminalReplay.test.ts`), `globalThis.WebSocket` via `apps/web/tests/setup.ts`.

**What not to mock:**

- Prefer real **pure/domain** logic in `packages/core` tested through ports/adapters (`InMemoryTerminalSnapshotReader` pattern).

## Fixtures and Factories

**Test data:**

- Inline arrays/objects inside tests for snapshots and terminal lists (`packages/core/tests/buildTerminalList.test.ts`).
- Larger API tests use temp dirs (`mkdtempSync`, filesystem helpers — `apps/api/tests/createApiServer.test.ts`).

**Location:**

- Harness utilities: `apps/web/tests/setup.ts`, `apps/web/tests/test-utils/appTestHarness` (e.g. `MockWebSocket`).

## Coverage

**Requirements:** Not enforced in config snippets reviewed — no `--coverage` script in root `package.json`.

**Coverage:** Vitest coverage can be added per package if needed (`vitest run --coverage`); not standardized here.

## Test Types

**Unit tests:**

- **Core:** application functions with in-memory adapters (`packages/core/tests/`).
- **API:** HTTP/protocol helpers and server behavior (`apps/api/tests/protocol.test.ts`, `createApiServer.test.ts`).
- **Web:** component and hook behavior with jsdom (`apps/web/tests/*.test.tsx`).

**Integration tests:**

- Heavier API tests spanning server + filesystem + mocked PTY (`apps/api/tests/createApiServer.test.ts`).

**E2E tests:**

- Not detected in workspace config; Playwright/Cypress absent from root manifests reviewed.

## Web test environment

**Setup** (`apps/web/tests/setup.ts`):

- Imports `@testing-library/jest-dom/vitest`.
- `afterEach` → `cleanup()` from `@testing-library/react`.
- Stubs `ResizeObserver`, canvas `getContext`, assigns `globalThis.WebSocket` to test double.

---

*Testing analysis: 2026-05-09*
