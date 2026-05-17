# Phase 05: API-Backed Agent Console - Context

**Gathered:** 2026-05-16
**Status:** Ready for planning
**Source:** PRD Express Path (inline)

<domain>
## Phase Boundary

Build an API-backed agent orchestration console UI that replaces mock data with live data from API routes. The console includes: provider selector (Codex/OpenCode), agent graph canvas, inspector panel with metadata/resources/diff summary, usage meters, toolbar actions, and a simplified footer showing only operational mesh status. Stream Logs section and static mock data arrays are removed.
</domain>

<decisions>
## Implementation Decisions

### Provider Selector
- D-01: The top bar must replace the "production" label with a dropdown supporting Codex and OpenCode providers
- D-02: Selected provider preference persists via `POST /api/preferences/provider`; default to `Codex` if none saved
- D-03: Changing the provider triggers immediate refetch of agent data, usage meters, graph state, inspector data, and mesh status
- D-04: The provider dropdown must be keyboard-accessible and visually clear which is selected

### API Routes
- D-05: `GET /api/providers` returns available providers with status (`available`, `unavailable`, `degraded`)
- D-06: `GET /api/console/state?provider=codex` returns all console state: provider info, mesh status, usage, agent list (with graph positions, tokens, resources, status), and edges
- D-07: `GET /api/agents/:agentId?provider=codex` returns detailed agent data: resources, tokens, diff summary with file-level additions/deletions/staged status
- D-08: `POST /api/preferences/provider` stores user's provider preference (`{ "provider": "opencode" }`)
- D-09: `POST /api/console/refresh` triggers backend refresh of agent state for a given provider

### Agent Graph
- D-10: Agent nodes must render from `GET /api/console/state` response (agents array + edges array) — NOT from static `AGENTS` array
- D-11: Each agent node includes: id, name, status, graph position, isLead flag
- D-12: Relationship edges between agents come from the API
- D-13: Current graph visual behavior preserved: click selects, selected agent scales, lead agent larger, stale agents may use dashed edges, status colors consistent

### Agent Inspector
- D-14: Inspector shows details for the selected agent fetched from `GET /api/agents/:agentId`
- D-15: Inspector sections: Metadata (id, name, status, branch, worktree, commit, uptime), Resources (CPU%, memory usage, tokens), Diff Summary (files changed, staged, per-file additions/deletions/staged)

### Static Data Removal
- D-16: Static `AGENTS` array must NOT be used in the console component — data comes from API
- D-17: Static `LOGS` array must be deleted entirely from the codebase
- D-18: `Stream Logs` section must be removed from the inspector panel
- D-19: Hardcoded "production" label replaced with dynamic provider dropdown

### Footer Cleanup
- D-20: Footer must display operational mesh status on the left side: mesh connection status, latency, region, visible agent count / total agent count
- D-21: Footer must NOT display: `UTF-8`, line/column (`Ln 104, Col 32`), version text (`v0.8.2`), or any editor-style metadata on the right side

### Resource Meters
- D-22: Resource section must show API-backed metrics: CPU percentage, memory usage (with limit), token usage (with limit)
- D-23: If a metric is unavailable, display `Unavailable` or `—` — do NOT fake resource percentages
- D-24: Usage meters (provider usage %, weekly usage %) render from API data, not hardcoded values

### Diff Summary
- D-25: Diff Summary is API-backed from `GET /api/agents/:agentId`
- D-26: Minimum fields per file: path, additions, deletions, staged status
- D-27: Summary counts: total files changed, total files staged

### Toolbar
- D-28: `Hide Idle` works client-side or via query parameter
- D-29: `Refresh` refetches all API data
- D-30: `New agent` triggers new-agent flow (may open placeholder modal in first version)
- D-31: `Delete all` button hidden or disabled if backend deletion is not implemented

### State & Error Handling
- D-32: UI must NOT block rendering while waiting for all data (non-blocking fetch pattern)
- D-33: No agents returned → display: "No agents found for this provider."
- D-34: Selected provider unavailable → display: "Provider unavailable. Try another provider or refresh."
- D-35: Agent detail fails to load → display: "Unable to load agent details."
- D-36: API errors must NOT crash the console
- D-37: All API routes return typed JSON
- D-38: Mock data may only be used in tests or isolated storybook-style development

### Console View Architecture
- D-39: The agent console view is added as a new primary view in the existing navigation tab system (index 5), coexisting with existing views (Deck, Activity, Canvas, etc.)
- D-40: Console state shape: `{ provider, selectedAgentId, hideIdle, isLoading, error }`

### OpenCode's Discretion
- State management approach for the console view (React state vs useReducer vs external store)
- Specific implementation details for provider dropdown UI (select element vs custom dropdown vs button group)
- Data fetching library choice (native fetch vs lightweight wrapper)
- Console view component structure (single file vs split into sub-components)
- Error boundary placement (component-level vs route-level)
- Persistence mechanism for provider preference (localStorage vs cookie vs API-only)
- CSS approach for new console components (Tailwind utility classes vs CSS modules)
- Whether the AgentConsole replaces CanvasPrimaryView or coexists — D-39 establishes coexistence as the baseline

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### API Route Patterns
- `apps/api/src/createApiServer/requestHandler.ts` — Central HTTP dispatcher, API_ROUTE_MAP registration, handler dispatch pattern
- `apps/api/src/createApiServer/routeHelpers.ts` — Route handler types (`ApiRouteHandler`, `RouteHandlerContext`, `RouteHandlerDependencies`), response helpers (`writeJson`, `writeNoContent`, `writeMethodNotAllowed`)
- `apps/api/src/createApiServer/usageRoutes.ts` — Example route handler module pattern (simple GET handlers returning typed JSON)
- `apps/api/src/createApiServer/requestParsers.ts` — JSON body reading utilities

### Frontend Patterns
- `apps/web/src/runtime/runtimeEndpoints.ts` — URL builder functions for all API endpoints (pattern for adding console endpoint builders)
- `apps/web/src/App.tsx` — Main application shell, component composition, data fetching orchestration pattern
- `apps/web/src/components/CanvasPrimaryView.tsx` — Current graph view (graph rendering, selection, panels)
- `apps/web/src/components/PrimaryViewRouter.tsx` — Primary view routing based on activePrimaryNav index
- `apps/web/src/components/ConsolePrimaryNav.tsx` — Navigation component (pattern for top-bar provider dropdown placement)
- `apps/web/src/app/constants.ts` — Nav items, key hints, shared constants
- `apps/web/src/app/hooks/usePollingData.ts` — Polling data hook pattern
- `apps/web/src/app/hooks/useCodexUsagePolling.ts` — Existing usage polling pattern
- `apps/web/src/components/RuntimeStatusStrip.tsx` — Existing usage meter rendering (provider usage, weekly usage)

### Architecture & Conventions
- `apps/api/AGENTS.md` — API layer boundaries and patterns
- `apps/web/AGENTS.md` — UI layer conventions
- `packages/core/AGENTS.md` — Domain layer contracts
- `.planning/codebase/ARCHITECTURE.md` — System architecture
- `.planning/codebase/CONVENTIONS.md` — Coding conventions
- `.planning/codebase/CONCERNS.md` — Known issues and fragile areas

### Data Models (from PRD)
- Provider type: `{ id: "codex" | "opencode", name: string, status: "available" | "unavailable" | "degraded" }`
- Agent type: `{ id, name, status, branch, worktree, commit, uptime, isLead, position: {x, y}, tokens: {used, limit, display}, resources: {cpuPercent, memoryUsedMb, memoryLimitMb, memoryDisplay} }`
- DiffSummary type: `{ filesChanged, filesStaged, files: [{path, additions, deletions, staged}] }`
- ConsoleState type: `{ provider, live, region, mesh: {status, latencyMs}, usage: {providerLabel, providerUsagePercent, weeklyUsagePercent}, agents: Agent[], edges: [{from, to, style}] }`

</canonical_refs>

<specifics>
## Specific Ideas

### API Response Shapes (from PRD)

GET /api/providers:
```json
{ "providers": [{ "id": "codex", "name": "Codex", "status": "available" }, { "id": "opencode", "name": "OpenCode", "status": "available" }], "defaultProvider": "codex" }
```

GET /api/console/state?provider=codex:
```json
{ "provider": "codex", "live": true, "region": "us-east-1", "mesh": { "status": "connected", "latencyMs": 12 }, "usage": { "providerLabel": "Codex", "providerUsagePercent": 30, "weeklyUsagePercent": 7 }, "agents": [{ "id": "deck-lead", "name": "Deck Lead", "status": "running", "branch": "main", "worktree": "~/dev/adadex/core", "commit": "a7f29d1", "tokens": { "used": 142400, "limit": 500000, "display": "142.4k / 500k" }, "resources": { "cpuPercent": 42, "memoryUsedMb": 1843, "memoryLimitMb": 4096, "memoryDisplay": "1.8 GB / 4.0 GB" }, "uptime": "14h 22m", "position": { "x": 50, "y": 50 }, "isLead": true }], "edges": [{ "from": "deck-lead", "to": "t1", "style": "solid" }, { "from": "deck-lead", "to": "t6", "style": "dashed" }] }
```

GET /api/agents/:agentId?provider=codex:
```json
{ "id": "deck-lead", "name": "Deck Lead", "status": "running", "branch": "main", "worktree": "~/dev/adadex/core", "commit": "a7f29d1", "uptime": "14h 22m", "resources": { "cpuPercent": 42, "memoryUsedMb": 1843, "memoryLimitMb": 4096, "memoryDisplay": "1.8 GB / 4.0 GB" }, "tokens": { "used": 142400, "limit": 500000, "display": "142.4k / 500k" }, "diffSummary": { "filesChanged": 4, "filesStaged": 2, "files": [{ "path": "core/engine.ts", "additions": 142, "deletions": 0, "staged": true }, { "path": "utils/compat.ts", "additions": 0, "deletions": 28, "staged": false }] } }
```

### Console View State Shape
```ts
interface ConsoleViewState {
  provider: "codex" | "opencode";
  selectedAgentId: string | null;
  hideIdle: boolean;
  isLoading: boolean;
  error: string | null;
}
```

### Top Bar Rendering
`Adadex / [Provider Dropdown] / Live` where provider dropdown is a keyboard-accessible select showing Codex or OpenCode. Example: `Adadex / Codex ▼ / Live` or `Adadex / OpenCode ▼ / Live`

### Footer Format (recommended)
`● Mesh connected · 12ms · us-east-1 · 4 of 4 agents`

</specifics>

<deferred>
## Deferred Ideas

Items explicitly out of scope per PRD Section 12 (Out of Scope):
- Full terminal streaming
- Raw log streaming
- Multi-user permissions
- Billing
- Full deployment workflow
- Deep Git operations
- Authentication and authorization
- Agent creation wizard beyond a placeholder action
- Full settings page
- Network usage, tool calls, runtime cost, queue depth (optional future metrics)

</deferred>

---

*Phase: 05-api-backed-console*
*Context gathered: 2026-05-16 via PRD Express Path*
