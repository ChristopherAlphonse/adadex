# Coordination

Coordinations are the core abstraction in Adadex.

## What a coordination is

A coordination is a folder under `.adadex/coordinations/<coordination-id>/` that stores agent-readable markdown files.

The minimum useful files are:

- `CONTEXT.md`
- `todo.md`

Additional markdown files are allowed and are surfaced as coordination vault files in the app.

The important part is that the folder is agent-facing. It is the durable context that a terminal agent can read, edit, and hand off to another terminal.

## How Deck reads a coordination

Deck does not maintain a separate database copy of the coordination context. It scans `.adadex/coordinations/` and derives most of the view from files:

- a folder is considered a coordination only when it contains `CONTEXT.md`
- the first `# Heading` in `CONTEXT.md` becomes the display name
- the first non-empty paragraph after that heading becomes the description
- every other `.md` file becomes a vault file, with `todo.md` sorted first
- checkbox lines in `todo.md` become progress and worker inputs

Deck-specific metadata such as color, status, deck mascot appearance, paths, and tags lives separately in runtime state. That keeps UI preferences out of the agent-facing markdown files.

## What a coordination is for

Use a coordination when one slice of the codebase or one track of work needs its own local operating context.

Examples:

- API runtime
- frontend shell
- prompt system
- monitor integration
- release work

## What goes in `CONTEXT.md`

`CONTEXT.md` should explain:

- what this area owns
- the important files or directories
- what already exists
- constraints and edge cases
- what not to break
- any Codex skills that are especially useful for this coordination, when relevant

The first heading and first non-empty paragraph are runtime-significant. Keep them stable and useful because they become the name and description shown in Deck, Canvas, prompt summaries, and terminal creation flows.

When a coordination has suggested Codex skills, Adadex appends a managed block at the bottom of `CONTEXT.md`:

```md
<!-- adadex:suggested-skills:start -->
## Suggested Skills

You can use these skills if you need to.

- `skill-name`
<!-- adadex:suggested-skills:end -->
```

The managed block is rewritten by the API when suggested skills change. Put human-authored architecture notes outside that block.

Legacy workspaces may still contain `<!-- octogent:suggested-skills:* -->` markers; the API accepts both during migration.

## What goes in `todo.md`

`todo.md` should contain markdown checkbox items:

```md
# Todo

- [ ] add request validation for monitor config
- [ ] cover the invalid payload case in tests
- [x] wire the route into the request handler
```

The runtime parses checkbox lines and computes progress.

Only lines that match `- [ ] text` or `- [x] text` are treated as todo items. Their order matters because swarm creation uses the parsed item index when it creates worker terminal IDs such as `<coordination-id>-swarm-0`.

When the UI toggles, edits, adds, or deletes todos, it rewrites `todo.md`. There is no hidden todo store.

## Coordinations and delegation

The point of a coordination is not only documentation. It is operational context.

A worker attached to a coordination can:

- read local notes first
- stay scoped to that area
- use the todo list as a work queue
- hand work to child agents without rebuilding context from scratch

When a todo item is solved from Deck, Adadex reads the item text, resolves a worker prompt template, and creates a terminal attached to the same coordination. For swarm runs, incomplete todo items become workers, and larger swarms get a parent coordinator terminal that supervises completion.

## Coordinations and worktrees

Coordinations are not the same thing as worktrees.

- a coordination is a context folder
- a worktree is an isolated git checkout for a terminal

You can use a coordination with shared workspace terminals or worktree terminals.

In shared mode, all terminals operate in the main workspace, so the context boundary is social and procedural. In worktree mode, each terminal can get a separate checkout under `.adadex/worktrees/`, but it still reads the same coordination folder for instructions and todos.

## Failure boundaries

- deleting a coordination removes its agent-facing files, but terminal records are separate runtime state
- restarting the API preserves terminal metadata and transcripts but not live PTYs
- channel messages do not persist, so durable handoffs belong in coordination markdown
- worktree branches are tied to worktree-backed terminals, not to the coordination folder itself
