#!/usr/bin/env bash
# Builds the CLI's npm package in a container: .out/cli/foja-<version>.tgz. Publish that file with
# `npm publish .out/cli/foja-<version>.tgz`, which builds nothing on the host. The repository is mounted read-only and
# copied inside (without cvgen/, which the package does not use), and the package comes out on the container's
# standard output, so the container writes nothing on the host. npm's downloads stay in a volume between runs.
set -euo pipefail
cd "$(dirname "$0")/.."
version=$(sed -n 's/^  "version": "\(.*\)",$/\1/p' packages/cli/package.json)
out=".out/cli/foja-$version.tgz"
mkdir -p .out/cli
podman run --rm \
    -v "$PWD":/src:ro \
    -v foja_cli_npm:/root/.npm \
    docker.io/library/node:24-alpine sh -euc '
        mkdir /work && cd /src
        tar -c --exclude=./.git --exclude=./cvgen --exclude=./.out --exclude=node_modules --exclude=./apps/web/dist \
            --exclude=./apps/web/.astro --exclude=./apps/web/public/latex --exclude=./apps/desktop/src-tauri/target . | tar -x -C /work
        cd /work
        npm ci --no-fund --no-audit --loglevel=error >&2
        cd packages/cli && npm pack --pack-destination /tmp --loglevel=warn >&2
        cat /tmp/foja-*.tgz' >"$out.part"
mv "$out.part" "$out"
ls -l "$out"
