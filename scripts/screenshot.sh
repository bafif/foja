#!/usr/bin/env bash
# Takes the landing page's picture of the editor with the same container as the end-to-end tests (see scripts/e2e.sh).
# Needs the dev stack: `podman compose up`. The picture lands in the `out` volume; copy it out and into place with
#   podman volume export foja_out | tar -x -C .out screenshot.jpg && mv .out/screenshot.jpg apps/web/public/
set -euo pipefail
cd "$(dirname "$0")/.."
podman build -q -t foja-e2e tests/e2e >/dev/null
podman run --rm --network "${E2E_NETWORK:-container:foja_nginx_1}" -u 1000:1000 \
    -v "$PWD":/app:ro -v foja_node_modules:/app/node_modules -v foja_web_node_modules:/app/apps/web/node_modules \
    -v foja_out:/app/.out:U -w /app -e HOME=/tmp -e BASE_URL="${BASE_URL:-http://127.0.0.1}" \
    foja-e2e sh -c '
      chromium-browser --headless=new --no-sandbox --remote-debugging-address=127.0.0.1 --remote-debugging-port=9223 \
          --user-data-dir=/tmp/profile --no-first-run --no-default-browser-check about:blank >/dev/null 2>&1 &
      for _ in $(seq 60); do wget -qO /dev/null http://127.0.0.1:9223/json/version 2>/dev/null && break; sleep 0.5; done
      for _ in $(seq 60); do wget -qO /dev/null "$BASE_URL" 2>/dev/null && break; sleep 0.5; done
      exec node scripts/screenshot.mjs .out/screenshot.jpg'
