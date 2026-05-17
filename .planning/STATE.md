# Project State

## Current Phase

**Active:** Phase 5 — API-Backed Agent Console
**Status:** Planned (4 plans ready for execution)

## Phases

| Phase | Status | Plans | Last Activity |
|-------|--------|-------|--------------|
| 1. Design System Foundation | Planned | 2 | 2026-05-16 |
| 2. Core UI Components | Not started | 2 | - |
| 3. Agent Graph & Canvas | Not started | 2 | - |
| 4. Terminal Columns & Interaction | Not started | 2 | - |
| 5. API-Backed Agent Console | Planned | 4 | 2026-05-16 |

## Decisions

### D-01: oklch Color Migration
All color values in `tailwind.css` (`@theme inline {}`) will use `oklch()` functional notation. Existing foundation.css variables will be aliased behind the new oklch tokens where they are consumed by legacy CSS, then incrementally replaced when legacy sheets are migrated.

### D-02: Font Loading
Inter and JetBrains Mono will be loaded via Google Fonts `@import` in `src/styles.css`, replacing the current "PP Neue Machina Plain" primary font. The `--font-sans` and `--font-mono` Tailwind theme values will point to the new font stacks.

### D-03: Incremental Migration
Legacy CSS files under `src/styles/*.css` (except `tailwind.css` and `tailwind-components.css`) will not be rewritten in a single pass. Changes to each will happen when the corresponding view is touched in later phases. Phase 1 focuses on the token/theme layer only.

### D-04: Tailwind-first Approach
New component styles should use Tailwind utility classes in TSX via `cn()` from `@/lib/utils` and `cva()` variants. Phase 1 establishes the token system that makes this possible.

## Backlog

- Migrate legacy CSS files incrementally as each view is touched during Phases 2-4
- Add E2E tests (Playwright) for visual regression after design system is stable
- Add component-level tests for new UI primitives in Phase 2

### Phase 5 Decisions (from CONTEXT.md)
- D-01 through D-04: Provider selector — dropdown replaces "production" label, persists via POST /api/preferences/provider, triggers refetch, keyboard-accessible
- D-05 through D-09: API routes — 5 endpoints: providers list, console state, agent detail, preferences, refresh
- D-10 through D-13: Agent graph — nodes from API, edges from API, click selects, lead/stale visual behavior preserved
- D-14 through D-15: Inspector — sections (metadata, resources, diff summary) all API-backed
- D-16 through D-19: Static data removal — no AGENTS/LOGS arrays, no Stream Logs, dynamic provider label
- D-20 through D-21: Footer — mesh status only, no UTF-8/Ln/Col/version
- D-22 through D-24: Resource meters — API-backed, unavailable → display "Unavailable" or "—"
- D-25 through D-27: Diff Summary — API-backed with per-file additions/deletions/staged
- D-28 through D-31: Toolbar — hide idle, refresh, new agent placeholder, no delete all
- D-32 through D-38: Error handling — non-blocking fetch, empty/error/unavailable states, error boundary, mock data only in tests
- D-39: Console is nav index 5, coexisting with existing views
- D-40: Console state shape: { provider, selectedAgentId, hideIdle, isLoading, error }

## Notes

- Design spec source: `apps/design.md`
- Codebase analysis: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/CONVENTIONS.md`
- Concerns: `.planning/codebase/CONCERNS.md`
- Current CSS tokens in `src/styles/foundation.css` use hex colors and Octogent-era naming
