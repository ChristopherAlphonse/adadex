# Claude Code — Project Instructions

## Maintenance Skill
Before any package upgrade, CI workflow change, or prompt template edit, read `.agents/skills/adadex-maintenance/SKILL.md`. It covers:
- Package upgrade protocol and post-upgrade verification order
- Biome v2 migration patterns and working config template
- TypeScript 6 deprecation fixes
- Stale test patterns (startup prerequisites, coordination prompts, nav indices)
- Template variable completeness rule (`{{variable}}` silently stays literal if not passed)
- GitHub Actions SHA pin verification
- Release workflow (GitHub Releases only — not npm)

## Quality Gate
All three must pass before committing: `pnpm lint && pnpm test && pnpm build`.
The pre-commit hook (Husky + lint-staged) auto-fixes formatting on staged files.

## Verification Order
For narrow changes: run the scoped test first (`pnpm --filter @adadex/api test`), then widen.
For cross-app or shared-contract changes: run root `pnpm test && pnpm build`.

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->
