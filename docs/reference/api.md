# API Reference

Adadex exposes a local HTTP and WebSocket API.

The API has two different kinds of state:

- persisted project state, such as terminal records, Deck metadata, UI state, and transcripts
- in-memory runtime state, such as live PTYs, attached WebSockets, and scrollback

Most HTTP routes either read/write persisted files or create runtime records. WebSocket routes attach clients to live PTY sessions owned by the API process.

## Terminals

- `GET /api/terminal-snapshots` - returns the current terminal list and snapshot state for the UI
- `POST /api/terminals` - creates a new terminal session
- `POST /api/terminals/prune` - removes terminal records with `stale`, `stopped`, or `exited` lifecycle state
- `PATCH /api/terminals/:terminalId` - updates terminal metadata such as the display name
- `PATCH /api/terminals/:terminalId/launch-options` - updates `agentModel` / `agentEffort` for the terminal's next agent launch; an empty string clears a flag
- `DELETE /api/terminals/:terminalId` - removes a terminal and closes its active session
- `POST /api/terminals/:terminalId/stop` - stops an active session or recorded stale process
- `POST /api/terminals/:terminalId/kill` - kills an active session or recorded stale process
- `POST /api/terminals/:terminalId/approval` - answers a pending permission prompt with `{ "decision": "approve" | "deny" }`; only accepted from the Adadex web page (requests without an `Origin` header get `403`), and `409` when nothing is pending
- `WS /api/terminals/:terminalId/ws` - streams live terminal IO over WebSocket

Terminal snapshots include `lifecycleState` when known. Supported lifecycle states are `registered`, `running`, `stopped`, `exited`, and `stale`. Stale terminals are records that were persisted as running but could not be reattached to a live Adadex PTY session after startup.

Creating a terminal registers metadata first. A PTY starts immediately only when an initial prompt is provided, a WebSocket attaches, or an internal direct listener starts the session. Worktree terminals also create their worktree before the terminal record is exposed.

## Git and worktrees

- `GET /api/coordinations/:coordinationId/git/status` - reads git status for a worktree-backed coordination
- `POST /api/coordinations/:coordinationId/git/commit` - creates a commit from the coordination worktree
- `POST /api/coordinations/:coordinationId/git/push` - pushes the coordination branch
- `POST /api/coordinations/:coordinationId/git/sync` - syncs the coordination worktree with its base branch
- `GET /api/coordinations/:coordinationId/git/pr` - reads pull request information for the coordination branch
- `POST /api/coordinations/:coordinationId/git/pr/merge` - merges the coordination pull request

## Deck and coordinations

- `GET /api/deck/skills` - lists available skills discovered from project-local `.kiro/skills/<skill>/SKILL.md` entries
- `GET /api/deck/coordinations` - lists coordinations with metadata, vault files, and todo progress
- `POST /api/deck/coordinations` - creates a new coordination
- `PATCH /api/deck/coordinations/:coordinationId` - updates Deck display metadata such as color and mascot
- `DELETE /api/deck/coordinations/:coordinationId` - deletes a coordination and its stored files
- `PATCH /api/deck/coordinations/:coordinationId/skills` - updates the coordination's suggested skills and rewrites the managed block in `CONTEXT.md`
- `PATCH /api/deck/coordinations/:coordinationId/agent` - sets the agent provider (`claude`, `kiro`, or `opencode`) for the coordination's terminals
- `GET /api/deck/coordinations/:coordinationId/todo` - lists the coordination's todo items
- `POST /api/deck/coordinations/:coordinationId/todo` - adds a todo item
- `PATCH /api/deck/coordinations/:coordinationId/todo/toggle` - marks a todo item done or undone
- `PATCH /api/deck/coordinations/:coordinationId/todo/edit` - edits the text of a todo item
- `POST /api/deck/coordinations/:coordinationId/todo/delete` - deletes a todo item
- `POST /api/deck/coordinations/:coordinationId/todo/solve` - starts one worker terminal for one todo item
- `GET /api/deck/coordinations/:coordinationId/files/:filename` - reads one markdown file from the coordination vault
- `POST /api/deck/coordinations/:coordinationId/swarm` - spawns worker terminals from incomplete todo items

Deck routes treat `.adadex/coordinations/<coordination-id>/` as the source of truth for agent-facing context. Todo item operations update `todos.json` by item index. Vault files are read-only through the API. Swarm operations derive worker assignments from incomplete parsed todo items.

## Prompts

- `GET /api/prompts` - lists available prompt templates
- `POST /api/prompts` - creates a user prompt
- `GET /api/prompts/:promptId` - reads one prompt
- `PUT /api/prompts/:promptId` - updates one prompt
- `DELETE /api/prompts/:promptId` - deletes one prompt

## Channels

- `GET /api/channels/:terminalId/messages` - lists messages for one terminal channel
- `POST /api/channels/:terminalId/messages` - sends a message to one terminal channel

Channel messages are queued and saved to disk. The POST body provides `fromTerminalId` and `content`; delivery injects pending messages into the target terminal input when the target session is idle.

## Code intel

- `POST /api/code-intel/events` - records one code-intel event
- `GET /api/code-intel/events` - returns the stored code-intel event log

## Hooks

- `POST /api/hooks/:hookName` - ingests lifecycle events coming from agent hooks

Current hook names:

- `session-start`
- `user-prompt-submit`
- `pre-tool-use`
- `notification`
- `stop`

## Usage and telemetry

- `GET /api/github/summary` - returns GitHub summary and repo telemetry data
- `GET /api/analytics/usage-heatmap?scope=all|project` - returns heatmap aggregates when session history is available

## UI state

- `GET /api/ui-state` - reads the persisted UI state for the current project
- `PATCH /api/ui-state` - updates the persisted UI state

## Workspace setup

- `GET /api/setup` - reads the verified first-run setup status for the current workspace
- `POST /api/setup/steps/:stepId` - runs one setup step and returns the refreshed setup snapshot

## Conversations

- `GET /api/conversations` - lists stored conversations
- `DELETE /api/conversations` - deletes all stored conversations
- `GET /api/conversations/search?q=...` - searches conversations by text
- `GET /api/conversations/:sessionId` - reads one conversation in full
- `GET /api/conversations/:sessionId/chat` - returns the session as chat messages (`{ messages }`) for the Chat view
- `GET /api/conversations/:sessionId/stats` - returns usage stats for one conversation
- `GET /api/conversations/:sessionId/export?format=json|md` - exports one conversation as JSON or Markdown

## Request limits and defaults

- JSON request bodies are capped at `1 MiB`
- invalid JSON returns `400`
- unsupported methods return `405`
- the server binds to loopback by default
