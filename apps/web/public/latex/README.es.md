# LaTeX para las plantillas LaTeX importadas

*[English](README.md) · Español*

Lo que carga el worker de LaTeX del editor (`worker.js`), solo cuando se usa una plantilla LaTeX. Todo
salvo este archivo, su versión en inglés y `worker.js` lo arma `scripts/latex-assets.sh`, que corre el
deploy a Pages; no está en el repositorio. Cómo corre: `docs/security.es.md`.

| Archivo | Qué es | Licencia |
| :--- | :--- | :--- |
| `swiftlatexpdftex.js`, `swiftlatexpdftex.wasm` | El motor pdfTeX de [SwiftLaTeX](https://github.com/SwiftLaTeX/SwiftLaTeX), versión [20-02-2022](https://github.com/SwiftLaTeX/SwiftLaTeX/releases/tag/v20022022), sin cambios. Su código fuente está en ese repositorio. | AGPL-3.0 |
| `texlive.tar.gz` | Archivos de TeX Live 2022 tal como los empaqueta Debian bookworm: el núcleo de LaTeX y las fuentes de su formato, los paquetes de `scripts/latex/common.tex` y las tipografías que usan, y FontAwesome 5 del archivo final de TeX Live 2022. Sus nombres están en `texlive-files.txt`. | Cada archivo conserva la suya: casi todos la LaTeX Project Public License, y algunos la GUST Font License, la SIL Open Font License, la GPL o dominio público; ver el encabezado de cada uno y [las licencias de TeX Live](https://tug.org/texlive/LICENSE.TL). |
| `version.txt` | Un hash de los tres archivos de arriba: el nombre con el que se guardan en el navegador. | — |
| `worker.js` | El worker de Foja alrededor del motor. | GPL-3.0, como Foja |
