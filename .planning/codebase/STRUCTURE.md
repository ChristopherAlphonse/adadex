# Codebase Structure

**Analysis Date:** 2026-05-09

## Directory Layout

```text
octogent/
├── apps/
│   ├── api/                 # Node HTTP/WebSocket API, PTY runtime, persistence
│   └── web/                 # Vite + React operator UI
├── packages/
│   └── core/                # Shared domain, application logic, ports
├── bin/
│   └── octogent             # Published CLI shim → bundled `apps/api` CLI
├── scripts/                 # Root dev/build/smoke orchestration (`dev.mjs`, etc.)
├── docs/                    # Product and reference documentation
├── prompts/                 # Source markdown prompts synced into project state
├── static/                  # Repo marketing / preview assets
├── .planning/               # Planning artifacts (this map)
├── pnpm-workspace.yaml      # `apps/*`, `packages/*`
├── package.json             # Workspace root scripts and engine constraints
├── tsconfig.base.json       # Shared TS compiler defaults
├── biome.json               # Lint/format configuration (referenced by root scripts)
└── README.md
```

## Directory Purposes

**`apps/api`:**
- Purpose: Server runtime, routing, integrations, and all Node-only orchestration.
- Contains: `src/server.ts`, `src/cli.ts`, `src/createApiServer/*`, `src/terminalRuntime/*`, `src/monitor/*`, usage and GitHub helpers, tests alongside implementation.
- Key files: `apps/api/src/createApiServer.ts`, `apps/api/src/terminalRuntime.ts`, `apps/api/package.json`

**`apps/web`:**
- Purpose: Operator-facing SPA and client-side state.
- Contains: `src/App.tsx`, `src/components/*`, `src/app/hooks/*`, `src/runtime/*`, `src/styles/*`, `vite.config.ts`, Vitest tests under `tests/`.
- Key files: `apps/web/src/main.tsx`, `apps/web/vite.config.ts`, `apps/web/package.json`

**`packages/core`:**
- Purpose: Cross-app TypeScript library with no React or Node server dependencies.
- Contains: `src/domain/*`, `src/application/*`, `src/ports/*`, `src/adapters/*`, `src/util/*`.
- Key files: `packages/core/src/index.ts`, `packages/core/package.json`

**`scripts`:**
- Purpose: Cross-package automation (development server pairing, builds, smoke tests).
- Key files: `scripts/dev.mjs`, `scripts/build-package.mjs` (referenced from root `package.json`).

**`docs`:**
- Purpose: Concepts, guides, and API reference consumed when changing behavior.
- Key entry: `docs/index.md`

**`prompts`:**
- Purpose: Prompt templates copied into `.octogent` state on API start (`apps/api/src/createApiServer.ts` ~53–62).

## Key File Locations

**Entry Points:**
- `apps/api/src/server.ts`: Standalone API process default host/port wiring.
- `apps/api/src/cli.ts`: CLI commands, initialization, bundled entry for `bin/octogent`.
- `apps/web/src/main.tsx`: React bootstrap.
- `scripts/dev.mjs`: Root `pnpm dev` orchestration.

**Configuration:**
- `pnpm-workspace.yaml`: Workspace membership.
- `package.json` (root): Engines, workspaces scripts, CLI bin mapping.
- `apps/api/tsconfig.json`, `apps/web/tsconfig.json`, `packages/core/tsconfig.json`: Per-package TS projects.
- `apps/web/vite.config.ts`: Dev server `/api` proxy and Vitest hints.
- `tsconfig.base.json`: Shared compiler options inherited by packages.

**Core Logic:**
- `apps/api/src/terminalRuntime.ts` and `apps/api/src/terminalRuntime/**`: Coordination and session lifecycle.
- `apps/api/src/createApiServer/requestHandler.ts`: Central HTTP dispatcher.
- `packages/core/src/application/buildTerminalList.ts`: Shared list normalization.

**Testing:**
- `apps/api`: `pnpm test` → `vitest run` (`apps/api/package.json`).
- `apps/web`: tests in `apps/web/tests/**/*.test.tsx` per `vite.config.ts` Vitest section.
- `packages/core`: `vitest run` from `packages/core/package.json`.

## Naming Conventions

**Files:**
- Route modules: `*Routes.ts` under `apps/api/src/createApiServer/` (`deckRoutes.ts`, `terminalRoutes.ts`, …).
- React components: `PascalCase.tsx` in `apps/web/src/components/` (e.g. `Terminal.tsx`).
- Hooks: `use*.ts` in `apps/web/src/app/hooks/`.
- Domain modules: `lowerCamel` or concept name files in `packages/core/src/domain/` (`terminal.ts`, `deck.ts`).

**Directories:**
- `apps/web/src/app/`: Non-UI orchestration (hooks, stores, types).
- `apps/web/src/components/ui/`: Shared UI primitives per `apps/web/AGENTS.md`.
- `apps/api/src/terminalRuntime/`: Submodules for session, git, registry, etc.

## Where to Add New Code

**New HTTP capability:**
- Add handler(s) in `apps/api/src/createApiServer/<area>Routes.ts` or a new `*Routes.ts` file.
- Register entries in `API_ROUTE_MAP` inside `apps/api/src/createApiServer/requestHandler.ts`.
- Keep shared types in `packages/core/src/domain/` or `ports/` if both apps need them.

**New WebSocket channel or terminal behavior:**
- Extend `apps/api/src/terminalRuntime/sessionRuntime.ts` or `apps/api/src/terminalRuntime.ts` and align protocol in `apps/api/src/terminalRuntime/protocol.ts`.
- Update client consumers under `apps/web/src/components/` or hooks; prefer `apps/web/src/runtime/runtimeEndpoints.ts` for URL construction.

**New shared domain rule or DTO:**
- Add types to `packages/core/src/domain/<topic>.ts` and export from `packages/core/src/index.ts`.
- Add pure transforms under `packages/core/src/application/` when they are use-case sized.

**New React surface:**
- Components: `apps/web/src/components/<Feature>.tsx` or feature folder.
- State/hooks: `apps/web/src/app/hooks/use<Feature>.ts`.
- Styles: new focused file under `apps/web/src/styles/` and import via `apps/web/src/styles.css` manifest.

**New tests:**
- API: colocate `*.test.ts` or mirror structure under `apps/api` (follow existing Vitest layout near changed modules).
- Web: `apps/web/tests/**/*.test.tsx`.
- Core: adjacent or `packages/core` test files per existing pattern.

## Special Directories

**`.adadex/` (per project workspace, not always committed):**
- Purpose: Runtime state—`state/coordinations.json`, `state/transcripts/*.jsonl`, worktrees, mirrored prompts.
- Generated: Yes, by running the API/CLI.
- Committed: Typically gitignored except intentional fixtures; see `docs/reference/filesystem-layout.md`.

**`dist/` (build output):**
- Purpose: Packaged API/CLI bundle consumed by `bin/octogent`.
- Generated: Yes (`pnpm build` pipeline in root `package.json`).
- Committed: Per release policy; root `package.json` `files` lists `dist`.

---

*Structure analysis: 2026-05-09*
