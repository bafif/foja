# foja

*English · [Español](https://github.com/bafif/foja/blob/main/packages/cli/README.es.md)*

The command line of [Foja](https://github.com/bafif/foja), a CV editor on Typst: builds CVs
from a Foja project (`.foja.json`, made in the editor or by hand) with the same Typst styles the
web editor uses.

Install it with `npm install -g @bafif/foja`, which brings the `foja` command; `npx @bafif/foja build …` runs it
without installing. From a clone of the repository, `npm run foja -- build …` runs it from its sources
([how](https://github.com/bafif/foja/blob/main/docs/development.md)).

```sh
foja build my.foja.json                       # a PDF per profile
foja build my.foja.json --profile dev --format pdf --format docx --out out
foja build my.foja.json --format all          # every format in one .zip
foja validate my.foja.json
foja import template.zip my.foja.json         # a Typst or LaTeX template: its content and its look
foja import resume.json my.foja.json          # a CV in JSON Resume
```

`import` reads a Typst or LaTeX CV template (`.typ`, `.tex`, `.zip` or `.tar.gz`) with fixed rules, no AI: its
sample content becomes a profile and its look a style of your own; `--into` adds them to an
existing project, `--no-style` leaves the look out. It takes the rules' proposal as it is; the
editor shows it for review first. This command has no LaTeX: a profile with a LaTeX template gets
its filled `.tex` (`--format tex`) and no PDF. A `.json` is a CV in [JSON Resume](https://jsonresume.org): its
entries go to the bank, with a profile that has its sections.

Formats: `pdf`, `svg`, `typ` (a `.zip` that compiles with plain `typst compile`), `tex` (LaTeX), `md`, `json`,
`jsonresume` (the profile in JSON Resume; it says what has no place there), `docx` (Word), `all`. Needs Node 24 or
later. Messages and `--help` come in Spanish when the system's language is Spanish and in English otherwise; `--lang es`
or `--lang en` picks one.

The project format is described by its JSON Schema
([`project.schema.json`](https://github.com/bafif/foja/blob/main/packages/core/schema/project.schema.json));
styles of your own, written in Typst, are explained in
[`docs/templates.md`](https://github.com/bafif/foja/blob/main/docs/templates.md).

Licence: GPL-3.0. The bundled fonts keep their own licences (files next to them in
`dist/template/fonts`).
