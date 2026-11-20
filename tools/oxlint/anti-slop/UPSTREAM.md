# anti-slop provenance

Vendored anti-slop Oxlint plugin. This copy is owned by this repository; upstream
does not publish an npm package, so these files are meant to be edited to match
local standards.

## Source

- Repository: https://github.com/dmmulroy/anti-slop
- Upstream commit reviewed and copied from: `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b` (2026-09-10)
- Plugin package version upstream: `0.1.2`
- Copied from `ChristopherAlphonse/reinvoice`, which vendored the same revision.

## Installed paths

| Path | Purpose |
| --- | --- |
| `tools/oxlint/anti-slop/index.ts` | Generic plugin, registered in the `jsPlugins` block of `.oxlintrc.json` as `anti-slop` |
| `tools/oxlint/anti-slop/effect/index.ts` | Opt-in Effect plugin, **not registered** |
| `tools/oxlint/anti-slop/vendor/eslint-stylistic/` | Comment-aware spacing engine, vendored under MIT (see its `UPSTREAM.md` and `LICENSE`) |

Test files were stripped by the installer; only production rule source is vendored.

## Local adaptations

- **Standalone Oxlint.** Adadex uses `oxlint` directly, so rule source imports
  `defineRule`, `eslintCompatPlugin`, and the AST types from `@oxlint/plugins`.
  Keep `@oxlint/plugins` pinned to the same exact version as `oxlint`.
- **`no-runtime-typeof` allows type predicates.** Adadex has no schema library at
  its input boundaries. The rule is configured with `allowInTypeGuards: true`,
  and boundary narrowing lives in named predicates in
  `packages/core/src/util/typeCoercion.ts`.
- **`no-module-mocking` is off.** The repository deliberately uses `vi.mock` in
  tests. Reinvoice disables this rule for a different, Vite+-specific reason.
- **Effect rules not enabled.** Adadex does not depend on Effect. Register
  `anti-slop-effect` only if Effect becomes a real direct dependency.
- **`require-readable-spacing` is autofixed by `oxlint --fix`.** Both lint and
  format configs ignore this directory so vendored source keeps its upstream
  style.

## Running checks

```bash
npm run lint       # oxlint && oxfmt --check
npx oxlint --fix   # apply autofixable spacing fixes
npm run format     # oxfmt
```
