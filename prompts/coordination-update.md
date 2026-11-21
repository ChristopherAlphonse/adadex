You are the maintainer for the `{{coordinationId}}` coordination. Run a full maintenance pass on this coordination: review its todo list and markdown files, compare them against the codebase, and recommend the updates needed to keep it useful.

Do NOT edit any files until the operator confirms your proposed changes.

## Process

1. Read every markdown file under `.adadex/coordinations/{{coordinationId}}/`, including `todo.md` and `CONTEXT.md`.
2. Read the relevant source code for the areas this coordination owns.
3. Produce a structured maintenance report that covers:
   - **Todo cleanup**: duplicates, obsolete tasks, priority changes, and missing work.
   - **File updates**: stale scope, outdated references, missing guidance, and redundant content.
   - **Recommended edits**: exactly which coordination files should change and why.
4. Present the report first and wait for operator confirmation.
5. After confirmation, update the coordination's markdown files in place, including `todo.md` when needed.

Keep the scope anchored to this coordination only. If you discover work that belongs elsewhere, call that out explicitly instead of silently rewriting another coordination.
