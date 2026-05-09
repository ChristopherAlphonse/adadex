<!-- refreshed: 2026-05-09 -->
# Architecture

**Analysis Date:** 2026-05-09

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Operator UI (Vite + React)                                │
│                    `apps/web/src/`                                           │
│  `main.tsx` → `App.tsx` → hooks/components → `/api/*` + WebSocket terminals   │
├───────────────────────────────┬─────────────────────────────────────────────┤
│  `src/runtime/`               │  `src/app/hooks/`                            │
│  URL builders + HTTP reader   │  polling, mutations, persisted UI state     │
└───────────────────────────────┴──────────────────┬──────────────────────────┘
                                                     │ HTTPS / WS (same origin or
                                                     │ `VITE_OCTOGENT_API_ORIGIN`)
                                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              Octogent API (Node HTTP + `ws` upgrade)                         │
│              `apps/api/src/createApiServer.ts`                                 │
│  `requestHandler.ts` (/api routing) ◄──► `terminalRuntime.ts` (+ submodules)│
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Shared domain & ports (`packages/core/src/`)                               │
│  domain types · `application/buildTerminalList` · `TerminalSnapshotReader`    │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Project state · PTY sessions · git worktrees · transcripts                   │
│  `<workspace>/.octogent/` or global project state dirs (CLI persistence)      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| API bootstrap | Validates env paths/ports; starts/shuts down HTTP server | `apps/api/src/server.ts` |
| API composition | Wires terminal runtime, monitor, usage readers, prompts sync, HTTP server | `apps/api/src/createApiServer.ts` |
| HTTP + static | Route table under `/api/*`, CORS/host checks, optional SPA static from `webDistDir` | `apps/api/src/createApiServer/requestHandler.ts` |
| WebSocket upgrade | Host/origin gate then delegates to terminal runtime | `apps/api/src/createApiServer/upgradeHandler.ts` |
| Terminal runtime | Registry, PTY sessions, worktrees, conversations, deck/git hooks, WS fan-out | `apps/api/src/terminalRuntime.ts`, `apps/api/src/terminalRuntime/*` |
| Web shell | Renders UI, reconciles snapshots, calls REST + terminal/event sockets | `apps/web/src/App.tsx`, `apps/web/src/components/*`, `apps/web/src/app/hooks/*` |
| Transport helpers | Builds absolute or same-origin `/api` URLs from `VITE_OCTOGENT_API_ORIGIN` | `apps/web/src/runtime/runtimeEndpoints.ts` |
| Core contracts | Framework-agnostic types, list building, ports | `packages/core/src/index.ts`, `packages/core/src/domain/*`, `packages/core/src/application/*`, `packages/core/src/ports/*` |
| CLI | Project init, port selection, packaged server entry | `apps/api/src/cli.ts`, root `bin/octogent` |

## Pattern Overview

**Overall:** Monorepo with **ports-and-adapters** in `packages/core` and **thin HTTP route wiring** in `apps/api`, consumed by a **React operator UI** in `apps/web`.

**Key Characteristics:**
- **Single Node HTTP server** serves JSON API, optional static web build, and **WebSocket upgrades** for terminals and terminal-wide events.
- **`@octogent/core`** is the only shared library between API and web; both apps import domain types and pure helpers from it.
- **Persistence and process boundaries** stay in `apps/api` (PTY, filesystem, git); `packages/core` stays free of those concerns per `packages/core/AGENTS.md`.

## Layers

**Presentation (web):**
- Purpose: Visualize tentacles/terminals, drive CRUD and setup flows through REST and WebSockets.
- Location: `apps/web/src/`
- Contains: React components, hooks, CSS modules manifest via `apps/web/src/styles.css`.
- Depends on: `@octogent/core`, browser `fetch`, `WebSocket`, Vite env `import.meta.env.VITE_OCTOGENT_API_ORIGIN`.
- Used by: Browser; dev server proxies `/api` per `apps/web/vite.config.ts`.

**Application API (server):**
- Purpose: Authoritative runtime for sessions, persistence, and integrations.
- Location: `apps/api/src/`
- Contains: `createApiServer`, route modules (`*Routes.ts`), `terminalRuntime`, `monitor`, usage/github scanners, prompt resolution.
- Depends on: `@octogent/core`, `node:http`, `ws`, `node-pty`, Node `fs`/`child_process`.
- Used by: `octogent` CLI (`bin/octogent` → bundled `apps/api/src/cli.ts`), dev `apps/api/src/server.ts`.

**Domain (core):**
- Purpose: Shared vocabulary and pure logic (e.g. terminal list projection, coercion helpers).
- Location: `packages/core/src/domain/`, `packages/core/src/application/`, `packages/core/src/ports/`.
- Contains: Types and small pure functions; `InMemoryTerminalSnapshotReader` adapter.
- Depends on: TypeScript standard library only.
- Used by: `apps/api` and `apps/web` via package exports in `packages/core/src/index.ts`.

**Infrastructure state:**
- Purpose: Durable tentacle registry, transcripts, prompts mirror, logs, monitor config.
- Location: Resolved `projectStateDir` (often `<workspaceCwd>/.octogent` or global dirs from CLI persistence—see `apps/api/src/projectPersistence.ts` references from `apps/api/src/cli.ts`).
- Depends on: Local filesystem layouts documented in repo docs (`docs/reference/filesystem-layout.md`).
- Used by: `createTerminalRuntime` and related persistence modules (`apps/api/src/terminalRuntime/registry.ts`, etc.).

## Data Flow

### Primary HTTP request path

1. **Listen** — `createServer(requestHandler)` and `listen` in `apps/api/src/createApiServer.ts` (`start`, lines ~148–160).
2. **Dispatch** — Incoming request hits closure from `createApiRequestHandler` in `apps/api/src/createApiServer/requestHandler.ts` (~240+); `/api/<segment>/...` routed via `API_ROUTE_MAP` and `extractRoutePrefix` (~159–164).
3. **JSON / side effects** — Handlers invoke `TerminalRuntime` and services (see `routeDependencies` wiring ~221–237); responses written with `writeJson` / helpers from `apps/api/src/createApiServer/routeHelpers.ts`.

### WebSocket upgrade path

1. **Upgrade event** — `server.on("upgrade", createUpgradeHandler(...))` in `apps/api/src/createApiServer.ts` (~140–146).
2. **Security** — `apps/api/src/createApiServer/upgradeHandler.ts` validates `Host` and `Origin` (~17–27).
3. **Multiplex** — `handleUpgrade` in `apps/api/src/terminalRuntime.ts` (~760–778) directs `/api/terminal-events/ws` vs per-terminal paths into `terminalEventsWebsocketServer` or `sessionRuntime.handleUpgrade`.

### Web UI snapshot refresh path

1. **Bootstrap** — `apps/web/src/main.tsx` mounts `App` (~13–17).
2. **Load snapshots** — `App` uses `HttpTerminalSnapshotReader` and URLs from `buildTerminalSnapshotsUrl` in `apps/web/src/App.tsx` (~34–38) sourcing `apps/web/src/runtime/runtimeEndpoints.ts`.
3. **Mutations** — Hooks such as `apps/web/src/app/hooks/useTerminalMutations.ts` call `fetch` on `/api/terminals` or absolute URLs when `VITE_OCTOGENT_API_ORIGIN` is set.

### Development vs production coupling

**Dev:** Vite proxies `/api` (and WS) to `OCTOGENT_API_ORIGIN` defaulting to `http://127.0.0.1:8787` (`apps/web/vite.config.ts` ~4–14). Web often uses relative `/api/...` when `VITE_OCTOGENT_API_ORIGIN` is unset (`apps/web/src/runtime/runtimeEndpoints.ts` ~3–11, ~47–52).

**Packaged / single-port:** API can serve built static assets when `webDistDir` / `OCTOGENT_WEB_DIST_DIR` resolves (`apps/api/src/createApiServer/requestHandler.ts` static branch ~171–197, ~219+).

**State Management:**
- **Server:** In-memory `Map` of sessions in `createTerminalRuntime` (`apps/api/src/terminalRuntime.ts` ~68–76) plus persisted registry scheduled via `createTerminalRegistryPersistence` (~95–101).
- **Client:** React state in `App` and hooks; persisted layout via `usePersistedUiState` calling `/api/ui-state` (`apps/web/src/app/hooks/usePersistedUiState.ts` per grep usage).

## Key Abstractions

**`TerminalRuntime`:**
- Purpose: Single facade for terminals, WebSockets, deck/todos, git, conversations.
- Examples: `apps/api/src/terminalRuntime.ts`, `apps/api/src/terminalRuntime/sessionRuntime.ts`
- Pattern: Factory `createTerminalRuntime` returning methods consumed by routes.

**`TerminalSnapshot` / list projection:**
- Purpose: Stable shape the UI consumes; built via core helpers.
- Examples: `packages/core/src/domain/terminal.ts`, `packages/core/src/application/buildTerminalList.ts`
- Pattern: Core types + pure `buildTerminalList`; API fills snapshots from live sessions.

**`TerminalSnapshotReader` port:**
- Purpose: Abstract reading snapshots for UI-driven flows.
- Examples: `packages/core/src/ports/TerminalSnapshotReader.ts`, `packages/core/src/adapters/InMemoryTerminalSnapshotReader.ts`, `apps/web/src/runtime/HttpTerminalSnapshotReader.ts`
- Pattern: Core defines interface; web implements HTTP adapter.

## Entry Points

**Long-running API (dev / direct):**
- Location: `apps/api/src/server.ts`
- Triggers: `pnpm --filter @octogent/api dev` (`apps/api/package.json`) or Node running this file.
- Responsibilities: Env validation, `createApiServer(...).start(port, host)`.

**CLI / published binary:**
- Location: `bin/octogent` importing `dist/api/cli.js`; source `apps/api/src/cli.ts`.
- Triggers: User runs `octogent` after build.
- Responsibilities: Project initialization, prerequisites, spawning or embedding API + opening UI per CLI logic (~138+ ports).

**Web SPA:**
- Location: `apps/web/src/main.tsx`
- Triggers: Vite dev or static `index.html` from web build.
- Responsibilities: Mount React `App`.

**Monorepo dev orchestrator:**
- Location: `scripts/dev.mjs`
- Triggers: `pnpm dev` from root `package.json`.
- Responsibilities: Pick API port, set `OCTOGENT_API_ORIGIN`, run API and Vite concurrently (see ~73+).

## Architectural Constraints

- **Threading:** Single-threaded Node event loop; PTY I/O asynchronous; no worker pool required for core path.
- **Global state:** `TerminalRuntime` holds module-level closures over session maps (`apps/api/src/terminalRuntime.ts` ~68–76); one runtime instance per API server in `apps/api/src/createApiServer.ts` (~105–106).
- **Circular imports:** Not systematically mapped; prefer adding new routes as separate modules under `apps/api/src/createApiServer/` and importing into `requestHandler.ts` map.
- **Security boundary:** Host/origin checks on HTTP and WS (`apps/api/src/createApiServer/security.ts` used by `requestHandler.ts` and `upgradeHandler.ts`); `allowRemoteAccess` relaxes constraints when explicitly enabled (`apps/api/src/server.ts` ~18).

## Anti-Patterns

### Embedding PTY or filesystem orchestration in `packages/core`

**What happens:** New server-only helpers added under `packages/core/src/` coupling domain to I/O.
**Why it's wrong:** Violates `packages/core/AGENTS.md` and forces web bundle or test environments to depend on Node-only behavior.
**Do this instead:** Keep interfaces in `packages/core/src/ports/` and implement in `apps/api/src/`.

### Duplicating business rules in React instead of calling the API

**What happens:** Components reimplement tentacle lifecycle or transcript rules.
**Why it's wrong:** `apps/web/AGENTS.md` reserves orchestration for the API; drift breaks multi-client consistency.
**Do this instead:** Add or extend `/api` handlers and keep UI as a thin client (pattern in `apps/web/src/app/hooks/*.ts`).

### Bypassing `/api` URL builders for mixed deployments

**What happens:** Hard-coded `http://127.0.0.1:8787` scattered in components.
**Why it's wrong:** Breaks Vite proxy mode and packaged single-origin serving.
**Do this instead:** Use `apps/web/src/runtime/runtimeEndpoints.ts` helpers or env-driven origins consistently.

## Error Handling

**Strategy:** Prefer explicit HTTP status codes in route helpers; runtime throws like `RuntimeInputError` surfaced as JSON errors from terminal routes; upgrade failures destroy sockets (`apps/api/src/createApiServer/upgradeHandler.ts` ~31–36).

**Patterns:**
- Route-level `try`/`catch` with `logRequest` in `apps/api/src/createApiServer/requestHandler.ts`.
- CLI startup validation `validateStartupEnv` in `apps/api/src/server.ts` (~25–47) exits process on fatal misconfiguration.

## Cross-Cutting Concerns

**Logging:** `apps/api/src/logging.ts` (`logVerbose` used in `requestHandler.ts` ~167+).

**Validation:** Header and path parsing at route handlers; core `asNumber` / `asString` helpers (`packages/core/src/util/typeCoercion.ts`) used in usage modules (`apps/api/src/claudeUsage.ts`, `apps/api/src/codexUsage.ts`).

**Authentication:** Local-first operator tool; enforcement is Host/Origin/network posture, not OAuth in-repo (see security modules above).

---

*Architecture analysis: 2026-05-09*
