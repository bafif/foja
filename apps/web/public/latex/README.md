# LaTeX for imported LaTeX templates

*English · [Español](README.es.md)*

What the editor's LaTeX worker (`worker.js`) loads, only when a LaTeX template is used. Everything
but this file, its Spanish twin and `worker.js` is made by `scripts/latex-assets.sh`, which the Pages deploy runs; it
is not in the repository. See `docs/security.md` for how it runs.

| File | What it is | Licence |
| :--- | :--- | :--- |
| `busytex.js` and `busytex.wasm` | The engines of [texlyre-busytex](https://github.com/TeXlyre/texlyre-busytex), release [1.4.1](https://github.com/TeXlyre/texlyre-busytex/releases/tag/assets-v1.4.1), unchanged: pdfTeX, XeTeX, xdvipdfmx and the rest of TeX Live 2026's programs in one WebAssembly module. Their source is in that repository and in [texlyre-busytex-build](https://github.com/TeXlyre/texlyre-busytex-build). | AGPL-3.0; the TeX Live programs inside keep their own (see [TeX Live's licensing](https://tug.org/texlive/LICENSE.TL)) |
| `pdftex.tar.gz` | For pdfLaTeX: files of TeX Live 2026 as Alpine packs them, in TeX Live's layout (`texmf-dist/`, with its `ls-R` and `texmf.cnf`): the packages in `scripts/latex/common.tex` and the fonts they use, and FontAwesome 5 from TeX Live 2022's final archive; and `pdflatex.fmt`, LaTeX's format, made by the engine above from TeX Live's sources. Their names are in `pdftex-files.txt`. | Each file keeps its own: mostly the LaTeX Project Public License, and the GUST Font License, the SIL Open Font License, the GPL or public domain for some; see each file's header and [TeX Live's licensing](https://tug.org/texlive/LICENSE.TL). |
| `xetex.tar.gz` | The same for XeLaTeX (`scripts/latex/common-xetex.tex`, `xelatex.fmt`), with Latin Modern and FontAwesome 5 in OpenType, what xdvipdfmx reads, `fonts.conf`, where fontconfig looks for fonts (Foja's and the template's own, which the user uploads in the editor), and `icudt78l.dat`, the part of [ICU](https://icu.unicode.org/) 78's data that XeTeX reads font names with. Their names are in `xetex-files.txt`. | As above; the fonts under the GUST Font License (Latin Modern) and the SIL Open Font License (FontAwesome 5); ICU's data under the [Unicode License](https://www.unicode.org/license.txt); `fonts.conf` GPL-3.0, as Foja |
| `version.txt` | A hash of the files above: the name they are kept under in the browser. | — |
| `worker.js` | Foja's worker around the engine. | GPL-3.0, as Foja |
