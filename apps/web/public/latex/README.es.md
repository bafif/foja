# LaTeX para las plantillas LaTeX importadas

*[English](README.md) · Español*

Lo que carga el worker de LaTeX del editor (`worker.js`), solo cuando se usa una plantilla LaTeX. Todo
salvo este archivo, su versión en inglés y `worker.js` lo arma `scripts/latex-assets.sh`, que corre el
deploy a Pages; no está en el repositorio. Cómo corre: `docs/security.es.md`.

| Archivo | Qué es | Licencia |
| :--- | :--- | :--- |
| `busytex.js` y `busytex.wasm` | Los motores de [texlyre-busytex](https://github.com/TeXlyre/texlyre-busytex), versión [1.4.1](https://github.com/TeXlyre/texlyre-busytex/releases/tag/assets-v1.4.1), sin cambios: pdfTeX, XeTeX, xdvipdfmx y el resto de los programas de TeX Live 2026 en un solo módulo de WebAssembly. Su código fuente está en ese repositorio y en [texlyre-busytex-build](https://github.com/TeXlyre/texlyre-busytex-build). | AGPL-3.0; los programas de TeX Live que trae conservan la suya (ver [las licencias de TeX Live](https://tug.org/texlive/LICENSE.TL)) |
| `pdftex.tar.gz` | Para pdfLaTeX: archivos de TeX Live 2026 tal como los empaqueta Alpine, con la estructura de TeX Live (`texmf-dist/`, con su `ls-R` y su `texmf.cnf`): los paquetes de `scripts/latex/common.tex` y las tipografías que usan, y FontAwesome 5 del archivo final de TeX Live 2022; y `pdflatex.fmt`, el formato de LaTeX, que arma el motor de arriba con las fuentes de TeX Live. Sus nombres están en `pdftex-files.txt`. | Cada archivo conserva la suya: casi todos la LaTeX Project Public License, y algunos la GUST Font License, la SIL Open Font License, la GPL o dominio público; ver el encabezado de cada uno y [las licencias de TeX Live](https://tug.org/texlive/LICENSE.TL). |
| `xetex.tar.gz` | Lo mismo para XeLaTeX (`scripts/latex/common-xetex.tex`, `xelatex.fmt`), con Latin Modern y FontAwesome 5 en OpenType, lo que lee xdvipdfmx, `fonts.conf`, dónde busca fuentes fontconfig (las de Foja y las de la plantilla, que el usuario sube en el editor), e `icudt78l.dat`, la parte de los datos de [ICU](https://icu.unicode.org/) 78 con la que XeTeX lee los nombres de las fuentes. Sus nombres están en `xetex-files.txt`. | Como arriba; las fuentes, con la GUST Font License (Latin Modern) y la SIL Open Font License (FontAwesome 5); los datos de ICU, con la [Unicode License](https://www.unicode.org/license.txt); `fonts.conf`, GPL-3.0, como Foja |
| `version.txt` | Un hash de los archivos de arriba: el nombre con el que se guardan en el navegador. | — |
| `worker.js` | El worker de Foja alrededor del motor. | GPL-3.0, como Foja |
