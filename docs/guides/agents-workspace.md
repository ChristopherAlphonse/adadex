# Agents workspace

The Agents view is where you run and steer agent sessions from one screen.

## Layout

- **Agents rail** lists sessions grouped by coordination. Pin a session to keep it at the top, close it to stop
  tracking it, or delete it. **New agent** starts a session; the graph button opens the thread graph.
- **Chat workbench** shows the selected session as a conversation, with the composer at the bottom and side panels
  for inspection.
- Toolbar actions: scroll to the latest message, delegate to a child agent, create a worktree agent, and open Git
  actions. See [Orchestrating Child Agents](orchestrating-child-agents.md).

## Chat or terminal

Each session can be shown as **Chat** or **Terminal**. Switching changes only the view; it is the same running
agent. Chat reads the session transcript and refreshes every few seconds. Chat replies render
[question cards](asking-questions.md) and [visual cards](visual-replies.md), with long work collapsed into a summary
and an edited-files card.

## Composer shortcuts

| Key | Action |
| --- | --- |
| Enter | Send |
| Shift+Enter | New line |
| Cmd/Ctrl+Enter | Interrupt the agent and send |
| Tab | Queue the message until the agent is free |
| Esc, Esc (within 0.5 s) | Stop the agent |
| Option/Alt+S | Stash the draft |
| Ctrl+G | Expand or collapse the composer |
| `/btw <question>` | Open a side chat with another agent ([details](inter-agent-messaging.md)) |

## Model and effort

For a Claude agent, choose the model and effort when launching it. For an existing terminal, the values apply to its
**next** launch; they do not change a running agent. They are stored through
`PATCH /api/terminals/:terminalId/launch-options` (see [API](../reference/api.md)).

## Agent backend

Agents run in Adadex PTY terminals by default. In the desktop app, setting `ADADEX_GHOSTEX_AGENT` opts in to the Ghostex backend.
Ghostex agents bypass the tool guard and sandbox; read
[ADR 0001](../decisions/0001-runtime-and-orchestration.md) before using it for role-bound runs.
