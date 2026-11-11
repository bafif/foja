# Foja

*English · [Español](README.es.md)*

A no-code CV editor built on [Typst](https://typst.app): forms instead of code, a live preview
that is the real Typst output, and exports to Typst, PDF, JPG, LaTeX, Markdown, JSON and Word.
Everything runs in the browser; your CV never leaves your machine.

- **Profiles from one bank of entries**: one CV per kind of job, the entries written once.
- **Nine styles of its own** (Legajo, Banda, Minimal; Claustro, Recto and Llano, made for
  applicant tracking systems; Arco, Rótulo and Portada, for a short CV) with layout options, and **styles you write in Typst** ("Edit in
  Typst" copies any style into one of your own).
- **Typst and LaTeX templates imported** with fixed rules, no AI: their sample content as a
  profile and their look as a style of your own, after a form where you check which argument is
  which field (a LaTeX template is compiled by LaTeX in the browser).
- **What goes in each profile**: priorities marked once in the bank, a length per profile
  (short, normal, full), exceptions, and a button that fits the CV on one page.
- **One-page discipline**: the preview says whether the CV fits and what spills over; click a
  part of the preview to edit it.
- **Exports**: PDF, JPG, Word, Typst, LaTeX, Markdown, JSON and [JSON Resume](https://jsonresume.org), which it
  imports too.
- **Private and offline**: no accounts, no server; installable as an app on computers and on
  Android and iPhone; Spanish and English.

User guide: [`docs/guide.md`](docs/guide.md). Writing a style: [`docs/templates.md`](docs/templates.md).
Interface themes: [`docs/themes.md`](docs/themes.md). Security model: [`docs/security.md`](docs/security.md).
Command line: [`packages/cli/README.md`](packages/cli/README.md).

Foja started as cvgen, the generator I wrote for my own CV: JSON files turned into a PDF by a
Python generator through LaTeX and by a second one in C. It still lives here, in
[`cvgen/`](cvgen/README.md), with my CV data, and its history is where this repository's begins.

Status: the editor, the exporters and the CLI work, and the editor is online at
<https://bafif.github.io/foja/>, on phones too. What is built, what comes next and why:
[`docs/ROADMAP.md`](docs/ROADMAP.md).

## Layout

```
packages/core      project format (JSON Schema + types), validation, shared helpers
packages/template  the nine built-in Typst styles, their library, labels and fonts
packages/cli       `foja` on Node: build PDF/SVG/Typst bundles from a project
apps/web           the Astro site and editor
examples/          the editor's examples (Spanish, English): my CV with its three profiles, and three made-up
                   people with little experience; test fixtures: a fictional CV and my full CV (fake phone)
cvgen/             the first version: my CV data and the Python (LaTeX) and C generators
```


## Development

Node dependencies live only inside rootless Podman containers, and the repository is mounted read-only there:
nothing that runs in a container can change the sources or `.git`. Dependencies and output live in volumes;
Astro's cache is a tmpfs, new in every container (Astro 7 stops the pid it finds in `.astro/dev.json`, which in a
fresh container can be the new server itself).

```sh
mkdir -p node_modules apps/web/node_modules apps/web/.astro apps/web/dist .out   # once: their mount points
podman compose up                                   # Astro dev server with hot reload behind nginx
podman compose run --rm web npm test                # tests
podman compose run --rm web npm run foja -- build examples/curriculum.project.json --out .out
podman volume export foja_out | tar -x -C .out      # copies what the CLI wrote to .out/
```

`scripts/e2e-pwa.sh` builds the site as GitHub Pages serves it (under `/foja/`) and checks it,
offline use included. `scripts/latex-assets.sh` makes the LaTeX engine and TeX Live files that imported LaTeX
templates use (`apps/web/public/latex/`, not versioned): the Pages deploy runs it, and the LaTeX tests need it run
once. `scripts/e2e.sh` runs the end-to-end tests against the running dev stack, with Playwright and a
headless Chromium in a container that shares the stack's network; nothing on the host is reachable from it.
`scripts/screenshot.sh` uses the same container to retake the landing page's picture of the editor
(`apps/web/public/screenshot.jpg`) from the example; it needs retaking whenever the example or the editor's look
changes. After that, `scripts/og-image.sh` renders again the link preview images that X, WhatsApp and others show
(`apps/web/public/og.jpg` and `og.en.jpg`, from `scripts/og-image.html`), with Chrome and ImageMagick on the host.

## Licence

GPL-3.0. See [LICENSE](LICENSE).
