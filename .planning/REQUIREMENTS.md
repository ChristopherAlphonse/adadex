# Requirements: Adadex

## Overview

Design system and UI requirements for the Adadex terminal-inspired orchestration cockpit.

## Requirements

### REQ-01: oklch Color Tokens
Replace hex color values with oklch semantic tokens as defined in `apps/design.md`. All color lives in `src/styles/tailwind.css` as oklch tokens. Components never use raw color classes (`text-white`, `bg-black`); they consume semantic tokens.

### REQ-02: Typography System
Implement Inter (400/500/600/700) as sans-serif and JetBrains Mono (400/500/600) as monospace. Establish a tight pixel-precise scale: section eyebrow at 10px/600, toolbar/body micro at 12-12.5px/500, nav/default body at 13px/500, inspector title/H2 at 15-16px/600.

### REQ-03: Three-Layer Surface System
Implement three vertical layers (background → surface → surface-2) with bg-grid radial-dot pattern and scanline overlay on the workspace canvas only. Depth comes from layering surfaces, not heavy shadows.

### REQ-04: Status Color Semantics
Define semantic status tokens (`--running`, `--stopped`, `--stale`, `--idle`, `--destructive`) as oklch values. Status colors are semantic — never reuse `--running` for a non-status affordance. Translucency uses `oklch(from var(--token) l c h / alpha)`.

### REQ-05: Navigation Header
Vercel-style header: brand → breadcrumb → centered tab nav → search → meters → avatar. Active tab uses 1px underline in `--foreground`, never a filled pill. Keyboard hints (`kbd`) sit beside labels at xl+.

### REQ-06: Toolbar Component
Linear-style icon+label buttons at 12.5px. Toggle state uses `bg-brand/10 text-brand`. Destructive actions use `text-destructive` and `hover:bg-destructive/10`. Primary CTA is a single black-on-white button (`bg-foreground text-background`).

### REQ-07: Status Pills
Border + 12% tint + solid 1.5px dot. Color comes entirely from the status token, so adding a new status only requires a new CSS variable.

### REQ-08: Inspector Panel
Right-anchored 360px panel on `--surface/40`. Content grouped into `Section` blocks with uppercase eyebrow. Key/value rows are mono on the right, muted label on the left. Resource bars are 4px tall with brand fill.

### REQ-09: Agent Graph Visualization
Lead node is larger, glows, and uses `.animate-pulse-ring`. Edges are 1px `oklch(1 0 0 / 0.12)`; stale edges dash. Selection scales 1.10 and adds status glow. Nodes are SVG-positioned in percentages for fluid graph.

### REQ-10: Motion System
Motion is small, technical, and ambient. `animate-pulse-ring` on lead node (2.4s ease-out). `animate-pulse` on running status dots. 12s auto-refresh indicator pulse in toolbar. Hover transitions are `transition-colors` only; no scale on chrome. Canvas nodes use `transition-all` with 1.10 scale on select.

### REQ-11: Design Language Voice
Lowercase environment names, uppercase state pills (`RUNNING`). Log levels: `info`, `warn`, `error`, `ok`. Timestamps are `HH:MM:SS`. Identifiers stay mono and unabbreviated. Empty states read like CLI hints.

### REQ-12: Radius and Spacing Scale
Radius scale derives from `--radius: 0.5rem`. Pills are full radius; surfaces use `rounded-md`/`rounded-lg`. Borders are 1px, low-chroma. Density first: header `h-14`, toolbar `h-11`, buttons `h-7`–`h-8`.

### REQ-13: Legacy CSS Migration
Files under `src/styles/*.css` (except `tailwind.css` / `tailwind-components.css`) are migration leftovers. When touching a view, move its rules into Tailwind classes and delete the obsolete selectors. `src/styles.css` imports Tailwind first, then remaining legacy sheets until each view is migrated.

### REQ-14: Glow Effects
Glows restricted to live nodes and focused elements. Glow specification: `box-shadow: 0 0 30px oklch(from var(--running) l c h / 0.35)`.
