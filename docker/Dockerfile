# syntax=docker/dockerfile:1.7
#
# Adadex sandbox image. Three rules shape it:
#   1. Nothing runs a dependency's install script except node-pty (compiled on purpose)
#      and the two vendor agent CLIs that only link a prebuilt binary.
#   2. Every external input is pinned: base image digest, npm lockfiles, Kiro checksum.
#   3. The final image has no compiler, no package manager cache and no root shell for the app.

ARG NODE_IMAGE=node:22-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee

# ---------------------------------------------------------------- build Adadex
FROM ${NODE_IMAGE} AS build
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/desktop/package.json apps/desktop/
COPY packages/core/package.json packages/core/
# --ignore-scripts: no package's lifecycle script runs during install.
RUN npm ci --ignore-scripts
COPY . .
# Compile node-pty with no network: the build can only use what npm ci already installed.
# nodedir points node-gyp at the headers already in the image, so it downloads nothing.
# (The patch in patches/ only touches Windows files, so patch-package is not run here.)
RUN --network=none npm_config_nodedir=/usr/local npm rebuild node-pty
# The bundler and type checker are dependencies too, so the whole build runs with no network.
RUN --network=none npm run build

# --------------------------------------------------------------- agent CLIs
# Claude Code, Codex and OpenCode come from docker/agents/package-lock.json (versions and
# integrity hashes pinned). Their postinstall only links the prebuilt platform binary.
FROM ${NODE_IMAGE} AS agents
WORKDIR /opt/agents
COPY docker/agents/package.json docker/agents/package-lock.json ./
RUN npm ci --ignore-scripts --omit=dev
# Vendor install scripts run with no network: they only link the binary npm ci already fetched.
RUN --network=none npm rebuild @anthropic-ai/claude-code opencode-ai

# Kiro ships as a tarball, not on npm. Pinned version, pinned sha256 per architecture.
FROM ${NODE_IMAGE} AS kiro
ARG TARGETARCH
ARG KIRO_VERSION=3.5.0
ARG KIRO_SHA256_AMD64=98f016b746b342d8337a0e937cabecc381037e2e920ea0ffaae649e51ef59d4e
ARG KIRO_SHA256_ARM64=34444fee032944037282c762df4ff6929a51e827dd72d402cb7a8afbecb33e7f
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN set -eux; \
    case "${TARGETARCH}" in \
      amd64) arch=x86_64; sha="${KIRO_SHA256_AMD64}" ;; \
      arm64) arch=aarch64; sha="${KIRO_SHA256_ARM64}" ;; \
      *) echo "unsupported architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    curl -fsSL --proto '=https' --tlsv1.2 -o /tmp/kiro.tgz \
      "https://prod.download.cli.kiro.dev/stable/${KIRO_VERSION}/kirocli-${arch}-linux.tar.gz"; \
    echo "${sha}  /tmp/kiro.tgz" | sha256sum -c -; \
    mkdir -p /opt/kiro; \
    tar -xzf /tmp/kiro.tgz -C /opt/kiro --strip-components=1 kirocli/bin; \
    rm /tmp/kiro.tgz

# -------------------------------------------------------------------- runtime
FROM ${NODE_IMAGE} AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends git curl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --uid 10001 --create-home --home-dir /home/adadex --shell /bin/bash adadex \
 && mkdir -p /workspace && chown adadex:adadex /workspace

COPY --from=agents /opt/agents /opt/agents
COPY --from=kiro /opt/kiro/bin/ /opt/kiro/bin/
RUN ln -s /opt/agents/node_modules/.bin/claude /usr/local/bin/claude \
 && ln -s /opt/agents/node_modules/.bin/codex /usr/local/bin/codex \
 && ln -s /opt/agents/node_modules/.bin/opencode /usr/local/bin/opencode \
 && ln -s /opt/kiro/bin/kiro-cli /usr/local/bin/kiro-cli

# Only what Adadex needs at run time: the bundle, the web assets, and the two native-addon deps.
COPY --from=build /src/bin /opt/adadex/bin
COPY --from=build /src/dist /opt/adadex/dist
COPY --from=build /src/package.json /opt/adadex/package.json
COPY --from=build /src/node_modules/node-pty /opt/adadex/node_modules/node-pty
COPY --from=build /src/node_modules/ws /opt/adadex/node_modules/ws

# Start-up guard: exits unless caps are dropped, root is read-only and there is no default route.
COPY --chmod=0555 docker/sandbox-check.sh /opt/adadex/sandbox-check.sh

ENV NODE_ENV=production \
    ADADEX_PACKAGE_ROOT=/opt/adadex \
    ADADEX_NO_OPEN=1 \
    NODE_USE_ENV_PROXY=1 \
    DISABLE_AUTOUPDATER=1 \
    OPENCODE_DISABLE_AUTOUPDATE=true \
    HOME=/home/adadex

USER adadex
WORKDIR /workspace
EXPOSE 8787
# Plain TCP connect to loopback: no HTTP, so no Host/Origin or proxy settings involved.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "require('net').connect(8787,'127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"]
ENTRYPOINT ["/opt/adadex/sandbox-check.sh"]
