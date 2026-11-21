# Troubleshooting

## `npm test` fails because of browser APIs

Make sure the workspace dependencies are installed from the repo root:

```bash
npm install
```

## Package resolution is broken

Run install from the repository root, not from a subpackage.

## Node version is too old

Use Node.js `22+`.

## Terminal startup fails

Check that your shell environment is available and executable.

If startup fails with `Terminal session limit reached`, Adadex already has the configured number of live PTY-backed sessions. Stop unused terminals with `adadex terminal stop <terminal-id>` or prune inactive records with `adadex terminal prune`. The default cap is 32; set `ADADEX_MAX_TERMINAL_SESSIONS` to a positive integer before starting Adadex to adjust it.

## Worktree terminal creation fails

Verify:

- `git --version` works
- the workspace is a git repository
- the current user can create worktrees in `.adadex/worktrees/`

## GitHub summary is unavailable

Verify:

```bash
gh auth status
```

## A terminal survived reload but not server restart

That is expected. PTY sessions can survive a reconnect window, but they do not survive an API restart.

After restart, terminals that were running show as `stopped` with reason `restart_pending` and start again when you open them. A terminal whose old process is still alive is marked `stale` instead, so a second agent is not started. Use `adadex terminal list` to inspect lifecycle state, `adadex terminal stop <terminal-id>` or `adadex terminal kill <terminal-id>` for a recorded process, and `adadex terminal prune` to remove stale, stopped, or exited records from the UI.
