#!/bin/bash
# run.sh JOB_DIR SCRIPT.js [args...]
# Runs a node script in a throwaway puppeteer container (docker run --rm) with the
# skill mounted at /fr (read-only) and the job folder at /work.
#
#   FR_IMAGE    container image (default ghcr.io/puppeteer/puppeteer:latest)
#   FR_NETWORK  docker network (default "host", so apps on 127.0.0.1 and the LAN are
#               reachable; on Docker Desktop use the default bridge and
#               host.docker.internal instead of 127.0.0.1)
#   FR_ENV      space-separated NAMES of exported variables to pass in (secrets such as
#               a basic-auth password or a login link); values are never printed
set -euo pipefail
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
JOB="$(cd "$1" && pwd)"; SCRIPT="$2"; shift 2
IMAGE="${FR_IMAGE:-ghcr.io/puppeteer/puppeteer:latest}"
NET=(); [ "${FR_NETWORK:-host}" != "bridge" ] && NET=(--network "${FR_NETWORK:-host}")
envs=(); for v in ${FR_ENV:-}; do envs+=(-e "$v"); done
case "$SCRIPT" in /*) ;; *) SCRIPT="/work/${SCRIPT#./}" ;; esac
exec docker run --rm -u root "${NET[@]}" \
  -v "$SKILL:/fr:ro" -v "$JOB:/work" \
  -e NODE_PATH=/home/pptruser/node_modules -e PUPPETEER_CACHE_DIR=/home/pptruser/.cache/puppeteer \
  "${envs[@]}" --entrypoint node "$IMAGE" "$SCRIPT" "$@"
