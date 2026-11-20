# Desktop Guidelines

## Ownership
- `src/host`: the action host. It is the only place that turns a request into a run, and the only place that creates a human click.
- `src/jobs`: job state on disk and the executors for job actions.
- The Electron main process, windows and tray are added here later. Keep Electron imports out of `src/host` and `src/jobs` so they stay testable with no Electron installed.

## Rules
- A human-only action runs only after the main process shows a native confirmation. The renderer and agents can ask for it but can never supply the click.
- Never add an action that pushes or opens a PR. `@adadex/core` refuses to register one.
- Tests use temp directories and fakes. No test starts Electron, git or a real agent.
