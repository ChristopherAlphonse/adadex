# API Guidelines

## Ownership
- `apps/api` owns HTTP/WebSocket routing, PTY session orchestration, worktree lifecycle, transcript persistence, monitor service, and runtime integrations.
- Keep infrastructure details here. Do not push PTY, filesystem, process, or git orchestration into `packages/core` or `apps/web`.

## Relevant Docs
- `docs/concepts/runtime-and-api.md`
- `docs/reference/api.md`
- `docs/reference/filesystem-layout.md`
- `docs/reference/troubleshooting.md`
- Read these when changing API contracts, runtime lifecycle behavior, persistence layout, or operator-facing server workflows.

## Boundaries
- Treat `packages/core` as the source of framework-agnostic types and application logic.
- API routes and request parsers may adapt input into core/application shapes, but avoid embedding large business rules directly in route handlers.
- Keep request parsing, route wiring, runtime orchestration, and persistence concerns in separate modules when the file structure already supports it.
- Do not make the web app depend on server-only implementation details. Expose stable API/runtime contracts instead.

## State And Persistence
- Runtime state under `.adadex/` (migrated from legacy `.octogent/`) is a contract surface. Be careful with compatibility when changing file formats or paths.
- Transcript, coordination registry, monitor config, and worktree data should remain predictable and inspectable on disk.
- Prefer explicit migration or normalization paths over silent shape drift.

## PTY, Process, And Git Safety
- Treat PTY/session lifecycle code as stateful and failure-prone. Handle cleanup, disconnects, and partial failures explicitly.
- For worktree operations, prioritize correctness and recoverability over clever automation.
- Avoid destructive filesystem or git behavior unless the task explicitly requires it and the UI/API surface makes the action clear.

## Testing
- Add targeted tests for request parsing, route behavior, persistence compatibility, and runtime edge cases when touching those surfaces.
- For bug fixes, reproduce with a test before changing runtime logic when feasible.
