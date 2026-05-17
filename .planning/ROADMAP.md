# Roadmap: Adadex

## Overview

Adadex is a terminal-inspired orchestration cockpit for managing multiple AI coding agents. This roadmap covers the implementation of the design language defined in `apps/design.md` — migrating from the existing Octogent-vintage visual system to a refined, high-fidelity terminal-inspired UI.

## Phases

- [ ] **Phase 1: Design System Foundation** — oklch color tokens, typography, surface layers, spacing/radius, motion system, bg-grid/scanline pattern
- [ ] **Phase 2: Core UI Components** — Navigation header, toolbar, status pills, inspector panel, primary CTA
- [ ] **Phase 3: Agent Graph & Canvas** — Agent node graph with d3-force, edge connections, lead node glow, selection behavior
- [ ] **Phase 4: Terminal Columns & Interaction** — Terminal component styling, multi-column layout, scroll management, replay

## Phase Details

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
- [ ] 03-01: Graph Engine & Node Rendering — d3-force layout, SVG node rendering, lead/child distinction
- [ ] 03-02: Edge Connections & Interaction — Edge rendering, selection behavior, stale/dashed edges, fluid positioning

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

## Progress

**Execution Order:** Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Design System Foundation | 0/2 | Not started | - |
| 2. Core UI Components | 0/2 | Not started | - |
| 3. Agent Graph & Canvas | 0/2 | Not started | - |
| 4. Terminal Columns & Interaction | 0/2 | Not started | - |
