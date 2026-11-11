# Security model

*English · [Español](security.es.md)*

Foja opens files made by other people: projects (`.foja.json`), which can carry **styles
written in Typst**, and interface themes (`.foja-theme.json`). This page says what such a file
can and cannot do.

## Projects and styles

A style is Typst code. Typst is a sandboxed language: it has no shell, no network access of its
own, and reads only files under its project root.

- **In the browser**, the compiler runs in a Web Worker and sees only the project, Foja's
  library and styles, and the project's photo. It cannot read anything else on your computer.
- **In the CLI**, every compilation gets an empty temporary directory as its root; the same
  virtual files are mapped into it. A style that tries `read("/etc/…")`, `../` or `/proc` gets
  "file not found" (tested).
- Package imports (`#import "@preview/…"`) are not available in the browser. The CLI's Typst
  library can download packages from the official Typst registry.
- The preview shows Typst's SVG with its script, its HTML text layer and every link removed, so
  a style cannot put clickable `javascript:` links or markup into the page (tested).
- The LaTeX export percent-encodes URLs and escapes every special character of the text, so a
  contact field cannot inject TeX (`\input`, `\write`) into `cv.tex` (tested, compiled).
- A style that runs too long (an endless loop) is stopped after 20 seconds and the editor says so.

## Imported templates

A Typst or LaTeX template someone else wrote is data until Typst or LaTeX compiles it:

- Foja reads it with fixed rules (`packages/core/src/importer/`): it scans the code, never runs it,
  and calls no model or service.
- A `.zip` or `.tar.gz` is unpacked with the platform's own decompressor, with caps: at most 400
  files and 20 MB unpacked, counted while it inflates, so a small archive that would unpack to
  gigabytes stops early. Absolute paths, paths with `..`, backslashes and links are refused.
- Its files go into the project under the style, and the compiler sees them under `/custom/<id>/`,
  in the same sandbox as any style: nothing outside the project can be read (tested).
- `@preview` packages are never downloaded: those that came in the upload are pointed at, and the
  editor names the ones that are missing. A Typst template's fonts are left out (the compiler has only Foja's); a
  LaTeX template's stay with its style, for XeLaTeX.
- The template's licence, when it has one, is kept with the style.
- A LaTeX template's look is compiled in the browser by the pdfTeX engine of
  [SwiftLaTeX](https://github.com/SwiftLaTeX/SwiftLaTeX), or by its XeTeX and dvipdfmx engines (WebAssembly, AGPL-3.0,
  unchanged), each in a worker of its own that is loaded only when a LaTeX template is used. The engines and the TeX
  Live files and fonts they may read come from the site itself (`apps/web/public/latex/`, made at each deploy by
  `scripts/latex-assets.sh`, the engine and FontAwesome checked against fixed SHA-256 sums) and stay in Cache Storage
  under a hash of them. Fonts uploaded for a XeLaTeX template are kept in the project with its style; Foja reads only
  their names and style bits from them, every read bounds-checked (`packages/core/src/fonts.ts`), and XeTeX lays them
  out in its worker. Every file is put in the engine's memory file system before it compiles: it reaches no network
  while compiling, and what is not there is not found. There is no shell to escape to (`\write18` has nothing to run in
  WebAssembly), a compile that does not end is stopped, and what the engine can write stays in its memory.

## The web app

Production pages carry a Content Security Policy: scripts only from the site itself (and
WebAssembly for the compiler), **connections only to the site itself**, no plugins, no forms.
Whatever slipped in could not load anything from elsewhere or send your data out.

## Themes

A theme is data, not code: a JSON file whose values are checked against a closed list (colours,
one length, font names) and written only into CSS custom properties. `url()`, `;`, braces and
anything else are refused (tested). The `window.foja.themes` API takes the same data, with the
same checks; it exists for scripts the user runs, and the page loads none from outside.

## Reporting

Report a security problem privately through GitHub's "Report a vulnerability" on
[bafif/foja](https://github.com/bafif/foja/security), not in a public issue.
