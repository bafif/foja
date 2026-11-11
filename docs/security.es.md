# Modelo de seguridad

*[English](security.md) · Español*

Foja abre archivos hechos por otras personas: proyectos (`.foja.json`), que pueden traer **estilos
escritos en Typst**, y temas de interfaz (`.foja-theme.json`). Esta página explica qué puede hacer
un archivo así y qué no.

## Proyectos y estilos

Un estilo es código Typst. Typst es un lenguaje aislado: no tiene shell ni acceso propio a la red,
y solo lee archivos dentro de la raíz de su proyecto.

- **En el navegador**, el compilador corre en un Web Worker y solo ve el proyecto, la biblioteca y
  los estilos de Foja, y la foto del proyecto. No puede leer nada más de tu computadora.
- **En la CLI**, cada compilación recibe como raíz un directorio temporal vacío, y los mismos
  archivos virtuales se mapean adentro. Un estilo que intente `read("/etc/…")`, `../` o `/proc`
  recibe «file not found» (probado).
- Las importaciones de paquetes (`#import "@preview/…"`) no están disponibles en el navegador. La
  biblioteca de Typst de la CLI puede descargar paquetes del registro oficial de Typst.
- La vista previa muestra el SVG de Typst sin su script, sin su capa de texto HTML y sin ningún
  enlace, así que un estilo no puede meter en la página enlaces `javascript:` clickeables ni
  marcado (probado).
- La exportación a LaTeX codifica las URLs con porcentajes y escapa todos los caracteres especiales
  del texto, así que un campo de contacto no puede inyectar TeX (`\input`, `\write`) en `cv.tex`
  (probado y compilado).
- Un estilo que tarda demasiado (un bucle infinito) se corta a los 20 segundos y el editor lo avisa.

## Plantillas importadas

Una plantilla de Typst o de LaTeX que escribió otra persona es un dato hasta que Typst o LaTeX la compila:

- Foja la lee con reglas fijas (`packages/core/src/importer/`): recorre el código, nunca lo ejecuta, y no llama a ningún
  modelo ni servicio.
- Un `.zip` o un `.tar.gz` se descomprime con el descompresor propio de la plataforma, con topes: como mucho 400
  archivos y 20 MB descomprimidos, contados mientras se descomprime, así que un archivo chico que se inflaría a gigas se
  corta enseguida. Se rechazan las rutas absolutas, las que tienen `..`, las barras invertidas y los enlaces.
- Sus archivos van al proyecto, con el estilo, y el compilador los ve bajo `/custom/<id>/`, en el mismo encierro que
  cualquier estilo: no se puede leer nada fuera del proyecto (probado).
- Los paquetes `@preview` no se bajan nunca: se usan los que vinieron en el archivo, y el editor nombra los que faltan.
  Las fuentes de una plantilla de Typst se dejan afuera (el compilador tiene solo las de Foja); las de una plantilla
  LaTeX quedan con su estilo, para XeLaTeX.
- La licencia de la plantilla, si la tiene, queda guardada con el estilo.
- El aspecto de una plantilla LaTeX se compila en el navegador con el motor pdfTeX de
  [texlyre-busytex](https://github.com/TeXlyre/texlyre-busytex), o con sus motores XeTeX y xdvipdfmx (TeX Live 2026 en
  WebAssembly, AGPL-3.0, sin cambios), cada motor en un worker propio que se carga solo cuando se usa una plantilla
  LaTeX. El motor y los archivos de TeX Live y las fuentes que puede leer vienen del mismo sitio
  (`apps/web/public/latex/`, armados en cada deploy por `scripts/latex-assets.sh`, con el motor, FontAwesome y los datos
  de ICU verificados contra SHA-256 fijos) y quedan en Cache Storage bajo un hash de ellos. Las fuentes que se suben
  para una plantilla XeLaTeX quedan en el proyecto, con su estilo; Foja lee de ellas solo sus nombres y su estilo, con
  cada lectura verificada contra el tamaño del archivo (`packages/core/src/fonts.ts`), y XeTeX las usa en su worker.
  Cada archivo se pone en el sistema de archivos en memoria del motor antes de compilar: no usa la red mientras compila
  (su búsqueda de archivos faltantes en un servidor de TeX Live está apagada), y lo que no está no se encuentra. No hay
  shell al que escapar (`\write18` no tiene qué ejecutar en WebAssembly), una compilación que no termina se corta, y lo
  que el motor puede escribir queda en su memoria.

## La app web

Las páginas de producción llevan una Content Security Policy: scripts solo del propio sitio (y
WebAssembly para el compilador), **conexiones solo al propio sitio**, sin plugins, y formularios solo
hacia Overleaf. Si algo se llegara a colar, no podría cargar nada de otro lado ni mandar tus datos a
ningún sitio que no sea overleaf.com.

«Abrir en Overleaf» es lo único que manda el CV fuera de tu dispositivo, y solo cuando lo tocás: la
exportación a LaTeX va directo a overleaf.com, en una pestaña nueva, sin pasar por ningún servidor
de Foja. La app de escritorio no tiene ese botón y no deja mandar formularios.

## Temas

Un tema es datos, no código: un archivo JSON cuyos valores se validan contra una lista cerrada
(colores, una longitud, nombres de fuentes) y se escriben únicamente en propiedades personalizadas
de CSS. Se rechazan `url()`, `;`, las llaves y cualquier otra cosa (probado). La API
`window.foja.themes` recibe los mismos datos, con los mismos controles; existe para scripts que
corre el propio usuario, y la página no carga ninguno de afuera.

## Reportes

Si encontrás un problema de seguridad, reportalo en privado con «Report a vulnerability» de GitHub
en [bafif/foja](https://github.com/bafif/foja/security), no en un issue público.