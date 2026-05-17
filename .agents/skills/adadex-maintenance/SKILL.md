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

Nav buttons now render with `<span>Label</span><kbd>N</kbd>` (accessible name: `"Label N"`). When nav items are added/removed:
- Update all `getByRole("button", { name: /Label/i })` queries (use regex, not `[N] Label`).
- Check `PRIMARY_NAV_ITEMS` in `apps/web/src/app/constants.ts` for current indices (currently 1-7).
- `Settings` is index **7**. Mock `activePrimaryNav: 7` to render settings view.
- `parsePrimaryNavKey("8")` should return `null` (only 1-7 valid).

### RuntimeStatusStrip

The strip component exists but is **NOT mounted** in the App layout. The sparkline section is commented out. Do NOT add test assertions for `findByLabelText("Runtime status strip")` in App-level tests. The component can still be tested standalone without sparklinePoints (that prop was removed).

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
      "style": {
        "noNonNullAssertion": "warn",
        "noDescendingSpecificity": "warn"
      },
      "correctness": {
        "noUnusedVariables": "warn",
        "noUnusedFunctionParameters": "warn"
      },
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
  "css": { "parser": { "cssModules": true } },
  "files": {
    "includes": ["**", "!!**/dist", "!!**/coverage", "!!.adadex"]
  },
  "overrides": [
    {
      "includes": ["apps/web/src/styles/**"],
      "linter": { "enabled": false },
      "formatter": { "enabled": false }
    }
  ]
}
```

**Key insight:** Excluding CSS via `files.includes` negation (`!!**/tailwind.css`) does NOT suppress parse errors. Use an `overrides` block that covers the entire styles directory.

---

## 5. Pre-commit Hook

Husky + lint-staged auto-fixes lint and formatting on every commit. Never skip with `--no-verify`.

### How it works

1. `pnpm install` runs `"prepare": "husky"` → installs git hooks automatically.
2. On commit, `.husky/pre-commit` runs `pnpm exec lint-staged`.
3. lint-staged applies `biome check --write --unsafe` to staged JS/TS/JSON files and `biome format --write` to CSS files.
4. Fixed files are re-staged automatically before the commit completes.

### Config files

- `.husky/pre-commit` — hook entry point
- `.lintstagedrc` — maps file globs to Biome commands
- `package.json` `"prepare": "husky"` — auto-installs hooks on `pnpm install`

### lint-staged config (`.lintstagedrc`)

```json
{
  "*.{js,ts,jsx,tsx,json,jsonc}": ["biome check --write --unsafe --no-errors-on-unmatched"],
  "*.css": ["biome format --write --no-errors-on-unmatched"]
}
```

### Key flags

- `--write` — applies safe auto-fixes (formatting, import sorting) in place.
- `--unsafe` — also applies unsafe lint fixes (e.g., removing unused variables, prefixing with `_`).
- `--no-errors-on-unmatched` — prevents failure when staged files don't match Biome's include patterns.

### Troubleshooting

- If a commit is blocked, it means Biome found an error it cannot auto-fix (e.g., a parse error). Fix the source, don't skip the hook.
- If hooks stop running after a fresh clone, run `pnpm install` — the `prepare` script re-installs husky.
- Husky v9+ does not need shebangs in hook files.

---

## 6. Lint & Format — Recurring Fix Patterns

Before every PR or after any refactor, run `pnpm lint` and address issues. These are the patterns that recur in this codebase.

### Unused variables and parameters

Biome flags destructured values that are no longer referenced (often after removing a feature or commenting out JSX). Fix by:
- Removing the destructured binding entirely if nothing uses it.
- Removing the import if the binding was the only consumer.
- Prefixing with `_` only if the parameter is required by a callback signature.

Common locations: `App.tsx` (hook return values), component prop destructuring, type aliases.

### Duplicated logic in module-level functions

`forEach` callbacks that implicitly return a value trigger `useIterableCallbackReturn`. Refactor to `for...of` loops or extract a `notify()` helper. Example: `Toast.tsx` had four identical toast methods — consolidate into a single `addToast(type, message)` function.

### a11y rules on SVG and interactive visualizations

This codebase has visualization-heavy components (treemaps, arc diagrams, heatmaps, canvas nodes) that legitimately use mouse handlers on `<div>`, `<g>`, and `<svg>` elements. These trigger:
- `noStaticElementInteractions` — add `role="button"` or `role="img"` only when semantically correct; otherwise leave as warning.
- `noSvgWithoutTitle` — decorative SVGs already have `aria-hidden`; Biome still flags them. Leave as warning.
- `useAriaPropsSupportedByRole` — `aria-label` on plain `<div>` needs a `role` attribute to be valid. Add `role="region"` or `role="group"` when the label is meaningful.

These rules are set to `"warn"` in `biome.json` — they will not block commits but should be addressed when touching those files.

### CSS specificity and Tailwind parse errors

- `noDescendingSpecificity` — fires when a less-specific selector appears after a more-specific one. Set to `"warn"`. Address during CSS migration to Tailwind.
- Tailwind v4 uses `@source`, `source()`, `@theme`, and `@utility` directives that Biome's CSS parser cannot parse. These files (`tailwind.css`, `tailwind-components.css`) are excluded from Biome entirely via `files.includes` negation patterns (`!!**/tailwind.css`).
- Biome overrides cannot suppress **parse** errors — only `files.includes` exclusion works.
- Experimental CSS like `r: attr(r + 2)` (CSS Level 5 `attr()` with type coercion) is not browser-supported. Replace with `transform: scale()` or explicit values.

### Non-null assertions

`noNonNullAssertion` is set to `"warn"`. When you see `array[0]!`, prefer a guard or `at(0)` with a fallback. In test files, `!` on known-populated arrays is acceptable.

---

## 7. GitHub Actions SHA Pins

All actions must be pinned to commit SHAs (CICD-SEC-09). Verify with:

```bash
gh api repos/{owner}/{repo}/commits/{tag} --jq '.sha'
```

Dependabot (`dependabot.yml`) auto-updates SHA pins weekly — review those PRs promptly.

---

## 8. Release Workflow

Releases are manual: **Actions → Release → Run workflow → pick patch/minor/major**.

The workflow: quality gate (via `_quality.yml`) → bump `package.json` → commit + tag → build → tarball → GitHub Release.

Users download from the Releases tab — not npm.

No `NPM_TOKEN` secret needed. `GITHUB_TOKEN` (built-in) handles everything.

---

## 9. CI Quality Gate (`_quality.yml`)

The reusable workflow runs: `checkout → actionlint → install → audit → lint → test → build`.

- **actionlint** validates all workflow YAML (runs as Docker: `rhysd/actionlint:1.7.12`).
- `pnpm audit --audit-level=high` will fail if a HIGH or CRITICAL CVE exists in the dependency tree. Resolve before merging — check dependabot PRs or run `pnpm audit --fix`.
- The CI quality gate uses `permissions: contents: read` (least privilege). Individual jobs escalate only when needed (`pull-requests: write` for dependency-review).

---

## 10. Template Variable Completeness

When adding new `{{variables}}` to any file under `prompts/`, immediately check all callers of `resolvePrompt` that use that template and add the new variable to their `vars` object. Missing variables render as literal `{{variableName}}` in output and break tests silently.

Search: `grep -rn "resolvePrompt.*{template-name}" apps/api/src/`

---

## 11. Pre-Edit Checklist (run before every change)

Before modifying any source file, verify:

1. `pnpm lint` exits 0 (only warnings, no errors).
2. Remove unused destructured bindings — don't leave dead variables from prior refactors.
3. Remove unused imports — Biome's `organizeImports` handles ordering but not removal of dead imports.
4. Check that commented-out JSX blocks don't reference variables that appear "used" to grep but are dead to the compiler.
5. After editing, run `pnpm biome check --write --unsafe .` to auto-fix what you can before committing.
6. The pre-commit hook handles staged files automatically, but catching issues earlier avoids noisy diffs.

---

## 12. Git Hygiene — Tracked vs Ignored

### Problem pattern

Adding a path to `.gitignore` does **NOT** remove already-tracked files. GitHub will still show them until you:

```bash
git rm -r --cached <path>
git commit -m "chore: stop tracking <path>"
git push
```

### Paths that MUST stay ignored and untracked

| Path | Why |
|------|-----|
| `.cursor/` | IDE state, hooks, plans — machine-local |
| `.planning/` | Internal roadmap/phase plans — not published |
| `.agents/` | Installed agent skills — machine-local |
| `skills-lock.json` | Skill install manifest with per-machine hashes |
| `.adadex/` | Runtime project state |
| `.env` / `.env.*` | Secrets |

### Verification after adding to `.gitignore`

```bash
git ls-files '<path>'         # must return empty
git check-ignore -v '<path>'  # must show the ignore rule
```

If `git ls-files` shows results, run `git rm -r --cached <path>`.

### Historical blobs

Old commit SHAs still expose the file. To fully purge:

```bash
git filter-repo --invert-paths --path <path>
git push --force-with-lease
```

Only do this for secrets. For internal docs, ignoring + untracking is sufficient.

---

## 13. CSS and Biome — Parse Errors vs Lint Warnings

### Root cause

Biome's CSS parser cannot handle PostCSS / Tailwind v4 directives (`@source`, `@theme`, `@utility`, `@custom-variant`, `@apply`). These are **parse errors** (exit code 1), not lint warnings.

### Fix

Biome `overrides` with `"linter": { "enabled": false }` does NOT suppress parse errors. You must:

- Exclude entire directories: `"includes": ["apps/web/src/styles/**"]` in an override block with both `linter` and `formatter` disabled, OR
- Use `files.includes` with `!!` negation: `"!!**/tailwind.css"`.

### Current working override

```json
"overrides": [
  {
    "includes": ["apps/web/src/styles/**"],
    "linter": { "enabled": false },
    "formatter": { "enabled": false }
  }
]
```

This exempts all legacy CSS and Tailwind files under `src/styles/` from biome processing entirely.

---

## 14. Test Alignment After UI Refactors

### Accessible name changes

When nav components are refactored (e.g., `ConsolePrimaryNav` → `ConsoleChromeHeader`):

- Old pattern: `<button>[{index}] {label}</button>` → accessible name `"[3] Activity"`
- New pattern: `<button><span>{label}</span><kbd>{index}</kbd></button>` → accessible name `"Activity 3"`

Tests using `getByRole("button", { name: "[N] Label" })` must update to regex: `{ name: /Label/i }`.

### aria-current on active nav

If a refactored component drops `aria-current="page"`, add it back:

```tsx
<button aria-current={active ? "page" : undefined} ...>
```

Tests depend on this for navigation state assertions.

### Removed components from layout

When a component (e.g., `RuntimeStatusStrip`) is removed from the render tree:

1. Remove all `findByLabelText("Runtime status strip")` assertions in tests.
2. Remove related data assertions (sparkline, usage charts) if the section is commented out.
3. Update prop types in test files if a prop was removed from the component type.

### requestAnimationFrame in tests

Components using animation loops (`AgentGlyph`) call `requestAnimationFrame` recursively. A synchronous mock causes infinite recursion:

```tsx
// BAD — infinite loop
vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => { cb(0); return 1; });

// GOOD — schedules async to break the loop
vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
  setTimeout(() => cb(0), 0);
  return ++id;
});
```

### localStorage in jsdom tests

`vi.unstubAllGlobals()` (from `resetAppTestHarness`) can corrupt jsdom's built-in `localStorage`. If tests use localStorage:

```tsx
beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    value: createLocalStorageMock(),
    writable: true,
    configurable: true,
  });
});
```

### Settings nav index

Settings is at index **7** (not 8). When mocking `GET /api/ui-state` with `activePrimaryNav` to show the settings view, use `7`.

---

## 15. Dependabot Limits

### `open-pull-requests-limit`

This caps **simultaneously open** Dependabot PRs per ecosystem — not "PRs per day."

- npm: `5` (was 15 — caused PR backlog)
- github-actions: `5`

Combined worst-case: 10 open PRs total.

### No "per day" throttle exists

GitHub does not support "max 2 PRs per day." Approximation: `interval: daily` + `open-pull-requests-limit: 2`. Current config uses `interval: weekly` which batches checks to Monday UTC.

---

## 16. CI Workflow Hardening

### Permissions

Never use `permissions: read-all`. Specify exactly what's needed:

```yaml
permissions:
  contents: read      # default for checkout
  pull-requests: write  # only for dependency-review-action
```

### Action pinning

All actions pinned to full SHA + comment with version tag:

```yaml
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
```

### actionlint gate

The quality workflow runs `rhysd/actionlint:1.7.12` in Docker to validate all workflow YAML before the real CI steps. Invoke from repo root with no path args (auto-discovers `.github/workflows/`).

---

## 17. Post-Session Verification Protocol

After ANY maintenance session, before pushing, run this exact sequence:

```bash
pnpm lint          # exit 0, warnings only
pnpm test          # all tests pass
pnpm build         # no type errors
git status         # no accidentally tracked secrets or IDE state
git ls-files '.cursor' '.planning' '.agents' 'skills-lock.json'  # must be empty
```

If `git ls-files` shows any of those paths, run `git rm -r --cached <path>` before committing.
