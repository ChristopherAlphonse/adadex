# Phase 6: cutover plan

Nothing here has been done. Deleting factory's Python is only safe once the new app covers what the Python does, or the user decides to drop a feature on purpose. This page says what is covered, what is not, and what would be deleted.

Counts come from the test classes in `calphonse-skills`: 263 factory tests and 136 factory-review tests.

## Parity map

| Area | Python tests | In the new app | Status |
| --- | --- | --- | --- |
| Job ids, create | `TestIds` 11, `TestCreate` 3+5 | Job id rule in the store and in action input checks; create through the request layer | Covered |
| Stage rules: shape, spec, build, gate, review, polish, prove, ship, rounds | `TestShapeSpec` 7, `TestBuildGate` 12, `TestPolishProve` 5, `TestRounds` 7, `TestReview` 6, `TestStages` 4+7 | `advanceJob` run against the two presets, plus the end-to-end test on disk. The behavior tests from the first version run unchanged against the presets | Covered |
| Gate and protected paths | `TestProtected` 7, `TestProtectedPaths` 6, gate parts of `TestBuildGate` | `runGate`, `commitLocal`, `PROTECTED_FLOOR`, extra patterns from config | Covered |
| Human-only actions, policy | `TestPolicy` 15, `TestHumanGate` 10+5 | Action registry (human class), native confirmation, git hooks with the human key, commit refusals | Covered. The key model differs: it lives in app memory, not in a server process |
| Tool policy (the guard) | `Guard` 12+10, `ClaudeGuard` 1+1, `OpenCodeGuard` 3+3 | `evaluateToolCall`, the hook, two live runs against real Claude Code | Covered for Claude Code. Not for OpenCode or Kiro |
| Audit log | `TestAudit` 5+3 | Every move, refusal, gate and commit is written, now in the local SQLite database with the chain, redaction and retention | Covered, stronger |
| Integrity checks | `Integrity` 9+8 | Hash-chained audit log, job-record check, and a gate result that counts only if the audit log vouches for it; checked before every agent run. Not ported: the git hook digest check | Mostly covered |
| Queue and the unattended loop | `TestQueue` 6+3, `TickTests` 9+9, `LoopTests` 3 | `planTick` and a scheduler: one run per job, concurrency limit, stall limit, parks a stuck job, off until a person turns it on. Not yet reachable from the UI. No keep-awake | Mostly covered |
| Read-only review rules | `TestNoHumanGatesAndNoWrites` 8, `TestReadOnly` 5 | Stronger: a reviewer role cannot change code at all, and a write it attempts is refused instead of parking the job afterwards. The `--review` base-and-head mode is not built | Partly |
| **Stack detection** | `TestStackDetection` 4+3 | Nothing. Factory reads the file names and picks stack skills (TypeScript, C#, Python). Stage skills are fixed names today | **Not ported** |
| Unblock | in `TestHumanGate` | `job.unblock` returns the job to the stage it was parked from. Factory returns a build job to `build`, turns polish off, and gives it a fresh round allowance | **Different** |
| Keep the machine awake while agents run | `keep_awake` in factory-review | Nothing. Electron can do this with its power save blocker | Not ported |
| Per-harness policy files | `BaselinePolicyTests` 15+15, `TickTests` | The app applies the policy itself. `tick install` for Claude Code, Kiro and OpenCode used outside the app has no replacement | Decision needed |
| Local server, auth, dashboard, file watching | `TestServer` 19+10, `TestWatch` 13+10+6, `AutoWatch` 12+12, `DashboardBuild` 7+7, `RepoIndex` 13 | Replaced by the request layer and the Electron window | Retire with the Python |
| Attack probes against real CLIs | `probe_harness.py` | Two manual live runs against Claude Code | **Not ported** |

## What would be deleted in `calphonse-skills` (only after you agree)

- `factory/bin/` (`job`, `tick`, `guard`), `factory/tests/`, `factory/dashboard/`, `factory/policy.yaml`, `factory/policy.build.yaml`.
- `factory-review/bin/`, `factory-review/tests/`, `factory-review/dashboard/`, `factory-review/policy.yaml`.
- `factory/README.md` and both `SKILL.md` files shrink to short pointers to the app. Today they are 242, 130 and 188 lines about `bin/job`, `bin/tick` and the board.
- `AGENTS.md`: the two index rows describe the Python pipeline, and `pr-body-style` mentions "factory branches the user committed on the board". All three need rewording.

## What would be removed in adadex

- The local HTTP server, its routes and WebSocket endpoints, the loopback and origin checks, and the browser launch. The web UI still talks to them today, so none of this can go until the board and every view run over the request layer. The OpenCode board work is the first step.
- The Kiro-only setup steps and checks, once Claude Code is the provider.

## Order I recommend

1. Decide the four open items below.
2. Port what you keep: integrity checks, the scheduler, stack detection, the review read-only rule, and unblock.
3. Move the web UI from the HTTP routes to the request layer.
4. Retire the old server and the Python together, in one change, with the parity map above rewritten as all covered or dropped on purpose.

## Decisions (made by the tech lead, see `decisions.md`)

- Unattended loop: off globally and per workflow until a workflow opts in. Built.
- Integrity: signed, anchored audit log. Built, shipping to a central log later.
- Stack skills: each workflow names its skills. No detection.
- Unblock: back to the parked stage with a fresh round allowance. Built.
- Deleting the Python: frozen now, deleted only after the exit criteria in `decisions.md` and on your say-so.

## Decisions that were open

1. **The unattended loop.** Built and tested, off by default. Still needed: a request and a UI toggle, and a native confirmation when a person turns it on. Do you want it on by default for any workflow, or opt in per workflow?
2. **Integrity checks.** Done. Do you want the audit log signed or sent to a remote log (see `security-model.md`, gap 1)?
3. **Stack skills.** Keep choosing skills from the files in the repo (TypeScript, C#, Python), or let each workflow say exactly which skills a stage uses? With user-built workflows the second is simpler, and the first can be an optional step.
4. **Unblock.** Return to the stage the job was parked from (today), or follow factory (back to build with a fresh round allowance)?
