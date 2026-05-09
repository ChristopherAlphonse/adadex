# CLI Reference

## Start the dashboard

```bash
adadex
```

Starts the local API for the current project and opens the UI when bundled web assets are present.

If the current directory has not been initialized yet, `adadex` also creates or updates the local `.adadex/` scaffold automatically on first run.

## Initialize a project

```bash
adadex init [project-name]
```

Creates or updates the `.adadex/` scaffold in the current directory without starting the dashboard.

Use this when you want to initialize the project explicitly or set the project display name ahead of time. In normal use, running `adadex` inside the codebase is enough to initialize and start the app.

## List registered projects

```bash
adadex projects
```

## Create a coordination

```bash
adadex coordination create <name> --description "API runtime and routes"
```

`adadex tentacle create` remains available as an alias for compatibility. Adadex must already be running for this command.

## List coordinations

```bash
adadex coordination list
```

`adadex tentacle list` remains available as an alias.

## Create a terminal

```bash
adadex terminal create [options]
```

Options:

- `--name`, `-n`: terminal display name
- `--workspace-mode`, `-w`: `shared` or `worktree`
- `--initial-prompt`, `-p`: raw initial prompt text
- `--terminal-id`: explicit terminal ID
- `--coordination-id`: existing coordination ID to attach to (legacy: `--tentacle-id`)
- `--worktree-id`: explicit worktree ID
- `--parent-terminal-id`: parent terminal ID for child terminals
- `--prompt-template`: prompt template name
- `--prompt-variables`: JSON object of prompt template variables

## List terminals

```bash
adadex terminal list
```

Shows each terminal ID, lifecycle state, recorded process ID when available, lifecycle reason, and display name.

## Stop or kill a terminal

```bash
adadex terminal stop <terminal-id>
adadex terminal kill <terminal-id>
```

`stop` closes an active session or sends `SIGTERM` to the recorded process for a stale terminal. `kill` uses `SIGKILL`.

## Prune inactive terminal records

```bash
adadex terminal prune
```

Removes terminal records whose lifecycle state is `stale`, `stopped`, or `exited`. It does not remove active sessions.

## Send a message

```bash
adadex channel send <terminal-id> "message"
```

Use `--from <terminal-id>` when sending on behalf of a worker or parent terminal. If `--from` is omitted, the CLI falls back to `ADADEX_SESSION_ID` (or legacy `OCTOGENT_SESSION_ID`) when the command is running inside an Adadex-managed terminal.

## List messages

```bash
adadex channel list <terminal-id>
```
