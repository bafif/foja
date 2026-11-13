# Developing Foja

*English · [Español](development.es.md)*

How the repository is laid out, how to run the editor and the tests, and how the site and the desktop installers
are built.

## Layout

```
packages/core      project format (JSON Schema + types), validation, importers, exporters and shared helpers
packages/template  the nine built-in Typst styles, their library, labels and fonts, and the fonts Word embeds
packages/cli       `foja` on Node: builds PDF, SVG, Typst bundles and every export from a project
apps/web           the Astro site and the editor
apps/desktop       the desktop app: the same editor in a Tauri window, for Linux, Windows and macOS
examples/          the editor's examples, in Spanish and English, and the test fixtures
cvgen/             the first version: the author's CV as data and its Python (LaTeX) and C generators
scripts/           end-to-end tests, the LaTeX files, pictures and desktop builds
```

## Running it

Node's dependencies live only inside rootless Podman containers, which mount the repository read-only: what they
write (dependencies, builds, the CLI's output) goes to volumes.

```sh
mkdir -p node_modules apps/web/node_modules apps/web/.astro apps/web/dist .out   # once: their mount points
podman compose up                                   # Astro dev server with hot reload behind nginx, on port 8090
podman compose run --rm web npm test                # unit tests
podman compose run --rm web npm run foja -- build examples/curriculum.project.json --out .out
podman volume export foja_out | tar -x -C .out      # copies what the CLI wrote to .out/
```

`npm run foja -- …` runs the command line from its sources, with every subcommand of its
[README](../packages/cli/README.md).

## Tests

- `npm test` (Vitest) runs the unit tests of every package, the site and the documentation.
- `scripts/e2e.sh` runs the end-to-end tests against the running dev stack, with Playwright and a headless Chromium in
  a container that shares the stack's network; nothing on the host is reachable from it.
- `scripts/e2e-pwa.sh` builds the site as GitHub Pages serves it (under `/foja/`) and checks it, offline use
  included.
- `scripts/length.sh` exports every profile of the example projects in every built-in style and compares the pages of
  the Typst PDF, of the LaTeX export compiled with TeX Live and of the Word export opened in LibreOffice, in a
  container of its own (`tests/length/`); it uses the dependencies the dev stack installed. `--only <project>/<profile>`
  and `--style <id>` narrow it down.
- `scripts/word-fonts.py` makes the fonts the Word export embeds (`packages/template/word-fonts/`) from Typst's, with
  fontTools: XCharter in TrueType, and both with one set of vertical metrics.
- `scripts/latex-assets.sh` makes the LaTeX engines and the TeX Live files that imported LaTeX templates use, in
  `apps/web/public/latex/` ([what they are](../apps/web/public/latex/README.md)). They are not in the repository: the
  deploy makes them, and the LaTeX tests need the script run once.

**Two languages.** The editor, the landing page, the command line and the documents come in Spanish and English: a
text goes in both catalogues (`apps/web/src/editor/i18n.ts`, `apps/web/src/landing.ts`,
`packages/cli/src/messages.ts`) and a document `name.md` has its `name.es.md` next to it, each linking to the other.
The tests fail when one is missing.

## Pictures

- `scripts/screenshot.sh` retakes the landing page's picture of the editor (`apps/web/public/screenshot.jpg`) from
  the example, with the end-to-end tests' container. It needs retaking when the example or the editor's look changes.
- `scripts/og-image.sh` renders the link preview images (`apps/web/public/og.jpg` and `og.en.jpg`, from
  `scripts/og-image.html`), with Chrome and ImageMagick on the host.

## Deploy and releases

- **The site:** Actions → *Deploy to GitHub Pages*, run by hand. A push to `main` only runs the tests and the build
  (*CI*).
- **The desktop app** (`apps/desktop`) is a Tauri 2 window around the site built with `FOJA_DESKTOP=1`, which leaves out
  the service worker. `scripts/desktop.sh` builds it for Linux in a container (a `.deb`, an `.rpm` and an AppImage, in
  `.out/desktop/`); run `scripts/latex-assets.sh` once before, or the app has no LaTeX. The installers for every system
  come from the *Desktop installers* workflow, run by hand: it builds them on GitHub's Linux, Windows and macOS runners
  and leaves them on a draft release of the version in `apps/desktop/package.json`, which `src-tauri/Cargo.toml`
  repeats. Publishing that release creates its tag; its text is `.github/release-notes.md`.
- **The CLI on npm** (`@bafif/foja`): `scripts/cli-pack.sh` builds the package in a container, in `.out/cli/`, and
  `npm publish .out/cli/bafif-foja-<version>.tgz` publishes it without building anything on the host. The version is the
  one in `packages/cli/package.json`.
