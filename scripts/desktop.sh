#!/usr/bin/env bash
# Builds the desktop app for Linux in a container: a .deb, an .rpm and an AppImage, in .out/desktop/. The installers
# for Windows and macOS are made only on GitHub's runners (.github/workflows/desktop.yml). The repository is mounted
# read-only and copied inside (without cvgen/, which the app does not use); npm's and Cargo's downloads and Cargo's
# output stay in volumes between runs. Run scripts/latex-assets.sh once before, or the app will have no LaTeX for
# imported LaTeX templates. If Cargo.lock changes, the new one is left in .out/desktop/ too, to be committed.
set -euo pipefail
cd "$(dirname "$0")/.."
podman build -q -t foja-desktop -f apps/desktop/Containerfile apps/desktop >/dev/null
mkdir -p .out/desktop
podman run --rm \
    -v "$PWD":/src:ro \
    -v "$PWD/.out/desktop":/out \
    -v foja_desktop_npm:/root/.npm \
    -v foja_desktop_cargo:/usr/local/cargo/registry \
    -v foja_desktop_target:/target \
    -e CARGO_TARGET_DIR=/target \
    -e APPIMAGE_EXTRACT_AND_RUN=1 \
    foja-desktop bash -euo pipefail -c '
        mkdir /work && cd /src
        tar -c --exclude=./.git --exclude=./cvgen --exclude=./.out --exclude=node_modules --exclude=./apps/web/dist \
            --exclude=./apps/web/.astro --exclude=./apps/desktop/src-tauri/target --exclude=./apps/desktop/src-tauri/icons \
            --exclude=./apps/desktop/src-tauri/gen . | tar -x -C /work
        cd /work
        npm ci --no-fund --no-audit --loglevel=error
        FOJA_DESKTOP=1 npm run build -w apps/web
        rm -rf /target/release/bundle /out/*
        npm run tauri -w apps/desktop -- build --ci --bundles deb,rpm,appimage
        cp /target/release/bundle/deb/*.deb /target/release/bundle/rpm/*.rpm /target/release/bundle/appimage/*.AppImage /out/
        cmp -s /src/apps/desktop/src-tauri/Cargo.lock apps/desktop/src-tauri/Cargo.lock || cp apps/desktop/src-tauri/Cargo.lock /out/
        ls -l /out'
