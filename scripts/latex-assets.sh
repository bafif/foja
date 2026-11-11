#!/usr/bin/env bash
# Makes what the editor serves for styles imported from LaTeX templates, in apps/web/public/latex/:
#  - swiftlatex{pdftex,xetex,dvipdfm}.js and .wasm: the pdfTeX, XeTeX and dvipdfmx engines of
#    SwiftLaTeX (AGPL-3.0), from its release, checked against a fixed SHA-256;
#  - texlive.tar.gz and xetex.tar.gz: the TeX Live 2022 files (Debian bookworm) that LaTeX's formats
#    and a set of common CV packages need under pdfLaTeX and under XeLaTeX, found by compiling
#    scripts/latex/common*.tex and the test templates with -recorder, FontAwesome 5, and for
#    XeLaTeX free OpenType fonts and their list (scripts/latex/collect.sh, in a container);
#  - version.txt: a hash of all of them. The worker keeps what it downloads under that name, so new
#    files replace the old ones by themselves. None of this is in the repository: the Pages deploy runs
# this script, and the end-to-end tests of LaTeX need it run once. Needs podman and the network.
set -euo pipefail
cd "$(dirname "$0")/.."
out=apps/web/public/latex
release=https://github.com/SwiftLaTeX/SwiftLaTeX/releases/download/v20022022/20-02-2022.zip
sum=cf5535ffe9cdf42f7c4522e96bba4d33db10c418a7ceb24e5d80504be7de7150
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

curl -fsSL "$release" -o "$tmp/engine.zip"
echo "$sum  $tmp/engine.zip" | sha256sum -c --quiet -
python3 -I -c 'import sys, zipfile; z = zipfile.ZipFile(sys.argv[1]); [open(f"{sys.argv[2]}/swiftlatex{e}.{x}", "wb").write(z.read(f"swiftlatex{e}.{x}")) for e in ("pdftex", "xetex", "dvipdfm") for x in ("js", "wasm")]' "$tmp/engine.zip" "$out"

podman volume rm -f foja_latex_assets >/dev/null 2>&1 || true
podman run --rm -v foja_latex_assets:/out -v "$PWD/scripts/latex":/in:ro -v "$PWD/packages/core/test/fixtures/latex":/fx:ro \
    docker.io/library/debian:bookworm-slim sh /in/collect.sh
for f in texlive.tar.gz xetex.tar.gz; do podman volume export foja_latex_assets | tar -xO "$f" > "$out/$f"; done
podman volume export foja_latex_assets | tar -xO files.txt > "$out/texlive-files.txt"
podman volume export foja_latex_assets | tar -xO xetex-files.txt > "$out/xetex-files.txt"
podman volume rm -f foja_latex_assets >/dev/null
cat "$out"/swiftlatex*.js "$out"/swiftlatex*.wasm "$out/texlive.tar.gz" "$out/xetex.tar.gz" | sha256sum | cut -c1-16 > "$out/version.txt"
ls -l "$out"
