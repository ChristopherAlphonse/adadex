# Adadex Maintenance & Upgrade Checklist

Hard-won lessons from upgrading this monorepo. Run through this before every upgrade cycle.

---

## 1. Dependency Upgrade Protocol

### Before upgrading

```bash
pnpm audit --audit-level=high   # baseline CVE state
pnpm test                        # baseline test state
pnpm lint                        # baseline lint state
```

### Upgrade command

```bash
pnpm update --latest             # bumps all packages in all workspaces
```

### After upgrading — verify in this order

```bash
pnpm install --frozen-lockfile   # will FAIL if lockfile is stale — expected
pnpm install                     # regenerate lockfile
pnpm lint                        # catch config breakage first (fast)
pnpm test                        # catch logic breakage
pnpm build                       # catch type/compile breakage
```

---

## 2. Known Breaking Points Per Package

### Biome (any major version)

- `$schema` URL must match the installed version exactly.
- `organizeImports` moved: `organizeImports.enabled` → `assist.actions.source.organizeImports: "on"`.
- `files.ignore` removed: use `files.includes` with `!!` negation patterns OR `.biomeignore`.
- CSS linting added in v2 — existing CSS files will throw parse errors. Add to ignore: `"!!**/*.css"` if not actively linting CSS.
- Worktree directories (`.adadex/worktrees/`) must be excluded: add `"!!.adadex"` to `files.includes`.
- Run `pnpm biome migrate --write` first, then audit remaining errors.
- New `recommended` rules in each major: downgrade pre-existing violations to `"warn"` in biome.json rather than fixing them all at once.

### TypeScript (6.x+)

- `baseUrl` is deprecated. Add `"ignoreDeprecations": "6.0"` to `compilerOptions` in affected tsconfig files.

### pnpm/action-setup (GitHub Actions)

- SHA pins must be verified. Do NOT guess SHAs.
- Verify: `gh api repos/pnpm/action-setup/commits/v{VERSION} --jq '.sha'`
- Current verified: `v6.0.8` → `0e279bb959325dab635dd2c09392533439d90093`

### vitest (v2 → v4)

- `requestAnimationFrame` in jsdom is now synchronous — any component that loops via `rAF` will hit max call stack in tests.
- Fix: mock `requestAnimationFrame` in test setup or cancel the animation loop before/after each test.

---

## 3. Stale Test Patterns — What to Look For

After any source refactor, tests go stale silently. Check these:

### Startup prerequisites (`apps/api/tests/startupPrerequisites.test.ts`)

This project uses `collectStartupPrerequisiteReport`. When agent providers change (e.g., codex + claude multi-provider), update:
- `errors` expectations → check if something moved to `warnings`
- `warnings.map(i => i.command)` → verify command list matches source
- Test names → rename to reflect current behavior

### Coordination prompt (`apps/api/tests/createApiServer.test.ts`)

When `prompts/coordination-context-init.md` changes:
1. Check what variables the template uses (`{{coordinationName}}`, `{{coordinationDescription}}`, `{{coordinationContextPath}}`).
2. Verify `buildCoordinationInitialPrompt` in `terminalRoutes.ts` passes ALL variables.
3. Update `CONTEXT.md` content in test to avoid double-period artifacts (no trailing period in description).
4. Update expected `initialInputDraft` string.

### Navigation indices (`apps/web/tests/`)

Tests query nav buttons by `[N] Label` format. When nav items are added/removed:
- Update all `getByRole("button", { name: "[N] Label" })` queries.
- Check `PRIMARY_NAV_ITEMS` in `apps/web/src/app/constants.ts` for current indices.
- Update hint text expectations (`PRIMARY_NAV_KEY_HINT`).
- `Settings` index changed from 8 → 7 when Monitor was removed.

### RuntimeStatusStrip visibility

The strip is conditionally rendered based on `isRuntimeStatusStripVisible` state. Tests that call `findByLabelText("Runtime status strip")` will fail if the initial API state doesn't trigger visibility. Check what mock API response enables it.

---

## 4. Biome Config Template (current working state)

```json
{
  "$schema": "https://biomejs.dev/schemas/{VERSION}/schema.json",
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": { "noNonNullAssertion": "warn" },
      "correctness": { "noUnusedVariables": "warn", "noUnusedFunctionParameters": "warn" },
      "a11y": {
        "noStaticElementInteractions": "warn",
        "noSvgWithoutTitle": "warn",
        "useSemanticElements": "warn",
        "useAriaPropsForRole": "warn",
        "useAriaPropsSupportedByRole": "warn"
      },
      "suspicious": { "noArrayIndexKey": "warn" }
    }
  },
  "assist": { "actions": { "source": { "organizeImports": "on" } } },
  "files": {
    "includes": ["**", "!!**/dist", "!!**/coverage", "!!.adadex", "!!**/*.css"]
  }
}
```

---

## 5. Pre-commit Hook

Husky + lint-staged is configured. The hook runs `biome check --write` on staged files.  
Config lives in `.lintstagedrc`. Do not skip with `--no-verify` — fix the lint issue instead.

---

## 6. GitHub Actions SHA Pins

All actions must be pinned to commit SHAs (CICD-SEC-09). Verify with:

```bash
gh api repos/{owner}/{repo}/commits/{tag} --jq '.sha'
```

Dependabot (`dependabot.yml`) auto-updates SHA pins weekly — review those PRs promptly.

---

## 7. Release Workflow

Releases are manual: **Actions → Release → Run workflow → pick patch/minor/major**.

The workflow: quality gate (via `_quality.yml`) → bump `package.json` → commit + tag → build → tarball → GitHub Release.

Users download from the Releases tab — not npm.

No `NPM_TOKEN` secret needed. `GITHUB_TOKEN` (built-in) handles everything.

---

## 8. CI Quality Gate (`_quality.yml`)

The reusable workflow runs: `install → audit → lint → test → build`.

`pnpm audit --audit-level=high` will fail if a HIGH or CRITICAL CVE exists in the dependency tree. Resolve before merging — check dependabot PRs or run `pnpm audit --fix`.

---

## 9. Template Variable Completeness

When adding new `{{variables}}` to any file under `prompts/`, immediately check all callers of `resolvePrompt` that use that template and add the new variable to their `vars` object. Missing variables render as literal `{{variableName}}` in output and break tests silently.

Search: `grep -rn "resolvePrompt.*{template-name}" apps/api/src/`
