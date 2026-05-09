# Filesystem Layout

Adadex splits files by ownership. Agent-facing project context stays in the workspace. Runtime-owned state stays in the per-project global state directory.

## Project-local files

`.adadex/` is created in the workspace (migrated from `.octogent/` on first run when legacy paths exist).

Main paths:

- `.adadex/project.json`
- `.adadex/coordinations/`
- `.adadex/worktrees/`

`project.json` holds the stable project ID used to find global state. The coordinations folder is intended for agent-readable markdown. Worktrees are generated execution checkouts and should not be treated as context storage.

Coordination example:

```text
.adadex/
  coordinations/
    api-backend/
      CONTEXT.md
      todo.md
      routes.md
```

`CONTEXT.md` may end with a managed `Suggested Skills` block when the operator or planner attaches Codex skills to that coordination.

Deck also writes UI metadata for coordinations, but not into these markdown files. Color, status, appearance, paths, and tags are stored in global deck state.

Project-local Codex skills, when present, live under:

```text
.codex/
  skills/
    some-skill/
      SKILL.md
```

## Global state

Per-project runtime state is stored under:

```text
~/.adadex/projects/<project-id>/state/
```

Notable files:

- `coordinations.json`
- `deck.json`
- `transcripts/<sessionId>.jsonl`
- `monitor-config.json`
- `monitor-cache.json`
- `code-intel.jsonl`

`coordinations.json` is the terminal registry. It stores terminal records, lifecycle state, UI state, parent-child links, workspace mode, worktree IDs, and display names.

`deck.json` stores Deck presentation metadata that is not part of the agent-facing coordination files.

`transcripts/*.jsonl` stores conversation transcript events separately from PTY scrollback. Scrollback is in memory and bounded; transcripts are persisted.

## Prompt storage

- core prompts are synced from `prompts/`
- synced copies live in `.adadex/prompts/core/`
- user prompts live in `.adadex/prompts/`

## Practical rule

If something is agent-facing context, keep it in the coordination folder.

If something is runtime-owned state, expect it under the global project state directory.

If something is an isolated execution checkout, expect it under `.adadex/worktrees/` and treat its branch lifecycle as part of the terminal that created it.
