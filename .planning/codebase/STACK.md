# Technology Stack

**Analysis Date:** 2026-05-09

## Languages

**Primary:**

- **TypeScript** — Entire application surface: domain logic, HTTP/WebSocket server, React UI, tests, and build tooling. Shared compiler baseline in `tsconfig.base.json` (ES2022 target, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).

**Secondary:**

- **JavaScript (ES modules)** — Root automation only: `scripts/dev.mjs`, `scripts/build-package.mjs`, `scripts/smoke-public-install.mjs` (Node `import`/`export`, no separate compile step beyond what invokes them).
- **Shell** — `bin/octogent` shebang entry that delegates to bundled CLI (`bin/octogent` → `dist/api/cli.js`).

## Runtime

**Environment:**

- **Node.js** `>=22.0.0` — Declared in root `package.json` `engines`. CI uses Node 22 (`.github/workflows/ci.yml`). API bundle target is `node22` (`apps/web/vite.api.bundle.config.mts`).

**Package Manager:**

- **pnpm** `10.4.1` — Declared via `packageManager` in root `package.json`; CI pins the same version (`.github/workflows/ci.yml`).
- **Lockfile:** `pnpm-lock.yaml` (use `pnpm install --frozen-lockfile` in CI and reproducible builds).

## Frameworks

**Core:**

- **`@octogent/core`** (`packages/core`) — Framework-agnostic domain types and pure logic; build is `tsc -p packages/core/tsconfig.json --noEmit` (`packages/core/package.json`).
- **`@octogent/api`** (`apps/api`) — Local HTTP + WebSocket server, PTY orchestration, filesystem/git integration. Dev server: `tsx watch src/server.ts` (`apps/api/package.json`); entry for long-running process: `apps/api/src/server.ts`.
- **`@octogent/web`** (`apps/web`) — Vite + React operator UI. Dev: `vite` (`apps/web/package.json`); config: `apps/web/vite.config.ts` (proxies `/api` and WebSockets to the API origin).

**Testing:**

- **Vitest** `^3.0.7` (root `package.json`; workspace resolves compatible minors) — Each package runs `vitest run` via `pnpm -r test`. Configs: `apps/api/vitest.config.ts`, `apps/web/vite.config.ts` (`test` block), `packages/core/vitest.config.ts`. Web tests use **jsdom** and `@testing-library/react` (`apps/web/package.json`, `apps/web/vite.config.ts`).

**Build / Dev:**

- **Vite** `^6.2.0` (`apps/web`) — SPA build and dev server.
- **TypeScript** `^5.8.2` (root `devDependencies`) — `tsc --noEmit` for type-check builds in `apps/web` and `apps/api`.
- **tsx** `^4.20.6` (`apps/api`) — Fast TypeScript execution for `dev` watch mode.
- **Rollup (via Vite)** — Bundles the published API/CLI into `dist/api/cli.js` using `apps/web/vite.api.bundle.config.mts` (library mode, Node externals for `node-pty` and `ws`).

**Lint / quality:**

- **Biome** `^1.9.4` — Formatter, linter, import organizer; config `biome.json`. Prescriptive commands: `pnpm lint` → `biome check .`, `pnpm format` → `biome format --write .` (root `package.json`).
- **knip** `^6.3.1` — Unused dependency / export analysis (devDependency only; invoke via `pnpm exec knip` when tuning the tree).

## Key Dependencies

**Critical (runtime / product behavior):**

- **`node-pty`** `^1.1.0` — PTY sessions for agent terminals (root, `apps/api`; marked external in `apps/web/vite.api.bundle.config.mts`). Native addon: ensure toolchain matches Node major when publishing binaries.
- **`ws`** `^8.19.0` — WebSocket server alongside HTTP (`apps/api`; external in API bundle config).

**UI / visualization:**

- **React** `^19.0.0`, **react-dom** `^19.0.0` (`apps/web`).
- **xterm** `^5.3.0`, **`@xterm/addon-fit`**, **`xterm-addon-unicode11`** — In-browser terminal rendering (`apps/web/package.json`).
- **`marked`** `^17.0.4` — Markdown rendering in the UI (`apps/web/package.json`).
- **`d3-force`** `^3.0.0` — Graph layout for canvas/deck views (`apps/web/package.json`).
- **`lucide-react`** `^1.7.0` — Icons (`apps/web/package.json`).

**Infrastructure (published CLI package):**

- Root `package.json` `files`: `["bin", "dist", "README.md"]` — Ship `bin/octogent` plus `dist/` produced by `pnpm build` (`build` runs web build, API bundle via Vite, then `scripts/build-package.mjs` which stages `dist/web` and `dist/prompts`).

## Configuration

**Environment:**

- Configure via process environment variables (no committed `.env` or `.env.example` detected in-repo; treat secrets as operator-supplied). Primary references: `apps/api/src/server.ts`, `apps/api/src/cli.ts`, `apps/api/src/terminalRuntime.ts`, `apps/web/vite.config.ts`, `apps/web/src/runtime/runtimeEndpoints.ts`, `scripts/dev.mjs`.
- Prescriptive: prefer explicit `OCTOGENT_*` variables documented in `docs/reference/` when changing behavior; never commit credential-bearing files.

**Build:**

- Workspace layout: `pnpm-workspace.yaml` (`apps/*`, `packages/*`).
- Shared TS options: `tsconfig.base.json`; per-package `tsconfig.json` files extend or compose from it (`apps/api/tsconfig.json`, `apps/web/tsconfig.json`, `packages/core/tsconfig.json`).
- Root scripts: `package.json` — `pnpm dev` runs `scripts/dev.mjs` (coordinates API port discovery and web dev server), `pnpm build` builds web, bundles API CLI, copies assets to `dist/`.

## Platform Requirements

**Development:**

- Node.js 22+, pnpm 10.4.x, Git available on PATH (worktrees, summaries), optional **`gh`** CLI for GitHub-backed features (`apps/api/src/githubRepoSummary.ts`).
- Windows and Unix: PTY shell selection uses `ComSpec` / `SHELL` (`apps/api/src/terminalRuntime/sessionRuntime.ts`).

**Production:**

- **Local / developer machine** — Primary deployment shape is a local Node process serving API + static web (`OCTOGENT_WEB_DIST_DIR`) or `pnpm`-driven dev. No container definitions or cloud-specific IaC found in-repo for this analysis scope.

---

*Stack analysis: 2026-05-09*
