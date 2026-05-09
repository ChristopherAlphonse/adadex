# Working With Todos

Todos are the operational center of a coordination.

## How todo parsing works

Adadex reads `todo.md` directly. It does not copy todo state into a separate store.

Only markdown checkbox lines are parsed:

```md
# Todo

- [ ] inspect websocket reconnect path
- [ ] add regression test for idle grace handling
- [ ] update runtime docs
```

The parser recognizes:

- `- [ ] text` as incomplete
- `- [x] text` or `- [X] text` as complete

Other markdown is allowed for notes, but it is ignored by the progress parser. Todo item identity is positional: the first parsed checkbox line is index `0`, the next is index `1`, and so on.

## Good todo items

Good todo items are:

- specific
- testable
- narrow enough for one agent
- written so they still make sense without extra chat history

Bad todo items are vague and force the agent to rediscover the assignment.

Because worker prompts are generated from todo text, each item should carry enough scope to be executed alone. Put broader architecture, constraints, and ownership notes in `CONTEXT.md`; put the specific action in `todo.md`.

## Authoring pattern

- keep one coordination per work area
- keep one `todo.md` per coordination
- write tasks at the level of one child-agent assignment
- keep order meaningful because swarm overflow is truncated by todo order
- mark items done in the file or through the UI, which rewrites the file

## How todos drive execution

The Deck runtime uses the same parsed list for three different workflows:

- progress display in the coordination card
- single-item solve, where one todo item becomes one worker terminal
- swarm creation, where incomplete items become worker assignments

For a single-item solve, Adadex creates a terminal ID like `<coordination-id>-todo-<item-index>` and starts a shared-workspace worker prompt for that item.

For a swarm, Adadex filters incomplete items, optionally narrows them to requested indices, caps the batch at the parent-child limit, then creates worker IDs like `<coordination-id>-swarm-<item-index>`. If there is more than one worker, it creates a parent coordinator terminal instead of starting all workers directly from the API. The parent prompt contains the worker creation commands and completion strategy.

## Editing and drift

When the UI toggles, edits, adds, or deletes a todo, it rewrites `todo.md`. Manual edits are also valid, but they can change item indices. Avoid reordering todos while a solve agent or swarm is active unless the coordinator knows about the change.

Workers should not mark their own item done unless the assigned task explicitly requires it. In the swarm flow, the coordinator or human reviewer should update `todo.md` after reviewing the combined result.

## Example

```md
# Todo

- [ ] add API route for terminal rename
- [ ] test invalid terminal ids
- [ ] document rename flow in CLI reference
```

This gives you three clean delegation units instead of one oversized prompt.
