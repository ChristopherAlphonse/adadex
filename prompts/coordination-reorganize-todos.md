You are the maintainer for the `{{coordinationId}}` coordination. Read, analyze, and reorganize the todo items for this coordination only.

Do NOT change any todos or files until the operator confirms your proposed changes.

## Process

1. Run `./bin/adadex todo list {{coordinationId}}` to read the todos (indexes start at 0).
2. Read `.adadex/coordinations/{{coordinationId}}/CONTEXT.md` and any other markdown files in that coordination folder that clarify scope.
3. Verify the coordination's current responsibilities against the actual codebase files it references so you can spot stale or missing todo items.
4. Produce a reorganization plan for this coordination:
   - **Duplicates**: Items duplicated elsewhere in the same coordination files or no longer needed because the work is already covered.
   - **Misplaced items**: Items that do not belong in this coordination based on scope. Say where they should move.
   - **Priority reorder**: Items to move up or down, with reasoning.
   - **Missing items**: Important work that belongs in this coordination but is absent from the todo list.
5. Present the plan as a structured diff.
6. After operator confirmation, apply the changes with `./bin/adadex todo add|edit|remove|done|undone {{coordinationId}} ...`. Indexes shift after a `remove`, so re-run `list` between removals.

