# LaTeX for imported LaTeX templates

*English · [Español](README.es.md)*

What the editor's LaTeX worker (`worker.js`) loads, only when a LaTeX template is used. Everything
but this file, its Spanish twin and `worker.js` is made by `scripts/latex-assets.sh`, which the Pages deploy runs; it
is not in the repository. See `docs/security.md` for how it runs.

| File | What it is | Licence |
| :--- | :--- | :--- |
| `swiftlatex{pdftex,xetex,dvipdfm}.js` and `.wasm` | The pdfTeX, XeTeX and dvipdfmx engines of [SwiftLaTeX](https://github.com/SwiftLaTeX/SwiftLaTeX), release [20-02-2022](https://github.com/SwiftLaTeX/SwiftLaTeX/releases/tag/v20022022), unchanged. Their source is in that repository. | AGPL-3.0 |
| `texlive.tar.gz` | Files of TeX Live 2022 as Debian bookworm packs them: LaTeX's kernel and format sources, the packages in `scripts/latex/common.tex` and the fonts they use, and FontAwesome 5 from TeX Live 2022's final archive. Their names are in `texlive-files.txt`. | Each file keeps its own: mostly the LaTeX Project Public License, and the GUST Font License, the SIL Open Font License, the GPL or public domain for some; see each file's header and [TeX Live's licensing](https://tug.org/texlive/LICENSE.TL). |
| `xetex.tar.gz` | The same for XeLaTeX (`scripts/latex/common-xetex.tex`), with free OpenType fonts (Latin Modern, TeX Gyre, Roboto, Lato, Open Sans, FontAwesome 5) and `xetexfontlist.txt`, the list of them the XeTeX engine reads instead of fontconfig. Their names are in `xetex-files.txt`. | As above; the fonts under the GUST Font License, the SIL Open Font License or Apache-2.0 (Roboto, Open Sans). |
| `version.txt` | A hash of the files above: the name they are kept under in the browser. | — |
| `worker.js` | Foja's worker around the engine. | GPL-3.0, as Foja |
