# syntax=docker/dockerfile:1.7
ARG DEBIAN_IMAGE=debian:bookworm-slim@sha256:734a72b3d6142a71993b4bc580ca01d8ca687f77a2c422d96a961d3376b179bc

FROM ${DEBIAN_IMAGE} AS egress
RUN apt-get update && apt-get install -y --no-install-recommends squid \
 && rm -rf /var/lib/apt/lists/* /etc/squid/squid.conf
COPY squid.conf /etc/squid/squid.conf
COPY allowlist.txt /etc/squid/allowlist.txt
USER proxy
EXPOSE 3128
CMD ["squid", "-N", "-f", "/etc/squid/squid.conf"]

FROM ${DEBIAN_IMAGE} AS gateway
RUN apt-get update && apt-get install -y --no-install-recommends socat \
 && rm -rf /var/lib/apt/lists/*
USER nobody
EXPOSE 8787
CMD ["socat", "TCP-LISTEN:8787,fork,reuseaddr", "TCP:adadex:8787"]
