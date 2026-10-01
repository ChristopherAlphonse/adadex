# Installation

Adadex is a local Node.js project with a local API and web UI.

## Requirements

- Node.js `22+`
- Kiro CLI (`kiro-cli`) for the supported workflow
- `git` for worktree terminals
- `gh` for GitHub pull request features
- `curl` for agent hook callbacks to this API

Docs and defaults assume **Kiro CLI** as the terminal agent.

## Local development install

```bash
npm install
npm run dev
```

## Local global CLI install from a clone

```bash
npm install
npm run build
npm install -g .
```

## npm registry install

Adadex is not published to the npm registry yet, so `npm install -g adadex` will fail with `404`.

## First run behavior

Running `adadex` inside a project directory will:

- create `.adadex/` if it does not exist
- add `.adadex` to `.gitignore` or create `.gitignore` when it is missing
- write a stable project ID to `.adadex/project.json`
- register the project under `~/.adadex/projects.json`
- move runtime state to `~/.adadex/projects/<project-id>/state/`
- choose an open local API port starting at `8787`
- open the browser unless `ADADEX_NO_OPEN=1`
- show a Deck setup card until the first coordination is created

## Startup rules

- startup fails if the `kiro-cli` CLI is not available
- startup warns when optional integrations like `git`, `gh`, or `curl` are missing

## Next step

- [Quickstart](quickstart.md)
