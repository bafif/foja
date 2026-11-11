# Hoja de ruta de Foja

*[English](ROADMAP.md) · Español*

Foja es un editor de CV sin código construido sobre [Typst](https://typst.app). En vez de escribir código completás formularios, la vista previa que tenés al lado es la salida real de Typst, y el CV se exporta a PDF, JPG, Word, Typst, LaTeX, Markdown y JSON. Todo corre en el navegador: no hay cuentas ni servidor, y el CV nunca sale de tu máquina.

En este documento dejo qué pretende ser Foja, qué ya está hecho, qué viene después y por qué tomé las decisiones principales. Cómo se usa el editor está en la
[guía de uso](guide.es.md).

## Por qué lo hago

Mi propio CV era un conjunto de archivos JSON que un generador en Python convertía en PDF pasando por LaTeX (todavía está en [`cvgen/`](../cvgen/README.es.md), junto a un segundo generador en C). Funcionaba, pero cada cambio implicaba editar archivos a mano y esperar a que compilara LaTeX, y nadie más podía usarlo. Quería la misma idea, un único banco de entradas y un CV por cada tipo de trabajo, con una interfaz de verdad arriba y Typst abajo.

Typst ya tiene un editor online oficial (typst.app), pero ahí escribís código. Lo más parecido que hay son RenderCV (de YAML a Typst, como CLI y como app web) y las plantillas de CV de Typst Universe, que también se editan como código. No encontré un generador de CV basado en formularios sobre Typst, así que ese es el hueco que apunta a llenar Foja: formularios, vista previa en vivo y muchas exportaciones, no otro editor de código.

Un solo producto, tres maneras de usarlo, todas desde la misma versión:

1. **Una app web** que cualquiera puede abrir e instalar, y que va creciendo con el tiempo.
2. **Una app de escritorio** que se instala como cualquier otra en Linux, macOS y Windows.
3. **Una línea de comandos** (`foja`), que reemplaza al viejo generador de mi CV.

## Principios de diseño

- **La plantilla de Typst es el generador.** Los estilos leen el JSON del proyecto y arman el CV
  por su cuenta, así que el navegador, la app de escritorio y la CLI ejecutan exactamente los mismos archivos `.typ`.
  Nada genera código Typst por afuera.
- **Local primero, sin servidor.** La versión web es el producto: Typst compila a WebAssembly en un
  worker, los proyectos viven en IndexedDB y la app de escritorio envuelve esa misma versión. Un sitio estático
  no tiene servidor que pagar ni nada que atacar, y los datos del CV quedan en manos de su dueño.
- **Costo cero, siempre.** El proyecto nunca paga nada: ni certificados de firma de código, ni
  cuenta de desarrollador de Apple, ni hosting pago, ni dominio pago. Cada elección es la mejor opción gratuita.
- **Un único documento de proyecto autocontenido.** Un solo archivo JSON (formato `foja/3`; los anteriores se migran al cargarlos) guarda la
  persona, los contactos, los grupos de habilidades, el banco compartido de entradas, los perfiles, los estilos propios y la
  foto. Un JSON Schema es el contrato entre la plantilla, los exportadores, el editor y la CLI.
- **Dos niveles, bien explícitos.** El banco guarda cada entrada una sola vez; un perfil elige qué entradas
  van y dónde. Al editar una entrada te avisa en qué otros lugares se usa, y sacarla de un perfil nunca
  la borra.
- **La disposición es un dato.** Columnas, lado y ancho de la barra lateral, forma de la foto, fuente, tamaño, color de acento,
  márgenes, densidad, tamaño de página, formato de fecha e idioma de las etiquetas son opciones de cada perfil, que leen
  tanto los estilos de Typst como el exportador de Word.
- **Bloques con tipo.** Las secciones contienen bloques (una entrada del banco, un ítem, un párrafo) y los
  estilos los muestran según su tipo, lo que deja lugar para nuevos tipos de bloque más adelante.
- **Disciplina de una página.** La vista previa siempre te dice si el CV entra en una página y, si no,
  qué partes se pasan.
- **Se espera entrada no confiable.** Un proyecto o un estilo puede venir de otra persona, así que la
  vista previa le saca al SVG los scripts, el HTML embebido y los enlaces, la CLI compila en una raíz temporal
  vacía y cada exportador escapa lo que escribe. Los detalles están en el
  [modelo de seguridad](security.es.md).
- **Sin acceso al control de versiones.** Ni la app ni sus exportaciones tocan los repositorios de nadie.

## Decisiones

### Cómo se distribuye

Comparé tres opciones: una app web local en un contenedor, una app nativa en Tauri con un sidecar en Python,
y un núcleo web que hace todo el renderizado en el navegador, envuelto con Tauri para el escritorio.

La tercera ganó en todo lo que importaba. Un runtime de contenedores es una mala instalación para gente
que no es desarrolladora, sobre todo en macOS y Windows. Un sidecar de Python congelado hace que los instaladores sean pesados
y que firmarlos sea un dolor de cabeza (el sidecar hay que firmarlo aparte, y el hardened runtime de macOS
rompe PyInstaller si no le dedicás trabajo extra). El núcleo en el navegador da una app web pública con hosting
estático y sin servidor, instaladores chicos que usan el webview del sistema y una vista previa sin ida y vuelta
por la red. LaTeX se exporta como código fuente, porque una distribución de TeX completa en WebAssembly descarga
unos 120 MB; solo una plantilla LaTeX importada se compila dentro de la app, con pdfTeX o XeTeX y un grupo chico de
paquetes comunes y fuentes libres (unos 9 o 12 MB, que se bajan la primera vez que se usa una).

Los contenedores (Podman sin root) quedan solo para desarrollo, con recarga en caliente detrás de nginx.

### Canales de distribución gratuitos

- **Web**: un sitio estático en GitHub Pages, instalable como PWA desde Chrome, Edge o Safari. Aparece
  en el menú de aplicaciones del sistema, funciona sin conexión, se actualiza sola y no necesita firma.
- **Windows**: la Microsoft Store. El registro individual es gratis y la Store firma los paquetes
  MSIX, así que la PWA empaquetada con PWABuilder evita las advertencias de SmartScreen sin costo.
- **Linux**: Flathub. No acepta apps que solo envuelven una página web, así que la app de Linux es un shell de Tauri
  con integración real con el escritorio: proyectos que se abren y se guardan a través del portal de selección de archivos, su
  propio tipo de archivo, recursos empaquetados y una compilación desde el código fuente. También AUR y paquetes comunes en GitHub
  Releases.
- **macOS**: no hay notarización gratuita, y el repositorio principal de casks de Homebrew ahora rechaza las apps
  que no pasan Gatekeeper, así que ahí la vía principal es la PWA. Igual se puede ofrecer una versión con firma ad hoc
  en GitHub Releases, con instrucciones.
- **Instaladores firmados para Windows por fuera de la Store**: SignPath Foundation firma proyectos de código abierto
  gratis una vez que tienen cierta reputación.
- **Android**: la PWA se instala desde Chrome como una app de verdad (Chrome la empaqueta como WebAPK), con
  su ícono en el cajón de aplicaciones. Más adelante puede haber un paquete nativo a partir del mismo shell de Tauri 2 que la
  app de escritorio, que también compila para Android, en GitHub Releases y en F-Droid si cumple sus
  reglas de compilación. Google Play cobra una tarifa de registro, así que queda afuera.
- **iPhone y iPad**: la App Store exige el Apple Developer Program, que es pago, así que la app de iOS es la PWA agregada a
  la pantalla de inicio desde Safari. Una versión instalada con un Apple ID gratuito vence
  a los siete días, y así no hay forma de dársela a nadie.
- **CLI**: npm.

### Exportadores en TypeScript

Primero pensé en conservar los exportadores en Python y correrlos en el navegador con Pyodide.
TypeScript fue mejor en calidad y en velocidad: la biblioteca `docx` soporta de forma nativa el sombreado de tablas,
las celdas combinadas, las columnas de sección y las imágenes flotantes (con `python-docx` todo eso requiere OOXML
crudo), y hay un único esquema y un único conjunto de tipos que comparten los formularios, la
validación, los exportadores y la CLI. Pyodide además habría sumado segundos de arranque en la
primera exportación y un puente entre dos runtimes.

### Astro en vez de Next.js

El editor es completamente del lado del cliente, y las páginas públicas tienen que cargar rápido. Los puntos fuertes de Next.js
(renderizado en el servidor, server actions, optimización de imágenes) no sirven en una exportación estática, y su
configuración de WebAssembly en workers necesita ajustar el bundler. Astro genera páginas estáticas por defecto,
está construido sobre Vite (que maneja WebAssembly y module workers de forma nativa), no manda nada de JavaScript en
la página de inicio y tiene una acción oficial para GitHub Pages. El editor es una isla de React adentro,
con Tailwind, Zustand (más `zundo` para deshacer) y dnd-kit.

### Una estética propia

La primera plantilla reproducía la estética de mi CV en LaTeX, que se basa en la plantilla Wenneker
(CC BY-NC-SA). Antes de publicar la reemplacé, y con ella las exportaciones a LaTeX y Word, por
tres estilos propios de Foja: **Legajo** (el predeterminado: XCharter, versalitas, una barra lateral con tinte,
fechas en una columna propia), **Banda** (una banda de color de lado a lado arriba, Noto Sans) y
**Minimal** (negro sobre blanco, jerarquía solo con tamaño y peso). La interfaz recibió el mismo
tratamiento: tres temas, Papel y tinta, Neutro y Vivo, cada uno en claro y oscuro.

## Qué está hecho

El trabajo hasta ahora, en el orden en que se dio:

- **Una prueba de concepto** (30 de octubre de 2026) para comprobar que la vista previa en vivo sin servidor es viable: una plantilla
  de Typst que lee el CV como JSON, compilada por typst.ts en un Web Worker sobre una página de Astro pelada. En
  una CPU modesta de cuatro núcleos, un cambio de un carácter tarda unos 50 ms de Typst y 4 ms de renderizado
  del SVG, así que la vista previa puede seguir cada tecla. El compilador ocupa 28 MB de WebAssembly (7
  MB con brotli), lo que significa que la primera visita necesita un estado de carga y que el service worker tiene
  que precachearlo.
- **El formato de proyecto y la CLI.** El formato `foja/2` con su JSON Schema y un validador chico
  (sin dependencias extra) que además revisa referencias que el esquema no puede expresar; las
  opciones de disposición; un conversor desde la vieja estructura de varios archivos de mi CV; y el comando `foja`,
  que genera PDF, SVG y un paquete de Typst que compila solo con un simple `typst compile`.
- **Los exportadores.** Todos parten de un mismo perfil resuelto (entradas buscadas, fechas
  formateadas, etiquetas aplicadas): LaTeX como un `cv.tex` autocontenido escrito para Foja, Markdown,
  JSON (el archivo del proyecto y el perfil resuelto), Word con una o dos columnas, JPG desde el
  navegador y un `.zip` con todo.
- **El editor.** Paneles para los datos personales, los contactos, los grupos de habilidades y el banco de entradas;
  perfiles con sus secciones y su disposición; validación en línea ligada a cada campo; guardado automático en
  IndexedDB; deshacer y rehacer; la vista previa en vivo con el indicador de si entra en la página; y el diálogo de exportación.
- **Pulido.** Hacer clic en la vista previa para editar lo que está debajo del puntero, la selección marcada
  en la vista previa, las partes que se pasan de la primera página resaltadas con un tinte, arrastrar y soltar secciones y bloques
  (con una alternativa por teclado), una paleta de comandos y recorte de la foto.
- **Sin conexión e instalable.** Un service worker escrito sin framework (el plugin de PWA no
  soportaba la versión de Astro), un manifiesto, la página de inicio, versiones bajo la ruta base `/foja/`
  y los workflows de GitHub (tests y compilación en cada push; el despliegue a Pages se corre solo
  a mano hasta que publique).
- **Estilos y temas propios.** Los tres estilos de arriba, una biblioteca de Typst compartida para escribir
  más, «Editar en Typst» para copiar cualquier estilo a uno propio, un editor de estilos con los errores mostrados
  arriba de la vista previa, y temas de interfaz que se pueden ampliar con un archivo de tema chico y validado
  o desde un script.
- **Detalles de la interfaz.** Cada par de texto y fondo cumple el contraste WCAG AA en todos los temas, las
  tarjetas de estilo muestran el perfil actual en cada estilo, hay una disposición para teléfono con un panel a la vez, y la
  interfaz está en español y en inglés.
- **Una revisión antes de lanzar.** Hice revisar todo el código desde cero y arreglé lo que
  apareció: un estilo podía leer archivos locales a través de la CLI y podía meter enlaces `javascript:` en
  la vista previa; se podía inyectar LaTeX a través de las URL de los contactos; empezar un proyecto nuevo reemplazaba el
  anterior para siempre, y dos pestañas se pisaban el guardado automático; un estilo lento podía congelar
  la vista previa; el service worker podía romper las pestañas abiertas al actualizarse; y había varias falencias de
  accesibilidad. Mis tres perfiles reales ahora entran en una página con Legajo, y la vista previa reemplaza solo las
  páginas que cambiaron, así que los CV largos ya no traban la escritura.
- **En línea** (7 de noviembre de 2026). El sitio está en GitHub Pages en
  [`bafif.github.io/foja/`](https://bafif.github.io/foja/). El despliegue todavía se corre a mano
  (Actions → Deploy to GitHub Pages), así que un push a `main` no publica por sí solo.
- **Teléfonos.** La disposición para teléfono ya estaba; el resto del trabajo fue lo que un teléfono hace
  distinto. Las exportaciones van al menú de compartir del sistema (Guardar en Archivos, correo, apps de mensajería),
  porque una descarga desde una app web instalada en un iPhone muchas veces no hace nada. Los campos usan texto de 16 px
  en pantallas táctiles para que Safari no haga zoom sobre ellos. En teléfonos y en la app instalada,
  Foja le pide al navegador que conserve el proyecto cuando se queda sin espacio. El menú tiene un botón «Instalar»
  donde Chrome lo ofrece, y en un iPhone muestra los pasos en su lugar, igual que la pantalla
  de bienvenida, porque un sitio que queda en una pestaña de Safari pierde sus datos después de una semana sin usarse. iOS además
  tiene su propio ícono para la pantalla de inicio.

## Qué viene después

En este orden:

1. **Probarlo en teléfonos reales**, un Android con Chrome y un iPhone con Safari: instalarlo, editar,
   exportar a través del menú de compartir y usarlo sin conexión. Los tests automáticos emulan un teléfono en
   Chromium, que no tiene ni las mañas de Safari ni un menú de compartir de verdad.
2. **Publicar la CLI en npm** como `foja` (el nombre seguía libre a fines de octubre de 2026). El
   paquete ya se empaqueta solo con `npm pack`; falta una cuenta de npm y
   `npm publish -w packages/cli`.
3. **Microsoft Store**: abrir una cuenta individual gratuita de Partner Center y después empaquetar la
   PWA publicada como MSIX con PWABuilder.
4. **App de escritorio y Flathub**: el shell de Tauri 2 con acceso nativo a archivos, un Flatpak compilado desde
   el código fuente y la postulación a Flathub. También AUR y versiones sin firmar para macOS y Windows en
   GitHub Releases, y SignPath Foundation para Windows una vez que el proyecto califique.
5. **Paquete para Android**: el mismo shell de Tauri 2 compilado para Android, como APK en GitHub Releases
   y, si califica, en F-Droid. En iPhone la app sigue siendo la PWA (ver los canales de
   distribución más arriba).

Cosas más chicas que pueden entrar en cualquier momento:

- Abrir la exportación de Word en Word y en LibreOffice. Por ahora los archivos solo se verifican como paquetes
  válidos, porque no tengo ninguno de los dos programas instalados en mi máquina.
- Un botón «Abrir en Overleaf». Overleaf recibe los archivos en un POST a `overleaf.com/docs`, lo que
  manda el CV a un tercero, así que tiene que ser una acción explícita y probada contra el servicio real.
- Importación y exportación de [JSON Resume](https://jsonresume.org), el esquema abierto para currículums.
- **Versiones**, desactivadas por defecto: instantáneas al guardar y versiones con nombre («enviado a Acme») con
  vista previa, comparación de campos y restauración, guardadas con el proyecto. Un historial dentro de la app, no
  un enlace a ningún sistema de control de versiones.

Limitaciones conocidas: la exportación a LaTeX corta las líneas un poco distinto que Typst y puede pasarse
unas líneas de una página cuando el PDF entra (la guía de uso lo aclara).

### A largo plazo

Un editor de Typst general, gráfico y en vivo, pensado alrededor de la libertad: juntás bloques (texto, listas,
entradas, imágenes, formas), los acomodás en la página y la plantilla los convierte en Typst. El
CV es el primer producto montado sobre esa idea. Los bloques con tipo del modelo de datos dejan la puerta
abierta sin tener que construirlo ahora; hasta entonces todo sigue enfocado en CV.

## Nombre y direcciones

El nombre viene de *foja de servicios*, el registro de la trayectoria de alguien. El código vive en mi
propia cuenta de GitHub.

- Código: [`bafif/foja`](https://github.com/bafif/foja), público, GPL-3.0 (una licencia OSI, como
  exige SignPath). Los datos de mi propio CV y los primeros generadores viven en `cvgen/`.
- Web: `bafif.github.io/foja/`. Más adelante un dominio propio puede servir el mismo sitio en su raíz sin
  ningún otro cambio.
- npm: `foja`. ID de la app en Flathub: `io.github.bafif.Foja`.

## Dependencias

Todas libres y de código abierto, y todos los paquetes de Node se instalan solo dentro del contenedor de desarrollo:
Astro, React, Tailwind, Zustand y `zundo`, dnd-kit, typst.ts (compilador web, renderizador y el
compilador de Node para la CLI), `docx`, y Vitest y Playwright para los tests. No hay biblioteca de ZIP ni de
JSON Schema: las dos cosas son lo bastante chicas como para tenerlas en `packages/core`. Las fuentes incluidas son
XCharter, Latin Modern Mono y Noto Sans, cada una con su licencia al lado. La app de escritorio va a
sumar el toolchain de Rust, Tauri 2 y `flatpak-builder`.

## Fuentes

- Versiones de typst.ts: <https://github.com/Myriad-Dreamin/typst.ts/releases>
- Versiones de Typst: <https://github.com/typst/typst/releases>
- Plantillas de CV en Typst y RenderCV: <https://typst.app/universe/package/rendercv/>,
  <https://typst.app/universe/package/brilliant-cv/>
- Tauri con un sidecar de PyInstaller, problemas de firma:
  <https://github.com/phoson-lat/Phoson-Desktop/pull/11>,
  <https://github.com/ActivityWatch/activitywatch/issues/1249>
- LaTeX en el navegador: <https://github.com/TeXlyre/texlyre-busytex>,
  <https://github.com/SwiftLaTeX/SwiftLaTeX>
- Distribución gratuita: registro y firma en la Microsoft Store
  <https://blogs.windows.com/windowsdeveloper/2025/05/19/microsoft-store-expands-opportunities-for-windows-app-developers/>,
  <https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options>;
  SignPath Foundation <https://github.com/SignPath/github-actions-demo>;
  Homebrew y Gatekeeper <https://brew.sh/2025/11/12/homebrew-5.0.0/>,
  <https://github.com/Homebrew/brew/issues/20755>
- docx (npm): <https://github.com/dolanmiu/docx/blob/master/docs/usage/tables.md>
- Compilador de Node de typst.ts: <https://www.npmjs.com/package/@myriaddreamin/typst-ts-node-compiler>
- Requisitos de Flathub: <https://docs.flathub.org/docs/for-app-authors/requirements>;
  Tauri en Flathub: <https://v2.tauri.app/distribute/flatpak/>
- Reactive Resume: <https://github.com/amruthpillai/reactive-resume>