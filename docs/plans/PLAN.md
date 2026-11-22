# adadex desktop: plan and status

This is the only plan document for branch `adadex-factory`. It replaces `HANDOFF.md`, `factory-desktop-phases.md`, `decisions.md`, `phase-6-cutover.md` and `security-model.md`; their history is in git. Status checked against the code on 2026-11-20.

## Problem

adadex runs coding agents, but the factory pipeline that drives them (shape, spec, build, gate, review, polish, prove, ship, and review-a-branch) lives in Python scripts in the separate `calphonse-skills` repo, behind a local HTTP server. That gives one fixed pipeline, weak guarantees about what an agent may do, and two codebases to keep in step.

The goal is one Electron desktop app where people build their own workflows, each stage is worked by an agent bound to a **role** a person chose, and the guarantees meet an enterprise review: least privilege, tamper-evident logs, fail closed.

## Done means

- [ ] Every board action runs over the Electron request layer, and the old HTTP routes are gone.
- [ ] A user can build a three-stage workflow on the canvas, using a skill from a folder other than `calphonse-skills`, and run a job through it.
- [ ] The parity map below has no "Not ported" row the user has not chosen to drop.
- [ ] The unattended loop has run on at least one real project, for as long as the user is comfortable with, with no integrity failure.
- [ ] The user has approved deleting factory's Python, and it is deleted.

## Rules for every agent

- **Never commit, push or open a PR** unless the user says so. Other tools committing this tree is not permission.
- **Claude Code only.** Do not build an OpenCode or Kiro adapter. The provider port stays so one can be added later.
- **No new dependency, install-script approval or web fetch** without asking.
- **An agent can never change or switch its own role.** Autonomy is only what a role grants. Do not add an action that changes a role or grants a permission; a test fails if one exists.
- Do not give any role a human-only action, a network tool, or write access to `job.json`, `audit.log`, `checks.md` or the data folder. `parseRole` refuses these; keep the tests that check it.
- Write the test first. Never weaken a test to make it pass. Two real bugs (a symlink path mismatch, a doubled backslash in a sandbox pattern) were found because a test was strict.
- `packages/core` stays free of React, HTTP, PTY and filesystem code.
- Read `AGENTS.md` and the scoped `AGENTS.md` for the area you touch.

## Where things are

| Path | What |
| --- | --- |
| `packages/core` | Pure logic. Workflow engine (`advanceJob`, `parseWorkflow`), roles (`parseRole`, `authorizeForRole`, `policyForRole`), tool policy (`evaluateToolCall`), action registry, `planTick`, canvas logic (`toGraph`, `editWorkflow`, `problemsOf`), presets (`factory`, `factory-review`, eleven roles) |
| `apps/desktop` | Everything with IO plus the Electron shell. `src/app/createApp.ts` wires it. Request contract in `src/ipc/contract.ts` |
| `apps/web` | React UI. Factory view is nav item 8, talking to the host through `src/runtime/factoryHost.ts`; components in `src/components/factory/` |
| `apps/api` | The old local HTTP server. Removed in the cutover |

## Status by phase

- [x] **0 Baseline.** Runtime, core and routes read; Kiro hard-wiring found; factory tests mapped.
- [x] **1 Core.** Declarative workflow engine, policy, action registry, hard blocks (no push, no PR, no commit without a human click).
- [x] **2 Runtime.** Process groups, kill-all on quit, orphan reaping on launch, persisted sessions and channel messages.
- [x] **3 Agent runner** for Claude Code: headless `claude -p` with one MCP tool (`adadex_action`), `PreToolUse` guard hook, git guard, run-gate and commit executors. No OpenCode adapter, by decision.
- [x] **4 Electron shell.** Native dialog for human-only actions, request layer, tray, keep-awake, smoke-tested.
- [x] **5 Board UI.** Jobs by stage, approval cards, processes panel, loop toggle, roles panel, newest 50 log events, "Check audit" per job, project checks field.
- [ ] **5b Workflow builder.** Logic done in core and storage done in desktop. **Canvas UI not started.**
- [ ] **6 Cutover.** Plan below. **Nothing deleted.**

## Work to do

In order. Each item ends with how to tell it is done.

### 1. Close out the current tree

- [ ] 1.1 Commit the staged React lint fixes (`App.tsx`, `terminalRuntimeStateStore.ts`, `DeckPrimaryView.tsx`, `useOrchestrationGitLifecycle.ts`, `useConversationsRuntime.ts`, `useCanvasGraphData.ts`) when the user says so. Done when: `pnpm lint && pnpm test && pnpm build` pass and the user has committed.
- [ ] 1.2 Clear the remaining web lint warnings (`Toast.tsx` ref read during render, `toThrow` without a message in `apps/desktop/tests/sandbox.test.ts` and `jobs.test.ts`). Done when: `oxlint` reports 0 warnings in those files.
- [ ] 1.3 Format the 46 files `oxfmt --check` reports, as a separate formatting-only commit. Done when: `oxfmt --check` passes repo-wide.

### 2. UI for requests that already exist

- [ ] 2.1 Add an `audit.export` request (`store.exportAudit` and `verifyAuditExport` exist) and an Export button per job. Done when: a desktop test exports a chain and verifies it offline with only the public key, and the button saves the file.
- [ ] 2.2 Add filters to `LogsPanel` (job, run, role, source, level, time) on top of `logs.query`. Done when: a component test filters by level and job.
- [ ] 2.3 Let `project.set` change `baseBranch`, `timeoutMs` and `protectedPaths`, not only `checks`. Each save shows the new values in the native dialog. Done when: desktop tests cover each field and its refusal of bad input, and the Factory view has the fields.

### 3. Workflow builder canvas (Phase 5b)

- [ ] 3.1 Draw the workflow from `toGraph`: stages as nodes left to right, moves as edges, loops marked, needs-human as a badge. Reuse the existing canvas.
- [ ] 3.2 Side panel to edit a stage or move through the `editWorkflow` operations: conditions, effects, skills, hints, role, start stage, terminal.
- [ ] 3.3 Show `problemsOf` beside the canvas and block saving while there are any; save with `workflows.save`, showing `parseWorkflow` errors next to the field.
- [ ] 3.4 Create, fork a preset, edit, delete. Presets are read-only; editing one forks it.
- [ ] 3.5 An `unattended` switch per workflow (off by default), since the loop only works opted-in workflows.
- [ ] 3.6 Skill sources settings: folders to scan, skills each stage resolved, and the per-machine skill map. A missing skill is reported, never guessed.
- [ ] 3.7 Done when: an end-to-end test builds a three-stage workflow in the UI using a skill from a non-`calphonse-skills` folder and runs a job through it in the real app (`pnpm --filter @adadex/desktop smoke`).

### 4. Security gaps

- [ ] 4.1 **Sub-agents.** Test live whether Claude Code's `PreToolUse` hook runs for a sub-agent's tool calls. If not, deny the sub-agent tool to every role. Done when: a test or a recorded live run shows the result, and the policy matches it.
- [ ] 4.2 **Per-reviewer roles.** Today any reviewer can write any `round-N/review-*.md`, so one can overwrite another's verdict. Give each reviewer its own role, or scope the pattern to its own file. Done when: a role-run test shows reviewer A refused when writing reviewer B's file.
- [ ] 4.3 **Ship audit anchors off the machine.** Implement a remote `AnchorSink` (only a file sink exists). **Needs the user to name the destination.** Done when: anchors reach the destination and a removed newest line is detected from the remote copy.
- [ ] 4.4 **Sandbox beyond macOS.** Linux (namespace or container) and Windows. Until then the app refuses to start an agent there unless `sandbox: "off"`. Done when: the sandbox tests run against the real sandbox on each OS.
- [ ] 4.5 Later, not needed for cutover: organization-wide or per-day budgets (today budgets are per run), and sign-in or per-person approval rules (today identity is the OS user).

### 5. Parity left to port

- [ ] 5.1 Review base-and-head mode (factory's `--review`) for the review workflow. Done when: a review job runs on a given base and head and its reviewer cannot write code.
- [ ] 5.2 Git hook digest check (from factory's integrity checks). Done when: an edited commit or push hook in a job's worktree stops the next run and parks the job.
- [ ] 5.3 Attack probe harness (`probe_harness.py`): a repeatable live script that tempts each role to overstep and then checks the files on disk, not the model's claims. Build it from `apps/desktop/tests/roleRun.test.ts` (`world()`) using `createApp` with the default provider, `app.roles.save`, `app.workflows.save` and `app.runStage`.
- [ ] 5.4 Decide whether `tick install` (policy files for Claude Code used outside the app) needs a replacement or is dropped. **User decision.**

### 6. Packaging

- [ ] 6.1 Choose a packager and code signing for Electron. Adds a dependency, so **ask first**.
- [ ] 6.2 Done when: a signed build installs on a clean macOS machine and the smoke steps pass against it.

### 7. Cutover (Phase 6)

- [ ] 7.1 Move every web view from the `apps/api` HTTP routes to the request layer, view by view. Done when: no `fetch` to the local server remains in `apps/web`.
- [ ] 7.2 Run the loop on a real project (see "Done means").
- [ ] 7.3 Rewrite the parity map below so every row is covered or dropped on purpose.
- [ ] 7.4 Remove `apps/api`: the HTTP server, routes, WebSocket endpoints, loopback and origin checks, cookie auth, browser launch, and the Kiro-only setup steps. Update `AGENTS.md`, `README.md` and `docs/`.
- [ ] 7.5 **Only on the user's say-so**, in `calphonse-skills`, in the same change as 7.4:
  - [ ] Delete `factory/bin/` (`job`, `tick`, `guard`), `factory/tests/`, `factory/dashboard/`, `factory/policy.yaml`, `factory/policy.build.yaml`.
  - [ ] Delete `factory-review/bin/`, `factory-review/tests/`, `factory-review/dashboard/`, `factory-review/policy.yaml`.
  - [ ] Shrink `factory/README.md` and both `SKILL.md` files to short pointers to the app.
  - [ ] Reword the two `AGENTS.md` index rows and the `pr-body-style` mention of "factory branches the user committed on the board".
- [ ] 7.6 Delete this file's cutover sections once 7.5 is done.

### Needs the user (do not decide these)

- [ ] Approve deleting the Python in `calphonse-skills` (irreversible, two repos).
- [ ] Name where audit anchors are sent (4.3).
- [ ] Keep or stop the tools that auto-commit this tree. `.kiro/hooks/adadex.json` is tracked, holds `curl` hooks aimed at the old server and looks generated; the recommendation is to stop tracking it.
- [ ] Confirm the `node-pty` install-script approval recorded by OpenCode (not seen in conversation).
- [ ] Confirm OpenCode's `calphonse-skills` commit `f57baf4` (policy fetch rules and watch-test fixtures) is wanted.
- [ ] Decide on `tick install` (5.4).

## Decisions made

| # | Question | Decision | Status |
| --- | --- | --- | --- |
| 1 | Audit log integrity | Sign every line (Ed25519, per-machine key wrapped by the OS keychain), anchor each chain's newest line in a separate file, verify offline with the public key. Ship anchors to a central log later | Built, except shipping (4.3) |
| 2 | Unattended loop | Off globally, and off per workflow until it sets `unattended: true`. Both presets are off; fork one to enable. Turning the loop on needs the native dialog | Built |
| 3 | Identity | Record the OS user on every human action. SSO and per-person rules when a second person or a shared server appears | Partly built |
| 4 | Stack skills | Each workflow names its skills. No detection from file names | Decided |
| 5 | Unblock | Back to the stage the job was parked from, reason cleared, round limit = current round + default allowance, polish flag cleared when going back to build | Built |
| 6 | Provider | Claude Code only | Decided |
| 7 | Keep awake | Electron's power save blocker while any agent or check runs | Built |
| 8 | factory's Python | Frozen. Deleted only when the "Done means" criteria hold and the user says so | Decided, nothing deleted |
| 9 | Sandboxing | OS sandbox around every agent process; refuse to start without one | Built on macOS (4.4 for others) |
| 10 | Commits | The app never commits for an agent. The user decides when and what | Decided |

## How an agent run works

1. A job sits at a stage. The workflow, written by a person, names the role for that stage. A stage with no role waits for a person.
2. `createRoleRunner.run` verifies the job's audit chain, reads the role from the stage, binds and freezes `{runId, roleId, jobId, stageId}`, and builds the tool policy and the sandbox profile from the role.
3. Claude Code starts headless inside the sandbox with one MCP tool and a `PreToolUse` hook. Every tool call asks the app first (`toolGuard`) and blocks on any doubt; every action goes through `authorizeForRole`.
4. Human-only actions (approve spec, commit locally, unblock) are never run by an agent. A person clicks, and the main process shows a native dialog that web content and agents cannot press.
5. The app runs the gate. Its result counts only if the audit log vouches for the same verdict and tree (`attestedGate`). The commit is a person's click, in the job's worktree, of exactly the files the gate checked.

## Security model

**The rule:** an agent has exactly the autonomy its role gives it. A person decides the role, it is fixed for the run, and nothing an agent can reach changes it.

**Why an agent cannot widen its role**

| Attempt | What stops it |
| --- | --- |
| Ask to change its role | No such action exists in the registry (checked live: `role.set` refused) |
| Move the job to a stage with a stronger role | A role may only move to the stages in its own `advanceTo` |
| Run a human-only action | `parseRole` refuses to list one; the host refuses an agent for it; only the native dialog runs it |
| Write a stronger role or workflow | Roles live in the data folder no agent can write; workflows are saved only through the UI request layer |
| Edit its own budget | The budget is part of the role |

**Least privilege.** Only builder and polisher edit code. Every role writes only its own documents in the job folder. No role writes `job.json`, `audit.log` or any `checks.md`, or has a network tool. Extra shell commands can only be added to the allow list; deny and ask rules always win, and a leading-wildcard pattern is refused.

**Logs.** One SQLite file, `<data folder>/logs/adadex.db` (Node's built-in `node:sqlite`, Node 22.13+), mode 0600 in a 0700 folder, write-ahead logging with full sync. `audit` is the per-job chain: append-only by trigger, cannot fork, hash-chained to the line before and to the job record, signed and anchored. `events` is the operational log (guard decisions, approvals, processes, runs, loop, integrity failures), redacted before writing and pruned after 90 days. Projects are separated by a hash of the project folder. A logging failure never stops work.

**Sandbox (macOS).** Writes only to the job folder, scratch, its own settings and package caches, plus the worktree for roles that edit code. Never the job record, `checks.md`, the worktree's `.git` entry or the git config that holds the commit lock. No reads of the app's data folder or credential folders (`.ssh`, `.aws`, `.gnupg`, `.kube`, `gcloud`, `gh`, `.netrc`, Docker config). Checked live.

**Autonomy limits.** Loop off until a person turns it on; one run per job; concurrency limit; a run stops at its call or time budget; a job whose runs keep ending where they began is parked; quitting stops every agent and declines every waiting approval. The git layer has no push or remote operation, and commit, push and branch moves in a worktree fail without the human key held in app memory.

**Known gaps:** anchors stay on the machine (4.3); identity is the OS user (4.5); an allowed program like `npm test` can write anything its role may write inside the worktree; sandbox is macOS only (4.4); sub-agent hooks untested (4.1); budgets are per run (4.5); reviewers share one verdict pattern (4.2); a person with a shell on the machine can edit roles, workflows and the log, since the app protects against agents, not its operator.

## Parity with factory's Python

Test counts from `calphonse-skills`: 263 factory, 136 factory-review.

| Area | In the new app | Status |
| --- | --- | --- |
| Job ids, create | Store and action input checks; create through the request layer | Covered |
| Stage rules and rounds | `advanceJob` against both presets, end-to-end test on disk | Covered |
| Gate and protected paths | `runGate`, `commitLocal`, `PROTECTED_FLOOR`, configured patterns | Covered |
| Human-only actions | Registry human class, native dialog, git hooks with the human key | Covered (key in app memory, not a server) |
| Tool policy | `evaluateToolCall`, the hook, live runs | Covered for Claude Code |
| Audit log | SQLite chain, signed, anchored, redacted, retained | Covered, stronger |
| Integrity checks | Chain, job-record check, attested gate, checked before every run | Mostly. Git hook digest check: 5.2 |
| Queue and loop | `planTick`, scheduler, loop toggle, per-workflow opt-in, keep-awake | Covered |
| Read-only review | Reviewer roles cannot write code at all | Mostly. Base-and-head mode: 5.1 |
| Stack detection | Workflows name skills instead | Dropped by decision 4 |
| Unblock | Back to the parked stage with a fresh allowance | Covered, by decision 5 |
| Keep awake | Power save blocker | Covered |
| Per-harness policy files (`tick install`) | App applies policy itself | User decision: 5.4 |
| Local server, dashboard, file watching | Request layer and Electron window | Retire with the Python |
| Attack probes | Manual live runs only | Not ported: 5.3 |

## Verify before and after a change

```
pnpm lint && pnpm test && pnpm build
pnpm --filter @adadex/desktop smoke
```

For a narrow change, run the scoped package's tests first, then widen. Live checks against real Claude Code need `claude` signed in and cost tokens; check files on disk, not what the model says.

## Traps

- **`ELECTRON_RUN_AS_NODE`**: VS Code sets it, so Electron starts as plain Node. Clear it before launching by hand (`smoke` does).
- **Real paths**: the guard compares symlink-resolved paths, and on macOS `/var/folders` is `/private/var/folders`. Any rule folder must go through `resolveReal` or it silently never matches.
- **Test helpers**: write gate results with `writeGate` (`tests/helpers/attest.ts`), which also writes the audit line. A test that edits `job.json` directly must follow it with `store.audit(...)`.
- **`packages/core/tsconfig.tsbuildinfo`**: `tsc` rewrites it; restore it after type-checking.
- **sandbox-exec profiles**: later rules win, and regex backslashes must not be doubled.
- **oxfmt rewrites files**: re-read a file after formatting before a scripted edit.
- **Node 22.13+** for `node:sqlite`.
