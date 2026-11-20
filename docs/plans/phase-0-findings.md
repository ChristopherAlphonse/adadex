# Phase 0 findings

Two read-only agents produced this. File and line references come from them and were not all re-checked by hand. Anything marked "unverified" was not confirmed.

## A. adadex today

### Core (`packages/core`)
- About 386 lines, no dependencies, one port (`TerminalSnapshotReader`), one use case (`buildTerminalList`), 3 tests.
- No workflow, stage, policy or action concept exists. All of it is new.
- Its `AGENTS.md` forbids React, HTTP, PTY, process execution and filesystem persistence in core. So workflow data and pure transitions go in core. The supervisor, gate execution and Electron code go in app packages.

### Runtime (`apps/api`)
- **Spawn:** `sessionRuntime.ts:512` calls node-pty with `$SHELL -i`. There is no process-group handling. Whether node-pty already makes the child a session leader was not checked.
- **Agent launch and prompts:** `kiro-cli` is typed into the shell (`sessionRuntime.ts:441`). Prompts arrive as a bracketed paste after a fixed 4 s delay, then Enter 150 ms later (`:448-465`). Limit of 32 sessions.
- **Agent state:** an output-regex tracker polled every 300 ms, plus Kiro hooks. Kiro has no permission-wait hook (`hookProcessor.ts:129-130`).
- **Kill:** `pty.kill(signal)` signals the PTY process only. Whether child processes die is unverified.
- **Shutdown:** SIGINT and SIGTERM close sessions gracefully (`server.ts:67-74`). A crash or SIGKILL leaves children running.
- **Stale detection:** at startup every persisted `running` terminal is marked `stale` (`terminalRuntime.ts:206-224`). It never kills orphans and cannot detect pid reuse.
- **Persistence:** JSON at `.adadex/state/coordinations.json`, debounced, written without temp-file-and-rename (`registry.ts:390,395`). A crash mid-write could corrupt it. Channel messages are in memory only.
- **Hooks call back with curl over HTTP** (`hookProcessor.ts:78-150`). A no-server design needs another channel.

### Kiro coupling
About 10 source files: `constants.ts`, `terminalRuntime.ts`, `hookProcessor.ts`, `agentSkills.ts`, `startupPrerequisites.ts`, `setupState.ts`, `setupStatus.ts`, `miscRoutes.ts`, `terminalParsers.ts` (rejects any provider but `kiro`), `usageHeatmapScanner.ts`, plus `agentProviders.ts` and three components in web. A provider adapter must cover: launch, prompt delivery, state signals, hook or event ingestion, skills directory, availability check, usage and transcripts, and permission handling.

### Routes an action registry replaces
Terminals, deck, coordinations and git, hooks, channels, prompts, and both WebSocket kinds (which become IPC events). `deckRoutes.ts` is 903 lines of business logic in the route layer. The web app is a client of these routes, so it needs a transport swap. Remote access is gated only by loopback Host and Origin checks, with no token.

### Tests
- api 109 tests in about 2 s, web 79 in about 8 s, core 3. All pass.
- node-pty is mocked, so no test needs it installed.
- Missing: tests for real process supervision, process groups and orphan reaping.

## B. factory and factory-review

### The two copies are not two things
`factory/bin/job` already contains a review mode, and it is a superset of `factory-review/bin/job`:
- `create ... --review BASE HEAD` (`factory/bin/job:255-280`), `REVIEW_TRANSITIONS` and `HINT_REVIEW` (`:62-75`), `justify_review` (`:608-629`).
- 20 tests cover it in `factory/tests/test_review_workflow.py`.

So merging is mostly deleting `factory-review`, not combining two codebases. One workflow engine with two workflow definitions (build and review) is the right shape.

| Area | Shared | Only factory | Only factory-review |
| --- | --- | --- | --- |
| guard | Almost identical | `2>&1` handling, quote-aware redirects, unresolvable `$` redirect targets blocked | Older versions of those checks |
| tick | `strip_jsonc`, `shell_policy`, install/check/print | `tick loop`, `run_pass`, `policy.build.yaml`, stall limit | `caffeinate -i`, `WRITE_ONLY`, `REWRITE_ASK` |
| job | state, audit, config, serve, watch, reviewers | Stages shape to ship, `gate`, `approve`, `commit`, flock, protected paths, hooks | Stages scope, review, reconcile, verify, report; `keep_awake`; reviewers that edit tracked files park the job |

Stages: factory has `shape, spec, build, gate, review, polish, prove, ship, ready, rejected, needs-human`. Review has `scope, review, reconcile, verify, report, ready, rejected, needs-human`.

### Test results
- factory: 263 tests, 211 s, 3 failed, 4 skipped. factory-review: 136 tests, 75 s, all passed.
- **Failure 1:** `test_repo_index...test_both_skills_carry_the_same_baseline_policy`. Real drift bug. The two `policy.yaml` files differ by two `git fetch` ask lines. Commit 7d900d1 changed only one side, and which side is intended is unverified.
- **Failures 2 and 3:** `test_watch...test_a_dist_newer_than_its_sources_is_not_rebuilt` and `...same_mtime...`. Stale fixture. It sets mtimes for three dashboard sources, but `map.ts`, `drawer.ts` and `types.ts` were added later.
- **Skipped:** three guard tests that are review-only checks ("builders may write code"), and a non-loopback bind test with no address available.
- Slowest tests take 3 to 6 s each, because they run real git and subprocesses. The slowest is `TestProtectedPaths.test_new_defaults` at 6.3 s.

### Behavior the port must preserve
- **CLI:** `create`, `advance`, `gate`, `stack`, `route`, `progress`, `note`, `queue`, `board`, `watch`, `serve`, `wait`. `approve`, `commit` and `unblock` are human-only and refuse from the CLI. Job ids match `[a-z0-9][a-z0-9-]*`.
- **Exit codes:** job refusal 1, `wait` still waiting 3, tick and guard blocks 2.
- **State under `.planning/factory/`:** `jobs/<id>/job.json`, `audit.log` (JSONL), `config.json`, `human.sha256` (0600), lock files, hooks, and the per-job markdown files with `KEY: value` lines such as `STATUS: READY` and `VERDICT: PASS|CHANGES`. `job.json` and `audit.log` must stay consistent, or the job is parked as `needs-human`.
- **Human gate:** the human key lives only in the serve process memory, and commit hooks check its hash. No env var or flag can set the human context. In the desktop app the main process must own this check, and the UI renderer must not be able to forge a click.
- **Guard:** deny, then ask, then allow. A command no rule names needs a human. Commands are split into segments, and a guard crash blocks the call. Deny `git push*`, `aws s3 rm*`, `curl -X POST*`. Mutating git verbs ask.
- **Harnesses:** the existing `tick` already generates policy for Claude, OpenCode and Kiro.
- **HTTP and auth** (goes away with IPC, but its protections must not be lost): loopback host only, one-time code, cookie plus `X-Factory` header, 64 KB body cap, strict response headers.

## C. What this changes in the plan

1. **Phase 1 is smaller than expected on the factory side.** There is one pipeline with a review mode, not two. Define it once as two workflow definitions.
2. **Fix the three failing factory tests first.** They are real drift and a stale fixture. Do it before they become the spec, or port them as known-red scenarios.
3. **Phase 2 is the largest risk.** Process supervision does not exist, and the registry write is not atomic.
4. **The human-click guarantee needs its own design** in Phase 4, since there is no serve process to hold the key.
5. **OpenCode is already a supported harness** in factory's `tick`. The Phase 3 provider port should list Claude Code and OpenCode, and treat Kiro as optional.
6. **Core's own rules** mean a new package (for example `apps/runtime` or `packages/supervisor`) for the supervisor.

## D. Unverified
- Whether node-pty's child already leads its own process group, and whether grandchildren die on kill.
- Whether the hooks and code-intel routes are the only inbound HTTP callbacks.
- `worktreeManager.ts`, `gitOperations.ts`, `conversations.ts`, `systemClients.ts` and `cli.ts` were not read in detail, and the adadex docs were not read.
- The factory HTTP server and some `tick` paths were not run.
