#!/bin/sh
# The same length in every format (tests/length/measure.ts): builds the test's image, with TeX Live and LibreOffice,
# and runs it on the repository, mounted read-only, with the dependencies the dev stack installed (`podman compose
# up` once). Arguments go to measure.ts: `--only <project>/<profile>`, `--style <id>`.
set -eu
cd "$(dirname "$0")/.."
podman build -q -t foja-length -f tests/length/Containerfile tests/length >/dev/null
exec podman run --rm -v "$PWD":/app:ro -v foja_node_modules:/app/node_modules:ro -w /app foja-length \
    node tests/length/measure.ts "$@"
