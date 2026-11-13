#!/usr/bin/env bash
# Builds the CLI's npm package in a container: .out/cli/foja-<version>.tgz. Publish that file with
# `npm publish .out/cli/foja-<version>.tgz`, which builds nothing on the host. The repository is mounted read-only and
# copied inside (without cvgen/, which the package does not use); npm's downloads stay in a volume between runs.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .out/cli
podman run --rm \
    -v "$PWD":/src:ro \
    -v "$PWD/.out/cli":/out \
    -v foja_cli_npm:/root/.npm \
    docker.io/library/node:24-alpine sh -euc '
        mkdir /work && cd /src
        tar -c --exclude=./.git --exclude=./cvgen --exclude=./.out --exclude=node_modules --exclude=./apps/web/dist \
            --exclude=./apps/web/.astro --exclude=./apps/web/public/latex --exclude=./apps/desktop/src-tauri/target . | tar -x -C /work
        cd /work
        npm ci --no-fund --no-audit --loglevel=error
        rm -f /out/*.tgz
        cd packages/cli && npm pack --pack-destination /out --loglevel=warn
        ls -l /out'
