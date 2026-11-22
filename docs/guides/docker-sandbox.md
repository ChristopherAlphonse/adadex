# Run Adadex in a Docker sandbox

Adadex and the agent CLIs it drives (Claude Code, Codex, OpenCode, Kiro) pull in many npm packages. Any of them can be compromised. This setup runs all of it in a container that cannot reach your files, your credentials, or the open internet.

## Start

```bash
export ADADEX_WORKSPACE=/absolute/path/to/a-dedicated-clone   # the only folder the agents can touch
docker compose up --build
```

Open <http://127.0.0.1:8787>. The port is published on loopback only.

Sign in to each agent once from the Adadex terminal (`claude`, `codex login --device-auth`, `opencode auth login`, `kiro-cli login`). Logins are stored in the `adadex-home` Docker volume, not on your host. Stop with `docker compose down`; add `-v` to also delete logins and state.

## What it enforces

| Boundary | How |
| --- | --- |
| Filesystem | Root filesystem read-only. Writable: `/workspace` (your chosen folder), the `adadex-home` volume, a 1 GB `/tmp`. No host home, no `~/.ssh`, no Docker socket. |
| Privileges | Runs as UID 10001. All Linux capabilities dropped. `no-new-privileges`. PID, memory and CPU limits. |
| Network out | The app sits on an `internal` Docker network with no route out. It reaches the internet only through the `egress` proxy, which allows HTTPS to the domains in `docker/edge/allowlist.txt` and refuses everything else, including plain HTTP and raw IPs. |
| Network in | Only the `gateway` container publishes a port, bound to `127.0.0.1`. Adadex keeps its Host and Origin checks on (`ADADEX_ALLOW_REMOTE_ACCESS` is not set). |
| Supply chain | Base images pinned by digest. Adadex and the agent CLIs install from lockfiles with `--ignore-scripts`. Only node-pty is compiled, and the two vendor CLIs only link their prebuilt binary. Dependencies download in one step; compiling node-pty and the whole Adadex build then run with `--network=none`, so a compromised build tool has nowhere to send anything. Kiro is pinned with a sha256 per architecture. The final image has no compiler. |

Verified on Docker Desktop (arm64): `api.anthropic.com` and `registry.npmjs.org` pass; `example.com`, `s3.amazonaws.com` and plain HTTP are refused for both `curl` and Node `fetch`; a bad `Host` header gets 403; capabilities are all zero; `/etc` and `/opt` are read-only.

## What it does not protect

State these to anyone you share this with:

- **The workspace is read-write.** A compromised agent can edit or delete anything in it, including `.git/config`. `.git/hooks` is mounted read-only, so hooks cannot be planted, which means the workspace must be a git clone. Use a dedicated clone, and review the diff and `.git/config` before you run git or any script on the host.
- **Allowed domains are exfiltration paths.** GitHub, npm and the model APIs are reachable, so data in the workspace or the `adadex-home` volume can leave through them. Keep the allowlist short and keep production secrets out of the workspace.
- **Agent logins live in the volume** and are readable by anything running in the container. Use accounts and API keys with the least access you can.
- **Docker is a container boundary, not a VM.** A kernel or runtime escape would bypass all of this. For hostile code, prefer a microVM such as Docker Sandboxes (`sbx`).
- **Kiro's allowed hosts are a best effort.** Check `docker compose logs egress` for `TCP_DENIED` on first login and add only what is needed.
- **Codex is installed but Adadex cannot drive it yet.** Adadex's agent providers are `claude`, `opencode` and `kiro`. Codex is available as a command in the Adadex terminal.

## Offline mode

```bash
docker compose -f docker-compose.yml -f docker-compose.offline.yml up
```

No egress proxy and no route out. Agents that need a hosted model API will not work; use it for local-only work. Verified: the UI loads, a real PTY spawns, and every outside host fails to resolve.

## Maintenance

- Bump an agent: edit `docker/agents/package.json`, run `npm install --package-lock-only --ignore-scripts` in that folder, review the lockfile diff, rebuild. For Kiro, change `KIRO_VERSION` and both checksums from `https://prod.download.cli.kiro.dev/stable/<version>/` in `docker/Dockerfile`.
- Bump a base image: update the digest in `docker/Dockerfile` and `docker/edge/Dockerfile` (`docker buildx imagetools inspect <image>`).
- Change allowed domains: edit `docker/edge/allowlist.txt`, then `docker compose up -d --build egress`. Avoid wildcards for shared hosts such as `.amazonaws.com`.
