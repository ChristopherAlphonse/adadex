#!/bin/sh
set -u

problems=""
add() { problems="${problems}  - $1
"; }

# CapBnd, not CapEff: a non-root user always has an empty effective set, but only cap_drop clears the bounding set.
grep -Eq '^CapBnd:[[:space:]]+0+$' /proc/self/status || add "Linux capabilities are not all dropped (cap_drop: [ALL])"
grep -Eq '^NoNewPrivs:[[:space:]]+1$' /proc/self/status || add "no-new-privileges is not set"
grep -Eq '^[^ ]+ / [^ ]+ ro[, ]' /proc/mounts || add "the root filesystem is writable (read_only: true)"
awk 'NR > 1 && $2 == "00000000" { found = 1 } END { exit !found }' /proc/net/route \
  && add "the container has a default route to the internet (use the internal network and egress proxy)"
awk '$1 == "00000000000000000000000000000000" && $2 == "00" && $NF != "lo" { found = 1 } END { exit !found }' /proc/net/ipv6_route 2>/dev/null \
  && add "the container has an IPv6 default route to the internet"

if [ -n "$problems" ] && [ "${ADADEX_ALLOW_UNSANDBOXED:-}" != "1" ]; then
  printf 'Adadex will not start: this container is not sandboxed.\n%s\nStart it with `docker compose up` from the Adadex repo (see docs/guides/docker-sandbox.md).\n' "$problems" >&2
  exit 78
fi

exec node /opt/adadex/bin/adadex "$@"
