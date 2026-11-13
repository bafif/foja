# foja

*[English](https://github.com/bafif/foja/blob/main/packages/cli/README.md) · Español*

La línea de comandos de [Foja](https://github.com/bafif/foja), un editor de CV sobre Typst: arma
CV a partir de un proyecto de Foja (`.foja.json`, hecho en el editor o a mano) con los mismos estilos de
Typst que usa el editor web.

Se instala con `npm install -g @bafif/foja`, que trae el comando `foja`, y `npx @bafif/foja build …` la corre sin
instalarla. Desde una copia del repositorio, `npm run foja -- build …` la corre desde su código fuente
([cómo](https://github.com/bafif/foja/blob/main/docs/development.es.md)).

```sh
foja build my.foja.json                       # un PDF por perfil
foja build my.foja.json --profile dev --format pdf --format docx --out out
foja build my.foja.json --format all          # todos los formatos en un solo .zip
foja validate my.foja.json
foja import plantilla.zip my.foja.json        # una plantilla de Typst o LaTeX: su contenido y su aspecto
foja import cv.json my.foja.json              # un CV en JSON Resume
```

`import` lee una plantilla de CV de Typst o de LaTeX (`.typ`, `.tex`, `.zip` o `.tar.gz`) con reglas fijas, sin IA: su
contenido de ejemplo pasa a ser un perfil y su aspecto un estilo propio; `--into` los suma a un proyecto que ya existe y
`--no-style` deja afuera el aspecto. Toma la propuesta de las reglas tal como sale; el editor la muestra antes para
revisarla. Este comando no tiene LaTeX: un perfil con una plantilla LaTeX da su `.tex` lleno (`--format tex`) y no PDF.
Un `.json` es un CV en [JSON Resume](https://jsonresume.org): sus entradas pasan al banco y queda un perfil con sus
secciones.

Formatos: `pdf`, `svg`, `typ` (un `.zip` que compila con `typst compile` a secas), `tex` (LaTeX), `md`, `json`,
`jsonresume` (el perfil en JSON Resume; avisa lo que no tiene lugar ahí), `docx` (Word), `all`. Necesita Node 24 o
posterior. Los mensajes y `--help` salen en español si el sistema está en español, y en inglés si no; `--lang es` o
`--lang en` elige uno.

El formato del proyecto está descrito en su JSON Schema
([`project.schema.json`](https://github.com/bafif/foja/blob/main/packages/core/schema/project.schema.json));
los estilos propios, escritos en Typst, se explican en
[`docs/templates.es.md`](https://github.com/bafif/foja/blob/main/docs/templates.es.md).

Licencia: GPL-3.0. Las fuentes incluidas conservan sus propias licencias (archivos al lado de ellas en
`dist/template/fonts`).