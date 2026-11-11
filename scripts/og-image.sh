#!/usr/bin/env bash
# Renders the link preview images from scripts/og-image.html: apps/web/public/og.jpg (Spanish) and og.en.jpg
# (English), at 1200x630. Needs Chrome (or Chromium) and ImageMagick on the host; it only opens that local file.
set -euo pipefail
cd "$(dirname "$0")/.."
chrome=${CHROME:-$(command -v google-chrome || command -v google-chrome-beta || command -v chromium)}
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
for lang in es en; do
    "$chrome" --headless=new --hide-scrollbars --force-device-scale-factor=1 --window-size=1200,630 \
        --allow-file-access-from-files --user-data-dir="$tmp/profile" --virtual-time-budget=5000 \
        --screenshot="$tmp/og.png" "file://$PWD/scripts/og-image.html?lang=$lang" 2>/dev/null
    name=$([ "$lang" = es ] && echo og.jpg || echo og.en.jpg)
    magick "$tmp/og.png" -strip -quality 86 -interlace JPEG "apps/web/public/$name"
done
ls -l apps/web/public/og.jpg apps/web/public/og.en.jpg
