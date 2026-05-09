# Codebase Concerns

**Analysis Date:** 2026-05-09

## Tech Debt

**Deck HTTP routes bundled in one module:**
- Issue: Multiple deck, vault, todo, and swarm route handlers live in a single large file, which increases merge conflict risk and makes navigation harder than a one-route-per-file layout.
- Files: `apps/api/src/createApiServer/deckRoutes.ts`
- Impact: Slower reviews, higher chance of inconsistent patterns when adding endpoints.
- Fix approach: Split by subdomain (for example `deckCoordinationRoutes.ts`, `deckTodoRoutes.ts`, `deckVaultRoutes.ts`) and re-export from a thin `deckRoutes` barrel, matching how `gitRoutes.ts` / `terminalRoutes.ts` stay focused.

**Oversized API integration test module:**
- Issue: A very large proportion of HTTP contract coverage sits in one test file.
- Files: `apps/api/tests/createApiServer.test.ts`
- Impact: Harder to find failures, longer edit-compile-test cycles, weaker signal on which feature regressed.
- Fix approach: Partition tests by route family (deck, terminal, monitor, static assets) with shared test harness utilities extracted to `apps/api/tests/helpers/`.

**Large React canvases and app shell:**
- Issue: Primary UI surfaces exceed typical component size guidelines without being split into smaller presentational units.
- Files: `apps/web/src/components/CanvasPrimaryView.tsx`, `apps/web/src/App.tsx`, `apps/web/src/components/EmptyOctopus.tsx`
- Impact: Difficult reasoning about state flow and hook interaction; regressions in one concern affect unrelated UI.
- Fix approach: Extract view-specific hooks and subcomponents already implied by JSX regions; keep orchestration in the parent.

**Agent usage and CLI integration complexity:**
- Issue: Claude usage detection spans subprocess invocation, PTY probes, and parsing; logic is dense and environment-dependent.
- Files: `apps/api/src/claudeUsage.ts`
- Impact: Subtle breakage when CLI output formats or install paths change; high cost to modify safely.
- Fix approach: Isolate pure parsers from I/O; expand golden-file fixtures for stdout samples; document supported CLI versions in repo docs (not in this file).

---

## Known Bugs

Not detected from static review (no `TODO` / `FIXME` markers in `apps/` or `packages/` source; vendor `node_modules` contains third-party TODOs only).

---

## Security Considerations

**Remote access mode widens the trust boundary:**
- Risk: `OCTOGENT_ALLOW_REMOTE_ACCESS` disables strict loopback checks for Origin/Host validation, so any client that can reach the bind address is treated as allowed for CORS and WebSocket upgrade paths that use the same helpers.
- Files: `apps/api/src/server.ts`, `apps/api/src/cli.ts`, `apps/api/src/createApiServer/security.ts`, `apps/api/src/createApiServer/requestHandler.ts`, `apps/api/src/createApiServer/upgradeHandler.ts`
- Current mitigation: Default remains loopback-only; remote mode is opt-in via explicit environment toggle (sensitive values not documented here).
- Recommendations: Treat remote mode as equivalent to running an unauthenticated admin API; bind to a private interface, use SSH tunnel or reverse proxy with auth, and document threat model in operator-facing docs.

**No application-layer authentication on the API:**
- Risk: Any process or browser tab that can reach the listener can invoke terminal, git, deck, and prompt routes.
- Files: `apps/api/src/createApiServer/requestHandler.ts` (route surface), `apps/api/src/createApiServer.ts`
- Current mitigation: Local-first defaults (`127.0.0.1` host in `apps/api/src/server.ts`) and CORS/origin checks for non-remote mode (`apps/api/src/createApiServer/security.ts`).
- Recommendations: If exposing beyond localhost, add an explicit auth token or mTLS at the edge; never rely on CORS alone for security.

**HTML injection via rendered Markdown:**
- Risk: `marked` output is injected with `dangerouslySetInnerHTML`; malicious markdown in transcripts or deck content could execute script in the operator browser.
- Files: `apps/web/src/components/ui/MarkdownContent.tsx`
- Current mitigation: Biome suppression documents intent (trusted operator UI); highlighting only wraps plain text segments outside tags.
- Recommendations: Use a Markdown pipeline with HTML sanitization (allowlist) if transcripts can originate from untrusted sources, or render through a React-safe AST renderer.

**Secrets in monitor provider requests:**
- Risk: Bearer credentials are forwarded to external monitor APIs; mishandling logs or errors could leak tokens.
- Files: `apps/api/src/monitor/xProvider.ts`
- Current mitigation: Tokens are read from configuration/credentials types (implementation detail; do not log values).
- Recommendations: Redact `Authorization` in any debug logging; ensure error responses never echo full upstream payloads.

---

## Performance Bottlenecks

**Terminal session runtime path:**
- Problem: Multiplexes PTY I/O, scrollback trimming, transcript persistence, and WebSocket fan-out in one hot path.
- Files: `apps/api/src/terminalRuntime/sessionRuntime.ts`
- Cause: Single-process architecture with synchronous filesystem writes on some transcript events.
- Improvement path: Batch transcript writes, move heavy persistence off the PTY read loop via a bounded queue, profile under many concurrent terminals.

**Large deck listing and coordination aggregation:**
- Problem: Reading and assembling deck state may walk many coordination directories and vault files.
- Files: `apps/api/src/deck/readDeckCoordinations.ts`
- Cause: File-system–bound aggregation without caching layer.
- Improvement path: Incremental cache keyed by `coordinations.json` mtime or explicit invalidation from mutation routes.

---

## Fragile Areas

**PTY and shell spawn pipeline:**
- Files: `apps/api/src/terminalRuntime/sessionRuntime.ts`, `apps/api/src/terminalRuntime/ptyEnvironment.ts`, root `package.json` and `apps/api/package.json` (`node-pty` dependency)
- Why fragile: Native addon builds differ per OS/arch; spawn helpers and environment composition interact with user shells.
- Safe modification: Run `apps/api/tests/sessionRuntime.test.ts` and full `pnpm test` after changes; verify on Windows and Unix CI matrix if available.
- Test coverage: `apps/api/tests/sessionRuntime.test.ts` exists but cannot cover every host shell configuration.

**Git worktree and GitHub CLI subprocess surface:**
- Files: `apps/api/src/terminalRuntime/systemClients.ts`, `apps/api/src/githubRepoSummary.ts`
- Why fragile: Depends on installed `git`/`gh` versions and repository state on disk.
- Safe modification: Prefer `execFile` with fixed argument lists (already used); add integration tests behind feature flags where possible.

**WebSocket upgrade and HTTP parity:**
- Files: `apps/api/src/createApiServer/upgradeHandler.ts`, `apps/api/tests/upgradeHandler.test.ts`, `apps/api/tests/createApiServer.test.ts`
- Why fragile: Security assumptions (Origin/Host) must stay aligned between HTTP and WebSocket paths.
- Safe modification: When editing `security.ts`, update both request and upgrade handlers and extend tests in `apps/api/tests/createApiServer.test.ts` / `upgradeHandler.test.ts`.

---

## Scaling Limits

**Single API process / workspace:**
- Current capacity: One Node process hosts PTYs, HTTP, and WebSockets for one `workspaceCwd` (`apps/api/src/server.ts`).
- Limit: CPU-bound PTYs and memory for scrollback dominate before horizontal scaling.
- Scaling path: Multiple workspaces require multiple processes or machines; shared remote API is not a first-class multi-tenant design in-tree.

**Configurable session and scrollback caps:**
- Current capacity: `TERMINAL_MAX_CONCURRENT_SESSIONS`, `TERMINAL_SCROLLBACK_MAX_BYTES` in `apps/api/src/terminalRuntime/constants.ts` bound per-process load.
- Limit: Hitting caps rejects or trims sessions; operator sees degraded usefulness under swarm load.
- Scaling path: Raise caps with measured memory; offload transcript storage if bytes grow too large.

---

## Dependencies at Risk

**`node-pty` native bindings:**
- Risk: Major version or platform toolchain changes can break installs; Windows support historically sensitive.
- Impact: API server cannot spawn terminals.
- Migration plan: Pin ranges deliberately; test `pnpm install` on target platforms in CI; watch upstream release notes.

**`ws` WebSocket library:**
- Risk: Security or API changes in major bumps affect upgrade handling and backpressure.
- Impact: Dropped terminal streams or failed handshakes.
- Migration plan: Run `apps/api/tests/protocol.test.ts` and WebSocket-related suites after upgrades.

**External CLIs (`claude`, `git`, `gh`):**
- Risk: Output format drift or missing binaries breaks usage metrics and automation.
- Impact: Partial features (usage charts, PR flows) with opaque runtime errors.
- Migration plan: Feature-detect CLI presence; version-guard parsers in `apps/api/src/claudeUsage.ts` and related modules.

---

## Missing Critical Features

**Core package test breadth:**
- Problem: Most domain modules under `packages/core/src` lack dedicated unit tests beyond list-building coverage.
- Blocks: Safe refactors of shared types and pure logic used by both apps.

**First-class authenticated remote operation:**
- Problem: Remote access is environment-flag based without built-in identity.
- Blocks: Safe multi-user or internet-facing deployments without external wrapping.

---

## Test Coverage Gaps

**`@adadex/core` domain surface:**
- What's not tested: Types and helpers across `packages/core/src/domain/*.ts`, `packages/core/src/util/typeCoercion.ts`, and adapters other than what `buildTerminalList` exercises.
- Files: `packages/core/src/` (16 modules), tests only in `packages/core/tests/buildTerminalList.test.ts`
- Risk: Regressions in shared contracts propagate to `apps/web` and `apps/api` before detection.
- Priority: High

**Markdown rendering safety:**
- What's not tested: No in-repo test asserts sanitized HTML or XSS-safe rendering for `MarkdownContent`.
- Files: `apps/web/src/components/ui/MarkdownContent.tsx`, `apps/web/tests/` (no dedicated markdown test file observed)
- Risk: Future changes to `marked` config or highlight logic could reintroduce injection.
- Priority: Medium

**Deck vault path hardening:**
- What's partially tested: `readDeckVaultFile` rejects `..` and `/` segments (`apps/api/src/deck/readDeckCoordinations.ts`); explicit tests for edge encodings may be sparse.
- Files: `apps/api/src/deck/readDeckCoordinations.ts`, `apps/api/src/createApiServer/deckRoutes.ts`
- Risk: Odd `fileName` encodings or platform-specific path joins could bypass assumptions.
- Priority: Medium

---

*Concerns audit: 2026-05-09*
