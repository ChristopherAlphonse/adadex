# Handoff: adadex-factory

Read this first. It is the current state of the work on branch `adadex-factory` as of 2026-11-19, written so a new agent can continue without the conversation that produced it.

## What this is

adadex is being turned into a desktop app (Electron) that runs the factory pipeline (shape, spec, build, gate, review, polish, prove, ship, and a review-a-branch pipeline) with **user-built workflows**, **role-bound agents**, and **enterprise-grade integrity**. Factory is a set of Python scripts in the separate `calphonse-skills` repo. It is frozen as the behavior reference and is not deleted.

The user's rules:
- **Never commit, push or open a PR** unless the user says so. Other tools have been auto-committing this working tree. That is not a licence for you to commit.
- **Claude Code only** as the agent provider. Do not build an OpenCode or Kiro adapter.
- **Do not add a dependency or approve an install script** without asking.
- **An agent can never change or switch its own role.** Autonomy is only what a role grants.
- The enterprise bar applies: least privilege, tamper-evident logs, fail closed.

## Where things are

| Path | What |
| --- | --- |
| `packages/core` | Pure logic, no IO. Workflow definitions and the engine (`advanceJob`), `parseWorkflow`, roles (`parseRole`, `authorizeForRole`, `policyForRole`), tool policy (`evaluateToolCall`), the action registry, `planTick`, canvas logic (`toGraph`, `editWorkflow`), presets (`factory`, `factory-review`, eleven roles, default policies) |
| `apps/desktop` | Everything with IO, plus the Electron shell. `src/app/createApp.ts` wires it all |
| `apps/web` | React UI. The Factory view (nav item 8) uses `src/runtime/factoryHost.ts` |
| `apps/api` | The old local server. Stays until Phase 6 |
| `docs/plans/` | `factory-desktop-phases.md` (tracker and log), `security-model.md`, `decisions.md`, `phase-6-cutover.md`, this file |

`apps/desktop/src`: `agents/` (Claude Code provider, MCP bridge, guard hook, sandbox), `host/` (action host, tool guard), `ipc/` (request contract, host API, approval broker), `jobs/` (job store, gate, commit, git guard, worktree), `logs/` (SQLite, signing, anchors, redaction), `roles/`, `runs/` (role runner, scheduler, process registry), `workflows/`, `skills/`, `config/`, `shell/` (Electron main, preload, a placeholder page).

## State of the phases

| Phase | State |
| --- | --- |
| 0 Baseline | Done |
| 1 Core | Done |
| 2 Runtime (process supervisor, persisted sessions) | Done, by OpenCode, in `apps/api` |
| 3 Agent runner | Done for Claude Code: provider, MCP bridge, tool guard, git guard, gate and commit executors |
| 4 Electron shell | Done and smoke-tested |
| 5 Board UI | Done by OpenCode. The scheduler, roles, logs and audit requests exist but have no UI yet |
| 5b Workflow builder | Logic done in core. **Canvas UI not started** |
| 6 Cutover | Plan written. **Nothing deleted** |

## How an agent run works

1. A job sits at a stage. The workflow (written by a person) says which role works that stage.
2. `createRoleRunner.run` verifies the job's audit chain, reads the role from the stage, binds and freezes `{runId, roleId, jobId, stageId}`, and builds the policy and the OS sandbox plan from the role.
3. Claude Code starts headless inside a macOS sandbox with one MCP tool (`adadex_action`) and a `PreToolUse` hook. Every tool call asks the app first (`toolGuard`), and every action goes through `authorizeForRole`.
4. Human-only actions (approve spec, commit locally, unblock) can never be run by an agent. A person triggers them, and the main process shows a native dialog.
5. The gate is run by the app. Its result counts only if the audit log vouches for it (`attestedGate`).

Security model, controls and the honest gap list: `docs/plans/security-model.md`. Decisions with reasons: `docs/plans/decisions.md`.

## Verify before and after any change

```
npm test                      # core 138, desktop 170, api 147, web 93 at the time of writing
npx oxlint apps/desktop packages/core && npx oxfmt --check apps/desktop packages/core
npx tsc -p packages/core/tsconfig.json --noEmit     # also apps/desktop, apps/api
npm run build
cd apps/desktop && npm run smoke    # starts the real Electron app hidden
```

`npm run lint` at the root fails on accessibility errors in six `apps/web` files that are unchanged from `main`. `npm audit` reports `vite 8.3.2` and `zod 4.6.5` (through knip), also unchanged from `main`. A Dependabot branch for vite 8.3.5 exists. Neither was caused by this work.

Live checks against the real Claude Code (needs `claude` signed in, costs tokens): there were two throwaway scripts in a scratchpad that are gone. Rebuild one from `apps/desktop/tests/roleRun.test.ts` (`world()`), but use `createApp` with the default provider, a user role from `app.roles.save`, a workflow from `app.workflows.save`, and `app.runStage`. Tempt the role to overstep, then check the files on disk, not only what the model says.

## Traps that cost time

- **`ELECTRON_RUN_AS_NODE`.** VS Code sets it, which makes Electron start as plain Node. Clear it before launching Electron by hand (`npm run smoke` does).
- **Real paths.** The guard compares paths with symlinks resolved. On macOS `/var/folders` is really `/private/var/folders`. Any rule folder must go through `resolveReal` or it silently never matches. A role's folder scope failed this way once.
- **oxfmt rewrites files.** Editing with scripted string replacement after `oxfmt` often fails to match. Re-read the file first.
- **Test helpers.** A gate result in a test must be written with `writeGate` (`tests/helpers/attest.ts`), which writes the audit line too. A hand-written `checks.md` is rightly ignored. Any test that edits `job.json` directly must follow it with `store.audit(...)` or the chain check fails.
- **Do not touch `packages/core/tsconfig.tsbuildinfo`.** `tsc` rewrites it. `git checkout` it after type-checking.
- **Node 22.13 or newer** is needed for `node:sqlite`.
- **Sandbox-exec** profiles: later rules win. Regex patterns must not have their backslashes doubled.

## Open work, in the order I would do it

1. **Project checks have no way to be set.** The gate reads its command from `<data folder>/project.json`, which no request writes. Add a request and a UI field. It must stay out of anything an agent can write.
2. **UI for what exists.** Buttons or screens for: the loop on and off (`scheduler.status`, `scheduler.set`, native dialog on enable), roles (`roles.list`, `roles.save`, `roles.remove`), logs (`logs.query`), chain check (`audit.verify`). An export request (`audit.export`) is not added yet; `store.exportAudit` and `verifyAuditExport` exist.
3. **Phase 5b canvas.** Build it on `toGraph` and the `editWorkflow` operations in core, with `problemsOf` shown beside the canvas and `workflows.save` to store. Presets are read-only: fork first. A workflow must set `unattended: true` to be worked by the loop.
4. **Sub-agents.** Check whether the `PreToolUse` hook also runs for a sub-agent's tool calls. Not tested.
5. **Per-reviewer roles.** One reviewer can overwrite another's `review-*.md`. Give each its own role or scope the pattern.
6. **Sandbox beyond macOS** (Linux, Windows). Today the app refuses to start an agent without a sandbox unless `sandbox: "off"`.
7. **Ship the audit anchors off the machine.** Implement `AnchorSink` for a central log. Needs the user to name the destination.
8. **Parity left in `phase-6-cutover.md`:** the review base-and-head mode (`--review`), the attack probe harness, the git hook digest check.
9. **Packaging and signing** for Electron. Not started.
10. **Cutover (Phase 6),** only when the exit criteria in `decisions.md` hold and the user says so.

## Needs the user, do not decide these

- Deleting the Python in `calphonse-skills` (irreversible, two repos).
- Where audit anchors should be sent.
- Whether to keep the auto-committing tools running. `.kiro/hooks/adadex.json` is committed: it holds `curl` hooks aimed at the old local server and looks generated. I recommend dropping it from tracking, but that changes shared history.
- OpenCode's log in the tracker says the user approved the `node-pty` install script. That was not seen in the conversation. Confirm with the user.
- OpenCode also edited `calphonse-skills` (commit `f57baf4`: policy fetch rules and watch-test fixtures). Confirm that is wanted.

## Do not

- Run `npm approve-scripts`, push, open a PR, or fetch from the web.
- Give any role a human-only action, a network tool, or a way to write `job.json`, `audit.log`, `checks.md` or the data folder. `parseRole` refuses these, and the tests that check it must stay.
- Add an action that changes a role or grants a permission. A test fails if one exists.
- Weaken a test to make it pass. Two of this work's bugs (a symlink path mismatch, a doubled backslash in a sandbox pattern) were found because a test was strict.
