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

## La app web

Las páginas de producción llevan una Content Security Policy: scripts solo del propio sitio (y
WebAssembly para el compilador), **conexiones solo al propio sitio**, sin plugins ni formularios.
Si algo se llegara a colar, no podría cargar nada de otro lado ni mandar tus datos afuera.

## Temas

Un tema es datos, no código: un archivo JSON cuyos valores se validan contra una lista cerrada
(colores, una longitud, nombres de fuentes) y se escriben únicamente en propiedades personalizadas
de CSS. Se rechazan `url()`, `;`, las llaves y cualquier otra cosa (probado). La API
`window.foja.themes` recibe los mismos datos, con los mismos controles; existe para scripts que
corre el propio usuario, y la página no carga ninguno de afuera.

## Reportes

Si encontrás un problema de seguridad, reportalo en privado con «Report a vulnerability» de GitHub
en [bafif/foja](https://github.com/bafif/foja/security), no en un issue público.