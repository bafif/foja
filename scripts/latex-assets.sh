#!/usr/bin/env bash
# Makes what the editor serves for styles imported from LaTeX templates, in apps/web/public/latex/:
#  - swiftlatexpdftex.js and .wasm: the pdfTeX engine of SwiftLaTeX (AGPL-3.0), from its release,
#    checked against a fixed SHA-256;
#  - texlive.tar.gz: the TeX Live 2022 files (Debian bookworm) that LaTeX's format and a set of
#    common CV packages need, found by compiling scripts/latex/common.tex and the test templates
#    with -recorder (scripts/latex/collect.sh, in a container).
# Needs podman and the network. After running it, bump VERSION in apps/web/public/latex/worker.js
# so that browsers fetch the new files.
set -euo pipefail
cd "$(dirname "$0")/.."
out=apps/web/public/latex
release=https://github.com/SwiftLaTeX/SwiftLaTeX/releases/download/v20022022/20-02-2022.zip
sum=cf5535ffe9cdf42f7c4522e96bba4d33db10c418a7ceb24e5d80504be7de7150
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

curl -fsSL "$release" -o "$tmp/engine.zip"
echo "$sum  $tmp/engine.zip" | sha256sum -c --quiet -
python3 -I -c 'import sys, zipfile; z = zipfile.ZipFile(sys.argv[1]); [open(f"{sys.argv[2]}/{n}", "wb").write(z.read(n)) for n in ("swiftlatexpdftex.js", "swiftlatexpdftex.wasm")]' "$tmp/engine.zip" "$out"

podman volume rm -f foja_latex_assets >/dev/null 2>&1 || true
podman run --rm -v foja_latex_assets:/out -v "$PWD/scripts/latex":/in:ro -v "$PWD/packages/core/test/fixtures/latex":/fx:ro \
    docker.io/library/debian:bookworm-slim sh /in/collect.sh
podman volume export foja_latex_assets | tar -xO texlive.tar.gz > "$out/texlive.tar.gz"
podman volume export foja_latex_assets | tar -xO files.txt > "$out/texlive-files.txt"
podman volume rm -f foja_latex_assets >/dev/null
ls -l "$out"
