# External Integrations

**Analysis Date:** 2026-05-09

## APIs & External Services

**Local application API:**

- **Octogent HTTP + WebSocket server** (`apps/api/src/createApiServer.ts`, `apps/api/src/server.ts`) — Binds to `HOST` (default `127.0.0.1`) and `OCTOGENT_API_PORT` or `PORT` (default `8787`). The web app calls same-origin `/api/*` in dev via Vite proxy (`apps/web/vite.config.ts`); production / CLI flows set `VITE_OCTOGENT_API_ORIGIN` or rely on static hosting + API origin (`apps/web/src/runtime/runtimeEndpoints.ts`, `apps/api/src/terminalRuntime.ts` `OCTOGENT_API_ORIGIN`).

**Agent / IDE usage metering (outbound HTTPS from API):**

- **Anthropic Claude usage (OAuth API)** — `apps/api/src/claudeUsage.ts` calls `https://api.anthropic.com/api/oauth/usage` with beta header `oauth-2025-04-20`. Reads local credentials under `~/.claude` and optionally drives the `claude` CLI via PTY for fallback usage text.
- **OpenAI Codex / ChatGPT usage (OAuth)** — `apps/api/src/codexUsage.ts` uses `https://auth.openai.com/oauth/token` and `https://chatgpt.com/backend-api/wham/usage`. Reads Codex home (`CODEX_HOME` or `~/.codex`).

**Social / feed monitoring:**

- **X (Twitter) API v2** — `apps/api/src/monitor/xProvider.ts` defaults to `https://api.x.com` and `/2/usage/tweets`; override with `OCTOGENT_X_API_BASE_URL` and `OCTOGENT_X_USAGE_ENDPOINT_PATH`. Authenticates with bearer + optional OAuth1-style fields stored as monitor credentials (never log raw tokens; masking helpers live in the same module).

**GitHub (repository intelligence):**

- **GitHub CLI (`gh`)** — `apps/api/src/githubRepoSummary.ts` shells out to `gh repo view`, `gh api graphql`, and git-log style queries. **Not** the Octokit/npm GitHub SDK. Requires user-installed `gh` and `gh auth login`; reaches `api.github.com` indirectly through the CLI.

**Process-spawn integration:**

- **User’s shell / terminal tools** — `node-pty` launches configured shell (`apps/api/src/terminalRuntime/sessionRuntime.ts`). **Git** binary invoked for worktrees and repo operations (multiple modules under `apps/api/src`, e.g. `githubRepoSummary.ts`, tentacle git hooks).
- **`claude` / `codex` CLIs** — Used for usage capture paths in `apps/api/src/claudeUsage.ts` (spawn) and related flows; depend on user installation and PATH.

## Data Storage

**Databases:**

- Not applicable — No SQL/NoSQL client dependencies in `package.json` files; no ORM.

**File storage:**

- **Local filesystem** — Project workspace and runtime state under `.octogent/` (see `docs/reference/filesystem-layout.md`, `AGENTS.md`). State files include `state/tentacles.json`, `state/transcripts/*.jsonl`, worktrees under `worktrees/<tentacleId>`. API respects `OCTOGENT_PROJECT_STATE_DIR`, `OCTOGENT_WORKSPACE_CWD`, `OCTOGENT_PROMPTS_DIR` (`apps/api/src/server.ts`).

**Caching:**

- None as a dedicated infrastructure service — Any caching is in-process or incidental (not Redis/Memcached).

## Authentication & Identity

**Auth provider:**

- **None for the Octogent server** — Default binding is loopback; `OCTOGENT_ALLOW_REMOTE_ACCESS === "1"` widens exposure (`apps/api/src/server.ts`). Treat remote access as a trust-boundary decision.
- **Third-party OAuth tokens** — Claude and Codex features use tokens on disk from vendor CLIs (`apps/api/src/claudeUsage.ts`, `apps/api/src/codexUsage.ts`). X monitor uses secrets supplied via monitor config API (handled in monitor routes and `xProvider`).

## Monitoring & Observability

**Error tracking:**

- Not integrated — No Sentry/Datadog SDK in package manifests.

**Logs:**

- Console logging with verbosity gated by `OCTOGENT_VERBOSE_LOGS` (`apps/api/src/logging.ts`). Optional PTY debug logs: `OCTOGENT_DEBUG_PTY_LOGS`, `OCTOGENT_DEBUG_PTY_LOG_DIR` (`apps/api/src/terminalRuntime.ts`).

## CI/CD & Deployment

**Hosting:**

- Local developer machine / npm-packaged CLI (`bin/octogent`, `dist/`). No Vercel/Netlify/terraform configs found in this audit.

**CI pipeline:**

- **GitHub Actions** — `.github/workflows/ci.yml`: checkout, `pnpm/action-setup@v4` `10.4.1`, `actions/setup-node@v4` with pnpm cache, `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm test`, `pnpm build`.

## Environment Configuration

**Required env vars:**

- **None strictly required for minimal local start** — Sensible defaults: API `127.0.0.1:8787`, cwd from `process.cwd()`. Document and set these when packaging or debugging:
  - **Runtime layout:** `OCTOGENT_WORKSPACE_CWD`, `OCTOGENT_PROJECT_STATE_DIR`, `OCTOGENT_WEB_DIST_DIR`, `OCTOGENT_PROMPTS_DIR` (`apps/api/src/server.ts`).
  - **Listening:** `HOST`, `OCTOGENT_API_PORT` / `PORT`, `OCTOGENT_ALLOW_REMOTE_ACCESS` (`apps/api/src/server.ts`).
  - **Web ↔ API wiring:** `OCTOGENT_API_ORIGIN` (API self-reference and CLI), `VITE_OCTOGENT_API_ORIGIN` (built web), dev proxy `OCTOGENT_API_ORIGIN` in `apps/web/vite.config.ts`.
  - **Dev orchestration:** `OCTOGENT_DEV_START_PORT` (`scripts/dev.mjs`), `OCTOGENT_PACKAGE_ROOT` / `OCTOGENT_NO_OPEN` / `CI` (`apps/api/src/cli.ts`).
  - **PTY limits / debug:** `OCTOGENT_MAX_TERMINAL_SESSIONS`, `OCTOGENT_DEBUG_PTY_*`, `OCTOGENT_VERBOSE_LOGS`.
  - **X monitor overrides:** `OCTOGENT_X_API_BASE_URL`, `OCTOGENT_X_USAGE_ENDPOINT_PATH` (`apps/api/src/monitor/xProvider.ts`).
  - **CLI credential homes:** `CODEX_HOME` (`apps/api/src/codexUsage.ts`).

**Secrets location:**

- Operator environment, shell profile, or process manager — **Do not** commit `.env` files with tokens. Vendor CLIs store credentials under user home (`~/.claude`, `~/.codex`) per usage modules above.

## Webhooks & Callbacks

**Incoming:**

- **HTTP routes under `/api/*`** — Includes hooks such as `/api/hooks/session-start` (exercised in `apps/api/tests/createApiServer.test.ts`). Prescriptive: add new agent-facing endpoints by extending the API router factory in `apps/api/src/createApiServer.ts` (and matching tests under `apps/api/tests/`).

**Outgoing:**

- **Usage and monitor fetch calls** — HTTPS to Anthropic, OpenAI/ChatGPT, and X as described above.
- **No queued webhook fan-out** — No Stripe-style callback URLs maintained by this repo.

---

*Integration audit: 2026-05-09*
