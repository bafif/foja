# LaTeX for imported LaTeX templates

What the editor's LaTeX worker (`worker.js`) loads, only when a LaTeX template is used. Made by
`scripts/latex-assets.sh`; see `docs/security.md` for how it runs.

| File | What it is | Licence |
| :--- | :--- | :--- |
| `swiftlatexpdftex.js`, `swiftlatexpdftex.wasm` | The pdfTeX engine of [SwiftLaTeX](https://github.com/SwiftLaTeX/SwiftLaTeX), release [20-02-2022](https://github.com/SwiftLaTeX/SwiftLaTeX/releases/tag/v20022022), unchanged. Its source is in that repository. | AGPL-3.0 |
| `texlive.tar.gz` | Files of TeX Live 2022 as Debian bookworm packs them: LaTeX's kernel and format sources, the packages in `scripts/latex/common.tex` and the fonts they use. Their names are in `texlive-files.txt`. | Each file keeps its own: mostly the LaTeX Project Public License, and the GUST Font License, the SIL Open Font License, the GPL or public domain for some; see each file's header and [TeX Live's licensing](https://tug.org/texlive/LICENSE.TL). |
| `worker.js` | Foja's worker around the engine. | GPL-3.0, as Foja |
