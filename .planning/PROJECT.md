# Project: Adadex

## Description
Terminal-inspired orchestration cockpit for managing multiple AI coding agents. A web-first command surface that treats terminal coding agents as parts of a bigger orchestration layer.

## Structure
- **Monorepo**: pnpm workspace with `apps/*` and `packages/*`
- **`@adadex/core`** (`packages/core/`) — Framework-agnostic domain types, application logic, ports
- **`@adadex/api`** (`apps/api/`) — Node HTTP + WebSocket server, PTY runtime, persistence, git integration
- **`@adadex/web`** (`apps/web/`) — Vite + React operator UI

## Tech Stack
- **Runtime**: Node.js 22+, pnpm 10.4.1
- **Language**: TypeScript (strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes)
- **UI**: React 19, Vite 6, Tailwind CSS v4, shadcn/ui components
- **Styling**: Tailwind-first with `cn()` + `cva()`, oklch design tokens
- **Server**: node-pty, ws, single Node HTTP process
- **Testing**: Vitest, @testing-library/react, jsdom
- **Formatting**: Biome

## Design
The design language is defined in `apps/design.md`. It blends Vercel's restraint, Linear's density, and Cursor's soft-mint accent over a deep zinc canvas.

Key design tokens:
- **Background**: Deep zinc canvas (oklch(0.16 …))
- **Surface**: Panels, inspector, toolbars
- **Brand/Primary**: Cursor-style soft mint/lime accent
- **Font**: Inter (sans), JetBrains Mono (mono)
- **Base radius**: 0.5rem
- **Borders**: 1px, low-chroma
- **Motion**: Small, technical, ambient

## Key Conventions
- Components never use raw color classes — consume semantic tokens
- One accent per view (mint)
- Mono = machine (IDs, hashes, measurements)
- Density with air (tight type, generous internal padding)
- Borders, not shadows (depth from layered surfaces)
- Motion signals state (if nothing changed, nothing should move)
