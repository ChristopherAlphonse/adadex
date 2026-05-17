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
- **Tailwind-first:** Style components with Tailwind utility classes in TSX. Use `cn()` from `@/lib/utils` and `cva()` variants in `@/lib/ui/*` for shared primitives.
- **Design tokens:** Semantic colors and radii live in `src/styles/tailwind.css` (`bg-background`, `text-primary`, `border-border`, status tokens like `bg-running`). Follow `design.md`; avoid raw palette classes (`text-white`, `bg-black`).
- **Legacy CSS:** Files under `src/styles/*.css` (except `tailwind.css` / `tailwind-components.css`) are migration leftovers. When touching a view, move its rules into Tailwind classes and delete the obsolete selectors.
- `src/styles.css` imports Tailwind first, then remaining legacy sheets until each view is migrated.
- Add shadcn components with `pnpm dlx shadcn@latest add <component>` from `apps/web`.

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
