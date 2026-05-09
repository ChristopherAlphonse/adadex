---
name: Adadex full rebrand
overview: "Perform a full product rebrand to **Adadex**: rename packages/CLI/env from Octogent, replace the legacy deck-row domain model with **coordination** (identifiers, routes, paths, filenames), migrate runtime layout from `.octogent` to `.adadex`, update README copy and screenshots, and add a one-time migration path for existing workspaces."
todos:
  - id: migration
    content: Define path/env constants; implement .octogent→.adadex + file/folder migration
    status: completed
  - id: packages-cli
    content: Rename @octogent→@adadex packages, CLI bin, dev scripts, Vite env names
    status: completed
  - id: core-domain
    content: Rename core domain types (DeckCoordination*), coordinationId; update core tests
    status: completed
  - id: api-routes
    content: Rename API deck list/git routes; update deck/git handlers
    status: completed
  - id: web-ui
    content: Rename web components/hooks/runtimeEndpoints; update all web tests
    status: completed
  - id: prompts
    content: Rename prompt files and prompt variables; update references in API
    status: completed
  - id: docs
    content: Update docs/README/AGENTS; slogan; terminology; fix index links
    status: completed
  - id: screenshots
    content: Run app, capture README screenshots and new header asset
    status: completed
  - id: verify
    content: Root build + test + lint; optional migration fixture test
    status: completed
isProject: false
---

# Adadex rebrand and coordination rename

## Scope (confirmed)

You selected **full technical rename** (not copy-only): code, API routes, on-disk layout, and published package identity change alongside user-facing text.

## Naming conventions

| Old                                    | New                                                                                                 |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Octogent                               | **Adadex**                                                                                          |
| Legacy deck row labels (pre-rebrand)   | **coordination** / **coordinations**; product copy emphasizes **orchestration**                     |
| Legacy row id field names              | `coordinationId`                                                                                    |
| `.octogent/`                           | `.adadex/`                                                                                          |
| `~/.octogent/projects/`                | `~/.adadex/projects/`                                                                               |
| Legacy `state` registry filename       | `coordinations.json`                                                                                |
| Legacy per-row dirs under project      | `.adadex/coordinations/<id>/`                                                                       |
| `@octogent/*`                          | `@adadex/*`                                                                                         |
| CLI `octogent`                         | **`adadex`** (e.g. [package.json](package.json) `bin`, [bin/octogent](bin/octogent) → `bin/adadex`) |

**API routes** (from [docs/reference/api.md](docs/reference/api.md) and [apps/api/src/createApiServer/deckRoutes.ts](apps/api/src/createApiServer/deckRoutes.ts)):

- Deck list and nested resources: `/api/deck/coordinations` (and `/api/deck/coordinations/:id/...`)
- Git helpers: `/api/coordinations/:coordinationId/git/...`

**Web client**: Update every URL builder in [apps/web/src/runtime/runtimeEndpoints.ts](apps/web/src/runtime/runtimeEndpoints.ts) and tests that assert paths.

**Environment / dev**: e.g. `OCTOGENT_DEV_START_PORT` → `ADADEX_DEV_START_PORT`, `VITE_OCTOGENT_API_ORIGIN` → `VITE_ADADEX_API_ORIGIN` ([scripts/dev.mjs](scripts/dev.mjs), Vite env typing if present).

## Domain and types ([packages/core](packages/core))

- Rename legacy deck summary/status types → `DeckCoordinationSummary`, `DeckCoordinationStatus` in [packages/core/src/domain/deck.ts](packages/core/src/domain/deck.ts) and propagate through core tests ([packages/core/tests/buildTerminalList.test.ts](packages/core/tests/buildTerminalList.test.ts), etc.).
- Rename legacy row id fields in JSON shapes to `coordinationId` where they represent deck/coordination rows (verify terminal vs coordination IDs — some code paths conflate names; align with existing semantics).

## API and filesystem

- Centralize path constants (e.g. `.adadex`, `coordinations`, `coordinations.json`) in one module if not already, then replace string literals across [apps/api](apps/api) (notably [terminalRoutes.ts](apps/api/src/createApiServer/terminalRoutes.ts), [deckRoutes.ts](apps/api/src/createApiServer/deckRoutes.ts), [gitRoutes.ts](apps/api/src/createApiServer/gitRoutes.ts), [readDeckCoordinations.ts](apps/api/src/deck/readDeckCoordinations.ts)).
- **Migration (required for full rename):** On API/bootstrap, if legacy paths exist and new paths do not, atomically migrate:
  - `.octogent` → `.adadex`
  - Legacy registry file under `state/` → `state/coordinations.json`
  - Legacy per-row directories → `coordinations/` under project dir
  - Global `~/.octogent` → `~/.adadex` (same file renames inside `state/`)
  - Update `.gitignore` documentation and default workspace setup to mention `.adadex`.
- Handle edge cases: partial layouts, read-only FS, concurrent runs — prefer fail-safe logging + clear error if migration cannot complete.

## Web UI

- Rename components and hooks: e.g. `OrchestrationPod.tsx`, `AddOrchestrationForm`, `useOrchestrationGitLifecycle`, [CanvasOrchestrationPanel](apps/web/src/components/canvas/CanvasOrchestrationPanel.tsx), etc.
- Update CSS classes / testids only where they encode old domain tokens if those are part of the public contract; otherwise keep stable selectors if tests depend on them (prefer updating tests to new names for consistency).

**Mascot visuals:** Canvas/mascot drawing is separate from deck row naming; optional rename of serialized `octopus` fields to neutral `mascot` / `avatar` can be a follow-up. Slogan and copy use execution/coordination/orchestration language.

## Prompts and sync

- Rename prompt files and variables that referenced the old domain; update [apps/api](apps/api) prompt resolution / any hardcoded names.
- Sync path [docs/reference/filesystem-layout.md](docs/reference/filesystem-layout.md): `.octogent/prompts/core/` → `.adadex/prompts/core/`.

## Documentation

- Systematic pass: [README.md](README.md), [AGENTS.md](AGENTS.md), [CONTRIBUTING.md](CONTRIBUTING.md), [docs/](docs/) (including [docs/concepts/coordination.md](docs/concepts/coordination.md) and cross-links in [docs/index.md](docs/index.md)).
- Replace slogan: **“Turn chaos into execution.”**
- **GitHub badges:** README currently points at `hesamsheikh/octogent` — confirm whether the repo will be renamed/moved; otherwise update badge URLs to the real repo or remove misleading shields.

## README images

- Run `pnpm dev` after rebrand, open the web UI, capture **six** replacements for [static/images/preview_1.jpg](static/images/preview_1.jpg)–`preview_6.jpg` at comparable framing.
- Replace [static/images/octogent-header.png](static/images/octogent-header.png) with a new header that says **Adadex** (either a screenshot crop, exported banner, or simple branded asset — match README layout width expectations).
- Update `alt` text and any captions from Octogent → Adadex.

## Verification

- `pnpm test`, `pnpm build`, `pnpm lint` at repo root.
- Smoke: create coordination, deck list API, git routes if applicable, and confirm migration from a **copy** of an old `.octogent` fixture in a temp directory.

## Risk note

This is a **breaking change** for any automation, scripts, or external clients that used legacy deck HTTP paths or assumed `.octogent`. Document breaking changes in README “Upgrading” section.
