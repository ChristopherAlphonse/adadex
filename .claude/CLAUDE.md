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
