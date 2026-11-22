#!/usr/bin/env bash
# Start Adadex in Docker for the project in the current folder.
# Usage: run from your project folder:  /path/to/adadex/run.sh [docker compose args, default: up --build]
set -euo pipefail

ADADEX_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export ADADEX_WORKSPACE="$PWD"

if [ "$ADADEX_WORKSPACE" = "$HOME" ] || [ "$ADADEX_WORKSPACE" = "/" ]; then
  echo "Run this from the project you want the agents to work on, not from $ADADEX_WORKSPACE." >&2
  exit 1
fi

if [ "$#" -eq 0 ]; then
  set -- up --build
fi

# Pick the first free port from 8787 unless ADADEX_PORT is set.
if [ -z "${ADADEX_PORT:-}" ]; then
  port=8787
  while lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; do
    port=$((port + 1))
  done
  export ADADEX_PORT="$port"
fi

echo "Adadex: http://127.0.0.1:$ADADEX_PORT  (workspace: $ADADEX_WORKSPACE)"
exec docker compose -f "$ADADEX_DIR/docker-compose.yml" "$@"
