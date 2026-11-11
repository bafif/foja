# foja

*English · [Español](https://github.com/bafif/foja/blob/main/packages/cli/README.es.md)*

The command line of [Foja](https://github.com/bafif/foja), a CV editor on Typst: builds CVs
from a Foja project (`.foja.json`, made in the editor or by hand) with the same Typst styles the
web editor uses.

```sh
npx foja build my.foja.json                       # a PDF per profile
npx foja build my.foja.json --profile dev --format pdf --format docx --out out
npx foja build my.foja.json --format all          # every format in one .zip
npx foja validate my.foja.json
npx foja import template.zip my.foja.json         # a Typst template: its content and its look
```

`import` reads a Typst CV template (`.typ`, `.zip` or `.tar.gz`) with fixed rules, no AI: its
sample content becomes a profile and its look a style of your own; `--into` adds them to an
existing project, `--no-style` leaves the look out. It takes the rules' proposal as it is; the
editor shows it for review first.

Formats: `pdf`, `svg`, `typ` (a `.zip` that compiles with plain `typst compile`), `tex`
(LaTeX), `md`, `json`, `docx` (Word), `all`. Needs Node 24 or later. Messages and `--help` come
in Spanish when the system's language is Spanish and in English otherwise; `--lang es` or
`--lang en` picks one.

The project format is described by its JSON Schema
([`project.schema.json`](https://github.com/bafif/foja/blob/main/packages/core/schema/project.schema.json));
styles of your own, written in Typst, are explained in
[`docs/templates.md`](https://github.com/bafif/foja/blob/main/docs/templates.md).

Licence: GPL-3.0. The bundled fonts keep their own licences (files next to them in
`dist/template/fonts`).
