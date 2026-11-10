# Foja

*[English](README.md) · Español*

Un editor de CV sin código hecho sobre [Typst](https://typst.app): formularios en vez de código, una vista previa
en vivo que es la salida real de Typst, y exportación a Typst, PDF, JPG, LaTeX, Markdown, JSON y Word.
Todo corre en el navegador; tu CV nunca sale de tu máquina.

- **Perfiles a partir de un solo banco de entradas**: un CV por tipo de trabajo, con las entradas escritas una sola
  vez.
- **Tres estilos propios** (Legajo, Banda, Minimal) con opciones de diseño, y **estilos que escribís vos en Typst**
  («Editar en Typst» copia cualquier estilo en uno tuyo).
- **Disciplina de una página**: la vista previa te dice si el CV entra y qué se pasa; hacé clic en una parte de la
  vista previa para editarla.
- **Exportación**: PDF, JPG, Word, Typst, LaTeX, Markdown, JSON.
- **Privado y sin conexión**: sin cuentas, sin servidor; se instala como app en computadoras y en Android y iPhone;
  en español y en inglés.

Guía de uso: [`docs/guide.es.md`](docs/guide.es.md). Cómo escribir un estilo: [`docs/templates.es.md`](docs/templates.es.md).
Temas de la interfaz: [`docs/themes.es.md`](docs/themes.es.md). Modelo de seguridad: [`docs/security.es.md`](docs/security.es.md).
Línea de comandos: [`packages/cli/README.es.md`](packages/cli/README.es.md).

Foja empezó como cvgen, el generador que escribí para mi propio CV: archivos JSON convertidos en PDF por un
generador en Python a través de LaTeX y por otro en C. Sigue viviendo acá, en
[`cvgen/`](cvgen/README.es.md), con los datos de mi CV, y en su historia empieza la de este repositorio.

Estado: el editor, los exportadores y la CLI funcionan, y el editor está en línea en
<https://bafif.github.io/foja/>, también en celulares. Qué está hecho, qué viene después y por qué:
[`docs/ROADMAP.es.md`](docs/ROADMAP.es.md).

## Estructura

```
packages/core      formato de proyecto (JSON Schema + tipos), validación, utilidades compartidas
packages/template  los estilos de Typst (Legajo, Banda, Minimal), su biblioteca, etiquetas y fuentes
packages/cli       `foja` sobre Node: genera PDF/SVG/paquetes de Typst a partir de un proyecto
apps/web           el sitio y el editor en Astro
examples/          el ejemplo del editor, mi CV con sus tres perfiles (español, inglés); fixtures de prueba: un
                   CV ficticio y mi CV completo (teléfono falso)
cvgen/             la primera versión: los datos de mi CV y los generadores en Python (LaTeX) y C
```


## Desarrollo

Las dependencias de Node viven solo dentro de contenedores de Podman sin root, y el repositorio se monta ahí en solo
lectura: nada de lo que corre en un contenedor puede cambiar las fuentes ni `.git`. Las dependencias y la salida
viven en volúmenes; la caché de Astro es un tmpfs, nuevo en cada contenedor (Astro 7 detiene el pid que encuentra en
`.astro/dev.json`, que en un contenedor nuevo puede ser el propio servidor nuevo).

```sh
mkdir -p node_modules apps/web/node_modules apps/web/.astro apps/web/dist .out   # una sola vez: sus puntos de montaje
podman compose up                                   # servidor de desarrollo de Astro con recarga en caliente detrás de nginx
podman compose run --rm web npm test                # tests
podman compose run --rm web npm run foja -- build examples/curriculum.project.json --out .out
podman volume export foja_out | tar -x -C .out      # copia a .out/ lo que escribió la CLI
```

`scripts/e2e-pwa.sh` genera el sitio como lo sirve GitHub Pages (bajo `/foja/`) y lo verifica, uso sin conexión
incluido. `scripts/e2e.sh` corre los tests de punta a punta contra el stack de desarrollo en marcha, con Playwright y
un Chromium headless en un contenedor que comparte la red del stack; desde ahí no se llega a nada del host.
`scripts/screenshot.sh` usa el mismo contenedor para volver a sacar, a partir del ejemplo, la captura del editor que
aparece en la página de inicio (`apps/web/public/screenshot.jpg`); hay que volver a sacarla cada vez que cambian el
ejemplo o el aspecto del editor. Después, `scripts/og-image.sh` vuelve a generar las imágenes de vista previa que
muestran X, WhatsApp y otras apps al compartir el link (`apps/web/public/og.jpg` y `og.en.jpg`, a partir de
`scripts/og-image.html`), con Chrome e ImageMagick del host.

## Licencia

GPL-3.0. Ver [LICENSE](LICENSE).