# Web Guidelines

## Ownership
- `apps/web` owns the operator UI, client-side interaction flow, and presentation of runtime state.
- Keep backend orchestration out of the UI. The web app should consume API/runtime contracts, not recreate server logic in React components.

## Relevant Docs
- `docs/concepts/mental-model.md`
- `docs/concepts/coordination.md`
- `docs/concepts/runtime-and-api.md`
- `docs/guides/working-with-todos.md`
- `docs/guides/orchestrating-child-agents.md`
- `docs/guides/inter-agent-messaging.md`
- Read these when changing interaction models, UI vocabulary, coordination flows, agent orchestration surfaces, or operator-facing behavior.

## Module Shape
- Top-level containers should orchestrate. Move pure constants, parsers, normalizers, and hooks into `src/app/*`.
- Keep large JSX blocks in focused components under `src/components/*` with typed props.
- Reusable primitives belong in `src/components/ui/*`.
- Runtime transport code belongs in `src/runtime/*`.

## Styling
- Keep `src/styles.css` as the import manifest.
- Add or update focused CSS modules under `src/styles/*` instead of growing one large stylesheet.
- Preserve the existing token-driven, modular CSS structure and avoid one-off style dumping in unrelated files.

## UI Conventions
- Use the existing product vocabulary: agents, sessions, worktrees, logs, pipelines, coordinations, and terminal columns.
- Preserve the current layout model: terminal columns are the visual unit; coordinations are the contextual grouping.
- Prefer in-app confirmation and action-panel flows over browser-native dialogs for destructive actions.

## State
- Persist layout and UI preferences through the runtime-backed `.adadex` state model, not browser-only storage, unless the feature is explicitly local-only.
- Keep coordination IDs stable for routing and runtime identity; user-facing names remain presentation data.

## Testing
- Add targeted component or runtime tests when changing view-model logic, state reconciliation, or destructive UI flows.
- When modifying shared UI behavior, verify both the component surface and the normalizer/hook logic that feeds it.
