# Cómo desarrollar Foja

*[English](development.md) · Español*

Cómo está organizado el repositorio, cómo se corren el editor y los tests, y cómo se arman el sitio y los
instaladores de escritorio.

## Estructura

```
packages/core      formato de proyecto (JSON Schema + tipos), validación, importadores, exportadores y utilidades
packages/template  los nueve estilos de Typst incluidos, su biblioteca, etiquetas y fuentes, y las que incrusta Word
packages/cli       `foja` sobre Node: genera PDF, SVG, paquetes de Typst y todas las exportaciones de un proyecto
apps/web           el sitio y el editor en Astro
apps/desktop       la app de escritorio: el mismo editor en una ventana de Tauri, para Linux, Windows y macOS
examples/          los ejemplos del editor, en español y en inglés, y los fixtures de los tests
cvgen/             la primera versión: el CV del autor como datos y sus generadores en Python (LaTeX) y C
scripts/           tests de punta a punta, los archivos de LaTeX, imágenes y versiones de escritorio
```

## Cómo se corre

Las dependencias de Node viven solo dentro de contenedores de Podman sin root, que montan el repositorio en solo
lectura: lo que escriben (dependencias, compilaciones, la salida de la CLI) va a volúmenes.

```sh
mkdir -p node_modules apps/web/node_modules apps/web/.astro apps/web/dist .out   # una sola vez: sus puntos de montaje
podman compose up                                   # Astro con recarga en caliente, detrás de nginx, en el puerto 8090
podman compose run --rm web npm test                # tests unitarios
podman compose run --rm web npm run foja -- build examples/curriculum.project.json --out .out
podman volume export foja_out | tar -x -C .out      # copia a .out/ lo que escribió la CLI
```

`npm run foja -- …` corre la línea de comandos desde su código fuente, con todos los subcomandos de su
[README](../packages/cli/README.es.md).

## Tests

- `npm test` (Vitest) corre los tests unitarios de todos los paquetes, del sitio y de la documentación.
- `scripts/e2e.sh` corre los tests de punta a punta contra el stack de desarrollo en marcha, con Playwright y un
  Chromium headless en un contenedor que comparte la red del stack; desde ahí no se llega a nada del host.
- `scripts/e2e-pwa.sh` genera el sitio como lo sirve GitHub Pages (bajo `/foja/`) y lo verifica, uso sin conexión
  incluido.
- `scripts/length.sh` exporta cada perfil de los proyectos de ejemplo en cada estilo incluido y compara las páginas
  del PDF de Typst, de la exportación a LaTeX compilada con TeX Live y de la exportación a Word abierta en
  LibreOffice, en un contenedor propio (`tests/length/`); usa las dependencias que instaló el stack de desarrollo.
  `--only <proyecto>/<perfil>` y `--style <id>` lo acotan.
- `scripts/word-fonts.py` arma las fuentes que incrusta la exportación a Word (`packages/template/word-fonts/`) a
  partir de las de Typst, con fontTools: XCharter en TrueType, y las dos con un solo juego de métricas verticales.
- `scripts/latex-assets.sh` arma los motores de LaTeX y los archivos de TeX Live que usan las plantillas LaTeX
  importadas, en `apps/web/public/latex/` ([qué son](../apps/web/public/latex/README.es.md)). No están en el
  repositorio: los arma el deploy, y los tests de LaTeX necesitan que el script se haya corrido una vez.

**Dos idiomas.** El editor, la página de inicio, la línea de comandos y los documentos están en español y en inglés:
un texto va en los dos catálogos (`apps/web/src/editor/i18n.ts`, `apps/web/src/landing.ts`,
`packages/cli/src/messages.ts`) y un documento `nombre.md` tiene al lado su `nombre.es.md`, cada uno con un enlace al
otro. Los tests fallan si falta alguno.

## Imágenes

- `scripts/screenshot.sh` vuelve a sacar, a partir del ejemplo, la captura del editor de la página de inicio
  (`apps/web/public/screenshot.jpg`), con el contenedor de los tests de punta a punta. Hay que volver a sacarla cuando
  cambian el ejemplo o el aspecto del editor.
- `scripts/og-image.sh` genera las imágenes de vista previa de los links (`apps/web/public/og.jpg` y `og.en.jpg`, a
  partir de `scripts/og-image.html`), con Chrome e ImageMagick del host.

## Deploy y versiones

- **El sitio:** Actions → *Deploy to GitHub Pages*, que se corre a mano. Un push a `main` solo corre los tests y la
  compilación (*CI*).
- **La app de escritorio** (`apps/desktop`) es una ventana de Tauri 2 alrededor del sitio generado con
  `FOJA_DESKTOP=1`, que deja afuera el service worker. `scripts/desktop.sh` la compila para Linux en un contenedor (un
  `.deb`, un `.rpm` y un AppImage, en `.out/desktop/`); antes hay que correr una vez `scripts/latex-assets.sh`, o la
  app queda sin LaTeX. Los instaladores de todos los sistemas salen del workflow *Desktop installers*, que se corre a
  mano: los arma en los runners de Linux, Windows y macOS de GitHub y los deja en un borrador de release de la versión
  de `apps/desktop/package.json`, que `src-tauri/Cargo.toml` repite. Al publicar esa release se crea su tag; su texto
  es `.github/release-notes.md`.
- **La CLI en npm** (`@bafif/foja`): `scripts/cli-pack.sh` arma el paquete en un contenedor, en `.out/cli/`, y
  `npm publish .out/cli/bafif-foja-<versión>.tgz` lo publica sin compilar nada en el host. La versión es la de
  `packages/cli/package.json`.
