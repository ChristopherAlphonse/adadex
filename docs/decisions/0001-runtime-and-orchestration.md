# 0001: Ghostex runs the agents; Adadex owns workflows, roles and policy

Status: accepted by the owner, 2026-11-22. Supersedes the "Claude Code only" rule in `docs/plans/PLAN.md`.

## Context

Adadex grew two runtimes. `apps/api` is a local HTTP and WebSocket server that runs agent terminals (node-pty),
installs hook files into the project, and keeps state in JSON files. `apps/desktop` is an Electron app that runs
headless Claude Code with a tool-policy guard, an operating system sandbox and signed audit logs. The web UI talks
to both. Agent switching, supervision, chat and message delivery were being rebuilt a second time next to
Ghostex, which already does them well and supports Claude Code, OpenCode and Kiro.

## Decision

1. **Ghostex is the orchestrator for running and supervising agents.** Starting an agent, messaging it, reading
   its reply, switching agents and supervising threads go through the `ghostex` CLI. Adadex does not grow a
   second implementation of these.
2. **Adadex keeps what Ghostex does not have:** user-defined workflows, roles bound to workflow stages, the
   tool-policy guard, the sandbox and the signed audit log (`packages/core`, `apps/desktop`).
3. **Claude Code, OpenCode and Kiro all stay supported.** The owner uses all three. The earlier "Claude Code
   only" rule is withdrawn. The provider port in `packages/core/src/ports/AgentProvider.ts` stays the seam.
4. **`apps/api` is frozen.** It gets fixes, not features. It is removed in the cutover (PLAN.md phase 6), once the
   web views run on the desktop request layer.
5. **Agents started through Ghostex bypass the tool guard and the operating system sandbox.** The Ghostex backend
   is therefore opt-in (`ADADEX_GHOSTEX_AGENT`) and is not used for role-bound, least-privilege runs until
   Ghostex gets an equivalent guard.

## Consequences

- New orchestration work is a thin layer over `ghostex` verbs (`agents create`, `send`, `wait-reply`,
  `coordinator …`) and a view of its state, not new supervision code in `apps/api`.
- The web UI shows threads, chat, diffs, questions and usage; it does not decide what an agent may do.
- Not done by this decision, and tracked as open work: SQLite state replacing the JSON files, splitting the
  oversized files, removing the hook files written into user projects, and deleting `apps/api`.
