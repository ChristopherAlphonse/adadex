# Coding Conventions

**Analysis Date:** 2026-05-09

## Naming Patterns

**Files:**

- TypeScript sources: `*.ts` in `packages/core/src/`, `apps/api/src/`, `apps/web/src/`; React components use `*.tsx` under `apps/web/src/`.
- Tests: `*.test.ts` in `packages/core/tests/` and `apps/api/tests/`; predominantly `*.test.tsx` in `apps/web/tests/` (see `apps/web/vite.config.ts` `test.include`).

**Functions:**

- Use `camelCase` for functions and variables (example: `parsePort`, `validateStartupEnv` in `apps/api/src/server.ts`).

**Types:**

- `PascalCase` for types, interfaces, React components (`App`, `FakeGitClient` in tests).
- Use `type` imports for Node and cross-module types where applicable (example: `import type { IncomingMessage } from "node:http"` in `apps/api/tests/protocol.test.ts`).

## Code Style

**Formatting:**

- Biome (`@biomejs/biome` `^1.9.4`) via `pnpm format`: `biome format --write .`
- Indent: **2 spaces**; line width: **100** (`biome.json`).

**Linting:**

- `pnpm lint` runs `biome check .`
- Recommended rules enabled; import organization enabled (`biome.json` `organizeImports.enabled`).

## Import Organization

**Order:**

1. Node built-ins / framework / workspace packages (`@octogent/core`, `react`).
2. Blank line, then relative project imports grouped (hooks, components, runtime) — see `apps/web/src/App.tsx`.

**Path aliases:**

- Workspace package **`@octogent/core`** is imported by apps (example: `apps/web/src/App.tsx`).

**Tooling:**

- Rely on Biome `organizeImports` (`biome.json`) rather than hand-sorting when possible.

## Error Handling

**Patterns:**

- Validate configuration early and fail fast: `validateStartupEnv` in `apps/api/src/server.ts` uses `console.error` and `process.exit(1)` for invalid port or missing dirs; warns for recoverable UI dist issues (`console.warn`).
- Tests assert `null`/expected values with Vitest (`expect(getTerminalId(request)).toBeNull()` in `apps/api/tests/protocol.test.ts`).

## Logging

**Framework:** Node `console` for API bootstrap and operational messages (`apps/api/src/server.ts`).

**Patterns:**

- Use `console.error` for fatal configuration problems, `console.warn` for degraded-but-running states.

## Comments

**When to comment:**

- Repository guidance (`AGENTS.md`): explain **why**, not **what** — reserve comments for constraints, tradeoffs, or non-obvious reasoning.

**JSDoc/TSDoc:**

- Not uniformly required; prefer clear naming and types. TypeScript strictness carries most documentation load (`tsconfig.base.json`).

## Function Design

**Size:**

- Prefer focused functions; split large orchestration across modules (bootstrap thin in `server.ts`, composition in `createApiServer`).

**Parameters:**

- Use configuration objects at boundaries (example: object passed to `createApiServer` in `apps/api/src/server.ts`).

## Module Design

**Exports:**

- `packages/core`: `main`/`types` entry `packages/core/package.json` points at `./src/index.ts` — barrel or explicit exports via that surface.

**Barrel files:**

- Follow existing export patterns under `packages/core/src/` consumed by `@octogent/core` imports in apps.

## TypeScript conventions

**Base compiler options** (`tsconfig.base.json`):

- **`strict`** enabled
- **`noUncheckedIndexedAccess`**: `true`
- **`exactOptionalPropertyTypes`**: `true`
- **`moduleResolution`**: `"Bundler"`

**Packages:**

- `apps/api/tsconfig.json`, `apps/web/tsconfig.json`: extend base; web sets `"jsx": "react-jsx"`.
- `packages/core/tsconfig.json`: `composite`: `true`; `include` is `src` only (tests run under Vitest without being part of the core `tsc` include set).

---

*Convention analysis: 2026-05-09*
