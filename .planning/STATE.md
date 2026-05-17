# Project State

## Current Phase

**Active:** None — initial project setup
**Status:** Ready for Phase 1 planning

## Phases

| Phase | Status | Plans | Last Activity |
|-------|--------|-------|--------------|
| 1. Design System Foundation | Planned | 2 | 2026-05-16 |
| 2. Core UI Components | Not started | 2 | - |
| 3. Agent Graph & Canvas | Not started | 2 | - |
| 4. Terminal Columns & Interaction | Not started | 2 | - |

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

## Notes

- Design spec source: `apps/design.md`
- Codebase analysis: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/CONVENTIONS.md`
- Concerns: `.planning/codebase/CONCERNS.md`
- Current CSS tokens in `src/styles/foundation.css` use hex colors and Octogent-era naming
