#!/usr/bin/env bash
# Makes what the editor serves for styles imported from LaTeX templates, in apps/web/public/latex/:
#  - busytex.js and busytex.wasm: BusyTeX's engines (pdfTeX, XeTeX, xdvipdfmx and the rest of TeX Live 2026's
#    programs in one WebAssembly module, AGPL-3.0), from texlyre-busytex's release, checked against a fixed SHA-256;
#  - pdftex.tar.gz and xetex.tar.gz: the TeX Live 2026 files (Alpine's) that a set of common CV packages needs under
#    pdfLaTeX and under XeLaTeX, found by compiling scripts/latex/common*.tex and the test templates, FontAwesome 5,
#    and for XeLaTeX Latin Modern in OpenType and fontconfig's and ICU's data; each with LaTeX's format, made by those
#    same engines, which then compile every document again with nothing else (scripts/latex/collect.sh and
#    formats.mjs, in a container);
#  - version.txt: a hash of all of them. The worker keeps what it downloads under that name, so new
#    files replace the old ones by themselves. None of this is in the repository: the Pages deploy runs
# this script, and the end-to-end tests of LaTeX need it run once. Needs podman and the network.
set -euo pipefail
cd "$(dirname "$0")/.."
out=apps/web/public/latex
release=https://github.com/TeXlyre/texlyre-busytex/releases/download/assets-v1.4.1/busytex-assets.tar.gz
sum=4f63731fe4ec9238d877846074ab424350add6f6e956944def389e6752d2c78b
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# 520 MB, of which only the engine is kept: the rest is TeX Live in BusyTeX's own packages, which Foja replaces with
# the files it needs.
curl -fsSL "$release" -o "$tmp/busytex.tar.gz"
echo "$sum  $tmp/busytex.tar.gz" | sha256sum -c --quiet -
tar -xzf "$tmp/busytex.tar.gz" -C "$tmp" busytex/busytex.js busytex/busytex.wasm
rm "$tmp/busytex.tar.gz"
cp "$tmp/busytex/busytex.js" "$tmp/busytex/busytex.wasm" "$out/"

podman volume rm -f foja_latex_assets >/dev/null 2>&1 || true
podman run --rm -v foja_latex_assets:/out -v "$PWD/scripts/latex":/in:ro -v "$PWD/packages/core/test/fixtures/latex":/fx:ro \
    -v "$PWD/packages/template/fonts":/repo-fonts:ro -v "$PWD/$out":/engine:ro \
    docker.io/library/alpine:3.24 sh /in/collect.sh
for f in pdftex.tar.gz xetex.tar.gz pdftex-files.txt xetex-files.txt; do
    podman volume export foja_latex_assets | tar -xO "$f" > "$out/$f"
done
podman volume rm -f foja_latex_assets >/dev/null
cat "$out/busytex.js" "$out/busytex.wasm" "$out/pdftex.tar.gz" "$out/xetex.tar.gz" | sha256sum | cut -c1-16 > "$out/version.txt"
ls -l "$out"
