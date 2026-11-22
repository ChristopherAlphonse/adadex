# Installation

Adadex is a local Node.js project with a local API and web UI.

## Preferred: Docker

Run Adadex in the Docker sandbox. It bundles the agent CLIs and keeps them, and the npm packages they depend on, away from your files, credentials and the open internet.

Requires Docker with Compose (Docker Desktop, OrbStack or similar), installed and running, plus `git`.

```bash
git clone https://github.com/ChristopherAlphonse/adadex.git
cd adadex                                                  # run the next commands from this folder
export ADADEX_WORKSPACE=/absolute/path/to/your-project-clone
docker compose up --build
```

Then open <http://127.0.0.1:8787>. See the [Docker Sandbox guide](../guides/docker-sandbox.md). The installs below run unsandboxed and are meant for developing Adadex itself.

## Requirements

- Node.js `22+`
- at least one agent CLI: Claude Code (`claude`, the default), Kiro CLI (`kiro-cli`) or OpenCode (`opencode`)
- `git` for worktree terminals
- `gh` for GitHub pull request features
- `curl` for agent hook callbacks to this API

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

- startup warns, but does not fail, when no agent CLI is found
- startup warns when optional integrations like `git`, `gh`, or `curl` are missing

## Next step

- [Quickstart](quickstart.md)
