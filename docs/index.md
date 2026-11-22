# Adadex Docs

These docs are written for contributors and future coding agents. They explain how Adadex is put together, where state lives, and how local terminal agents are coordinated.

Adadex has three main layers:

- **agent-facing files** in `.adadex/coordinations/<coordination-id>/`, which hold context, todos, and handoff notes
- **runtime state** under `~/.adadex/projects/<project-id>/state/`, which tracks terminals, UI state, transcripts, and app metadata
- **live sessions** in the API process, where WebSocket connections are attached to PTY-backed agent CLI terminals (Claude Code by default, or Kiro CLI or OpenCode)

## Start here

- [Installation](getting-started/installation.md)
- [Quickstart](getting-started/quickstart.md)
- [Mental Model](concepts/mental-model.md) explains the boundaries between coordinations, terminals, worktrees, and runtime state

## Concepts

- [Coordination](concepts/coordination.md) explains the file-backed context model and how Deck reads it
- [Runtime and API](concepts/runtime-and-api.md) explains terminal lifecycle, WebSockets, hooks, persistence, and restart behavior

## Guides

- [Agents Workspace](guides/agents-workspace.md) explains the rail, chat/terminal switching, composer shortcuts, and launch options
- [Asking Questions](guides/asking-questions.md) and [Visual Replies](guides/visual-replies.md) explain the question and visual cards an agent can show in chat
- [Docker Sandbox](guides/docker-sandbox.md) explains the sandboxed way to run Adadex
- [Working With Todos](guides/working-with-todos.md) explains how checkbox lines become progress and worker inputs
- [Orchestrating Child Agents](guides/orchestrating-child-agents.md) explains parent/worker spawning, shared mode, and worktree mode
- [Inter-Agent Messaging](guides/inter-agent-messaging.md) explains the channel queue and delivery rules

## Reference

- [CLI](reference/cli.md)
- [Filesystem Layout](reference/filesystem-layout.md)
- [API](reference/api.md)
- [Troubleshooting](reference/troubleshooting.md)

## Desktop app (in progress)

The pages above describe the web app and local API. An Electron desktop app (`apps/desktop`) is in progress and does not replace them yet.

## Contributor policy

- [Contributing](../CONTRIBUTING.md)
