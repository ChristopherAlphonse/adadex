# Roadmap: Adadex

## Overview

Adadex is a terminal-inspired orchestration cockpit for managing multiple AI coding agents. This roadmap covers the implementation of the design language defined in `apps/design.md` — migrating from the existing Octogent-vintage visual system to a refined, high-fidelity terminal-inspired UI.

## Phases

- [ ] **Phase 0: Enterprise Agent Mascot Glyph System** — Replace the cartoon octopus mascot with a premium `AgentGlyph` identity system for AI coding agents, preserving canvas rendering, animation, graph-scale support, and backwards-compatible exports
- [ ] **Phase 1: Design System Foundation** — oklch color tokens, typography, surface layers, spacing/radius, motion system, bg-grid/scanline pattern
- [ ] **Phase 2: Core UI Components** — Navigation header, toolbar, status pills, inspector panel, primary CTA
- [ ] **Phase 3: Agent Graph & Canvas** — Agent node graph with d3-force, edge connections, lead node glow, selection behavior
- [ ] **Phase 4: Terminal Columns & Interaction** — Terminal component styling, multi-column layout, scroll management, replay
- [ ] **Phase 5: API-Backed Agent Console** — API-backed agent orchestration console with provider switching, agent graph, inspector, usage meters, mesh footer, and removal of static mock data

## Phase Details

### Phase 0: Enterprise Agent Mascot Glyph System
**Goal**: Replace the current cartoon-style octopus mascot with a premium, enterprise-ready `AgentGlyph` system that gives each AI coding agent recognizable identity without making customization feel like dress-up. The new glyph keeps canvas rendering, high-DPI sharpness, subtle animation, `graphScale`, color customization, and compatibility exports while replacing hair/expression concepts with professional identity traits: variant, mood, accessory, density, accent color, and stable identity seed.
**Depends on**: Nothing (highest priority)
**Requirements**: [REQ-15, REQ-16, REQ-17, REQ-10, REQ-11]
**Success Criteria** (what must be TRUE):
  1. `AgentGlyph` is the primary exported component with typed API for `animation`, `mood`, `variant`, `accessory`, `density`, `accentColor`, `secondaryColor`, `bodyColor`, `size`, `scale`, `speedMs`, `className`, `testId`, `graphScale`, and `identitySeed`
  2. Compatibility exports `OrchestratorGlyph`, `OctopusGlyph`, `MascotGlyph`, and `MascotSprite` route to the new implementation without breaking existing callers
  3. Legacy props and values map through a deprecated compatibility adapter: `sway/float -> breathe`, `walk/jog -> pulse`, `swim-up -> orbit`, `happy -> confident`, `sleepy -> offline`, `angry -> alert`, `surprised -> curious`, and legacy accessories map to professional ornaments
  4. The new primary drawing implementation contains no hair/cartoon-style rendering logic and does not expose new `hairColor`, `long`, `mohawk`, `side-sweep`, `curly`, `afro`, `happy`, `sleepy`, `angry`, `surprised`, `walk`, `jog`, or `swim-up` concepts
  5. The canvas glyph renders a polished abstract cephalopod/orchestrator mark with central body, subtle side sensors, connector arms, endpoint nodes, optional orbit/node-ring/details, restrained shadow, and minimal sensor expression
  6. Variants `codex`, `opencode`, `reviewer`, `planner`, `builder`, `debugger`, `security`, and `custom` create subtle recognizable identity differences
  7. Moods `neutral`, `focused`, `confident`, `curious`, `alert`, and `offline` affect posture, sensors, opacity, and accent intensity without cartoon faces
  8. Accessories `none`, `visor`, `halo`, `terminal`, `node-ring`, `crown`, and `shield` render as product-state ornaments, not costume pieces
  9. Density modes `minimal`, `standard`, and `detailed` control visual complexity for sidebar icons, default UI, and hero/empty-state uses
  10. Animations `idle`, `breathe`, `pulse`, `orbit`, `typing`, `thinking`, and `deploying` are subtle, use `requestAnimationFrame` where practical, and render a static idle frame when reduced motion is enabled
  11. High-DPI rendering uses backing canvas sizing separate from CSS size and clamps `window.devicePixelRatio * graphScale` to the existing maximum of 4
  12. `identitySeed` deterministically controls only small polished differences such as arm curvature, node placement, diagnostic dot count, accessory offset, and accent intensity
  13. Tests cover the new public API, legacy compatibility mappings, reduced-motion behavior, high-DPI canvas sizing, and deterministic seeded identity
  14. Build and relevant web tests pass after the migration
**Plans**: 2 plans

Plans:
- [ ] 00-01-PLAN.md — AgentGlyph Core Rendering System: API, palette, identity seed, drawing helpers, high-DPI canvas, reduced motion (Wave 1)
- [ ] 00-02-PLAN.md — Compatibility & UI Integration: legacy prop adapter, exports, existing mascot call sites, tests, visual states (Wave 2, depends on 00-01)

### Phase 1: Design System Foundation
**Goal**: The app uses oklch semantic design tokens throughout its CSS (tailwind.css), with Inter/JetBrains Mono typography, three-layer surface system, status color semantics, pulse-ring animation, and bg-grid/scanline patterns on the canvas. Legacy CSS tokens are aliased behind semantic tokens.
**Depends on**: Nothing (first phase)
**Requirements**: [REQ-01, REQ-02, REQ-03, REQ-04, REQ-10, REQ-12, REQ-14]
**Success Criteria** (what must be TRUE):
  1. `tailwind.css` defines all color tokens using `oklch()` values (not hex)
  2. Typography uses Inter (sans) and JetBrains Mono (mono) imported via Google Fonts
  3. Three surface layers exist in CSS: `--background`, `--surface`, `--surface-2`
  4. Semantic status tokens (`--running`, `--stopped`, `--stale`, `--idle`) are defined as oklch values
  5. `.bg-grid` radial-dot pattern and `.scanline` overlay are applied to workspace canvas
  6. `.animate-pulse-ring` keyframes exist and work on lead node
  7. Translucency uses `oklch(from var(--token) l c h / alpha)` pattern
  8. Radius `--radius: 0.5rem` is defined, borders are 1px low-chroma
  9. Glows restricted: `box-shadow: 0 0 30px oklch(from var(--running) l c h / 0.35)`
  10. Build and tests pass after all changes
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md — Design Token Migration: oklch colors, typography, surfaces, spacing/radius (Wave 1)
- [ ] 01-02-PLAN.md — Visual Effects & Motion: status tokens, bg-grid/scanline, pulse-ring, glows (Wave 2, depends on 01-01)

### Phase 2: Core UI Components
**Goal**: All major chrome components (navigation header, toolbar, status pills, inspector panel) implement the exact spec from `apps/design.md`. Navigation uses 1px underline active state, toolbar uses brand/10 toggles, status pills are border+tint+dot, inspector is 360px right-anchored.
**Depends on**: Phase 1
**Requirements**: [REQ-05, REQ-06, REQ-07, REQ-08, REQ-11, REQ-12]
**Success Criteria** (what must be TRUE):
  1. Navigation header renders with brand → breadcrumb → tab nav → search → meters → avatar
  2. Active tab shows 1px underline in `--foreground`, not a filled pill
  3. Toolbar buttons at 12.5px with icon+label, toggle uses `bg-brand/10 text-brand`
  4. Primary CTA is a single `bg-foreground text-background` button
  5. Status pills render with border + 12% tint + 1.5px dot, colored by status token
  6. Inspector panel is 360px wide, right-anchored, with Section blocks and mono key/value rows
  7. Destructive actions use `text-destructive` with `hover:bg-destructive/10` (no filled red)
**Plans**: 2 plans

Plans:
- [ ] 02-01: Navigation Header & Toolbar — Vercel-style nav, Linear-style toolbar, primary CTA
- [ ] 02-02: Status Pills & Inspector Panel — Status pills, right-anchored 360px inspector, Section blocks

### Phase 3: Agent Graph & Canvas
**Goal**: The agent graph visualization uses SVG nodes positioned in percentages with d3-force layout. Lead node is larger with animate-pulse-ring glow. Edges are 1px oklch(1 0 0 / 0.12), stale edges dash. Selection scales 1.10 with status glow.
**Depends on**: Phase 2
**Requirements**: [REQ-09, REQ-10, REQ-14]
**Success Criteria** (what must be TRUE):
   1. Lead node is larger than child nodes and has animate-pulse-ring glow
   2. Edges are 1px `oklch(1 0 0 / 0.12)`; stale edges use dashed stroke
   3. Selection transforms node to scale(1.10) and adds status-colored glow
   4. Nodes are SVG-positioned in percentages (fluid graph, not pixel-absolute)
   5. Glow uses `box-shadow: 0 0 30px oklch(from var(--running) l c h / 0.35)` on live nodes
   6. Motion on canvas nodes uses `transition-all` with ease-out timing
**Plans**: 2 plans

Plans:
**Wave 1**
- [ ] 03-01-PLAN.md — AgentGlyph Core Rendering: modular folder-based AgentGlyph component with drawing functions, types, identity seed, animation, backward-compatibility adapter, tests, re-export alias (Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 03-02-PLAN.md — Consumer Migration & Graph Integration: migrate 8 consumer sites, redesign AddOrchestrationForm, add graph CSS (lead/child edges/selection/glows), update adapter tests (Wave 2, depends on 03-01)

### Phase 4: Terminal Columns & Interaction
**Goal**: Terminal columns render with the new design system styling. Multi-column layout works responsively. Scroll management (replay, scrollback trimming) follows the design spec's density and typography rules.
**Depends on**: Phase 3
**Requirements**: [REQ-13, REQ-11]
**Success Criteria** (what must be TRUE):
  1. Terminal columns use the design system tokens for background, borders, and typography
  2. Multi-column layout renders without overflow or clipping
  3. Terminal scroll positions are preserved during replay
  4. Log timestamps use `HH:MM:SS` format with mono font
  5. Legacy CSS selectors from terminal-and-status.css are migrated to Tailwind where touched
**Plans**: 2 plans

Plans:
- [ ] 04-01: Terminal Column Styling — Design system integration, multi-column layout
- [ ] 04-02: Scroll Management & Log Display — Replay, scrollback, timestamp format, log levels

### Phase 5: API-Backed Agent Console
**Goal**: An API-backed agent orchestration console UI that replaces mock data with live data from 5 new API routes. Console includes: provider selector (Codex/OpenCode), agent graph canvas with nodes and edges from API, inspector panel with metadata/resources/diff summary from API, usage meters, toolbar actions (refresh, hide idle, new agent), and simplified mesh-status footer. Stream Logs section and static mock data arrays are removed.
**Depends on**: None (infrastructure phase — routing patterns from existing codebase)
**Requirements**: []
**Success Criteria** (what must be TRUE):
  1. `GET /api/providers`, `GET /api/console/state`, `GET /api/agents/:id`, `POST /api/preferences/provider`, `POST /api/console/refresh` all registered in `API_ROUTE_MAP` with URL builders
  2. AgentConsole appears as a selectable view at nav index 5 alongside existing views
  3. Agent graph renders nodes and edges from `GET /api/console/state` response
  4. Inspector shows metadata (7 fields), resources (CPU/memory/tokens), and diff summary (files, additions, deletions, staged) from `GET /api/agents/:id`
  5. Footer shows mesh status, latency, region, and agent count from API data
  6. Provider dropdown switches between Codex and OpenCode, triggers refetch of all data
  7. "Hide Idle" toggle filters idle agents from graph display
  8. Loading states, error states, empty states each display the correct message (D-33, D-34, D-35, D-36)
  9. Error boundary catches render crashes without breaking the rest of the app
 10. No static AGENTS/LOGS arrays used in production console code
 11. Tests exist for all console states (loading, error, empty, data, provider switch, hide idle)
**Plans**: 4 plans

Plans:
- [ ] 05-01-PLAN.md — Console API Routes: 5 endpoint handlers in consoleRoutes.ts, URL builders, route registration (Wave 1)
- [ ] 05-02-PLAN.md — AgentConsole UI Shell: component, CSS, nav slot at index 5, provider dropdown, static cleanup (Wave 2)
- [ ] 05-03-PLAN.md — Wire AgentConsole to API Data: graph nodes/edges, inspector sections, usage meters, mesh footer (Wave 2)
- [ ] 05-04-PLAN.md — Loading States, Error Handling, Empty States, Tests (Wave 3)

## Progress

**Execution Order:** Phases execute in numeric order: 0 → 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Enterprise Agent Mascot Glyph System | 0/2 | Not started | - |
| 1. Design System Foundation | 0/2 | Not started | - |
| 2. Core UI Components | 0/2 | Not started | - |
| 3. Agent Graph & Canvas | 0/2 | Not started | - |
| 4. Terminal Columns & Interaction | 0/2 | Not started | - |
| 5. API-Backed Agent Console | 4/4 | Planned | - |
