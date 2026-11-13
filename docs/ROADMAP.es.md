# Hoja de ruta de Foja

*[English](ROADMAP.md) · Español*

Qué pretende ser Foja, los principios y las decisiones que lo sostienen y su porqué, qué está hecho y qué viene
después. Cómo se usa el editor está en la [guía de uso](guide.es.md).

## Para qué está

Typst tiene un editor online oficial (typst.app), pero ahí escribís código. Lo más parecido que hay son RenderCV (de
YAML a Typst, como CLI y como app web) y las plantillas de CV de Typst Universe, que también se editan como código. No
había un generador de CV basado en formularios sobre Typst: ese es el hueco que apunta a llenar Foja, con formularios,
vista previa en vivo y muchas exportaciones, no otro editor de código.

Foja nació de [cvgen](../cvgen/README.es.md), un generador que convierte un conjunto de archivos JSON en un PDF
pasando por LaTeX. Conserva su idea, un único banco de entradas y un CV por cada tipo de trabajo, con una interfaz de
verdad arriba y Typst abajo.

Un solo producto, tres maneras de usarlo, todas desde la misma versión:

1. **Una app web** que cualquiera puede abrir e instalar.
2. **Una app de escritorio** que se instala como cualquier otra en Linux, macOS y Windows.
3. **Una línea de comandos** (`foja`), pensada para reemplazar a cvgen.

## Principios de diseño

- **La plantilla de Typst es el generador.** Los estilos leen el JSON del proyecto y arman el CV por su cuenta, así
  que el navegador, la app de escritorio y la CLI ejecutan exactamente los mismos archivos `.typ`. Nada genera código
  Typst por afuera. La única excepción es una plantilla LaTeX importada, cuyo aspecto lo da LaTeX, que también corre
  en el navegador.
- **Local primero, sin servidor.** La versión web es el producto: Typst compila a WebAssembly en un worker, los
  proyectos viven en IndexedDB y la app de escritorio envuelve esa misma versión. Un sitio estático no tiene servidor
  que pagar ni nada que atacar, y los datos del CV quedan en manos de su dueño.
- **Costo cero, siempre.** El proyecto nunca paga nada: ni certificados de firma de código, ni cuenta de
  desarrollador de Apple, ni hosting pago, ni dominio pago. Cada elección es la mejor opción gratuita.
- **Un único documento de proyecto autocontenido.** Un solo archivo JSON (formato `foja/3`; los anteriores se migran
  al cargarlos) guarda la persona, los contactos, los grupos de habilidades, el banco compartido de entradas, los
  perfiles, los estilos propios y la foto. Un JSON Schema es el contrato entre la plantilla, los exportadores, el
  editor y la CLI.
- **Dos niveles, bien explícitos.** El banco guarda cada entrada una sola vez; un perfil elige qué entradas van y
  dónde. Al editar una entrada te avisa en qué otros lugares se usa, y sacarla de un perfil nunca la borra. La
  prioridad de cada entrada, ítem y habilidad se marca una vez en el banco, y el largo de cada perfil decide qué entra,
  con sus propias excepciones.
- **La disposición es un dato.** Columnas, lado y ancho de la barra lateral, forma de la foto, fuente, tamaño, color
  de acento, márgenes, densidad, tamaño de página, formato de fecha e idioma de las etiquetas son opciones de cada
  perfil, que leen tanto los estilos de Typst como el exportador de Word.
- **Bloques con tipo.** Las secciones contienen bloques (una entrada del banco, un ítem, un párrafo) y los estilos
  los muestran según su tipo, lo que deja lugar para nuevos tipos de bloque más adelante.
- **Disciplina de una página.** La vista previa siempre te dice si el CV entra en una página y, si no, qué partes se
  pasan, y «Ajustar a una página» lo achica de a un paso, en un orden fijo, hasta que entra.
- **Se espera entrada no confiable.** Un proyecto, un estilo o una plantilla pueden venir de otra persona, así que la
  vista previa le saca al SVG los scripts, el HTML embebido y los enlaces, la CLI compila en una raíz temporal vacía y
  cada exportador escapa lo que escribe. Los detalles están en el [modelo de seguridad](security.es.md).
- **Sin acceso al control de versiones.** Ni la app ni sus exportaciones tocan los repositorios de nadie.

## Decisiones

### Cómo se distribuye

Se compararon tres opciones: una app web local en un contenedor, una app nativa en Tauri con un sidecar en Python, y
un núcleo web que hace todo el renderizado en el navegador, envuelto con Tauri para el escritorio.

La tercera ganó en todo lo que importaba. Un runtime de contenedores es una mala instalación para gente que no es
desarrolladora, sobre todo en macOS y Windows. Un sidecar de Python congelado hace que los instaladores sean pesados y
que firmarlos sea un dolor de cabeza (el sidecar hay que firmarlo aparte, y el hardened runtime de macOS rompe
PyInstaller si no se le dedica trabajo extra). El núcleo en el navegador da una app web pública con hosting estático y
sin servidor, instaladores chicos que usan el webview del sistema y una vista previa sin ida y vuelta por la red.

Los contenedores (Podman sin root) quedan solo para desarrollo.

### Vista previa en el navegador

typst.ts compila en un Web Worker. En una CPU modesta de cuatro núcleos, un cambio de un carácter tarda unos 50 ms de
Typst y 4 ms de renderizado del SVG, así que la vista previa sigue cada tecla; además reemplaza solo las páginas que
cambiaron, y un CV largo no traba la escritura. El compilador ocupa 28 MB de WebAssembly (7 MB con brotli): la
primera visita muestra un estado de carga y el service worker lo precachea.

### LaTeX: se exporta como código, y se compila solo para las plantillas importadas

Una distribución de TeX completa en WebAssembly descarga unos 120 MB, así que la exportación a LaTeX es código fuente
(un `cv.tex` autocontenido), no un PDF. Solo una plantilla LaTeX importada se compila en el navegador, con el pdfTeX o
el XeTeX de BusyTeX (TeX Live 2026) y un grupo chico de paquetes comunes: unos 21 MB (19 MB para XeTeX), que arma cada
deploy y que se bajan la primera vez que se usa una. Las fuentes que nombra una plantilla XeLaTeX, aparte de Latin
Modern, las sube el usuario.

### Canales de distribución gratuitos

- **Web**: un sitio estático en GitHub Pages, instalable como PWA desde Chrome, Edge o Safari. Aparece en el menú de
  aplicaciones del sistema, funciona sin conexión, se actualiza sola y no necesita firma.
- **Windows**: la Microsoft Store. El registro individual es gratis y la Store firma los paquetes MSIX, así que la PWA
  empaquetada con PWABuilder evita las advertencias de SmartScreen sin costo.
- **Linux**: Flathub. No acepta apps que solo envuelven una página web, así que la app de Linux es un shell de Tauri
  con integración real con el escritorio: proyectos que se abren y se guardan a través del portal de selección de
  archivos, su propio tipo de archivo, recursos empaquetados y una compilación desde el código fuente. También AUR y
  paquetes comunes en GitHub Releases.
- **macOS**: no hay notarización gratuita, y el repositorio principal de casks de Homebrew rechaza las apps que no
  pasan Gatekeeper, así que ahí la vía principal es la PWA. El `.dmg` de escritorio va a GitHub Releases sin firmar,
  con instrucciones para abrirlo.
- **Instaladores firmados para Windows por fuera de la Store**: SignPath Foundation firma proyectos de código abierto
  gratis una vez que tienen cierta reputación.
- **Android**: la PWA se instala desde Chrome como una app de verdad (Chrome la empaqueta como WebAPK), con su ícono
  en el cajón de aplicaciones. Un paquete nativo puede salir del mismo shell de Tauri 2 que la app de escritorio, que
  también compila para Android, en GitHub Releases y en F-Droid si cumple sus reglas de compilación. Google Play cobra
  una tarifa de registro, así que queda afuera.
- **iPhone y iPad**: la App Store exige el Apple Developer Program, que es pago, así que la app de iOS es la PWA
  agregada a la pantalla de inicio desde Safari o Chrome. Una versión instalada con un Apple ID gratuito vence a los
  siete días, y así no hay forma de dársela a nadie.
- **CLI**: npm.

### Exportadores en TypeScript

La otra opción era conservar los exportadores en Python de cvgen y correrlos en el navegador con Pyodide. TypeScript
fue mejor en calidad y en velocidad: la biblioteca `docx` soporta de forma nativa el sombreado de tablas, las celdas
combinadas, las columnas de sección y las imágenes flotantes (con `python-docx` todo eso requiere OOXML crudo), y hay
un único esquema y un único conjunto de tipos que comparten los formularios, la validación, los exportadores y la CLI.
Pyodide además habría sumado segundos de arranque en la primera exportación y un puente entre dos runtimes.

Todos los exportadores parten de un mismo perfil resuelto (entradas buscadas, fechas formateadas, etiquetas
aplicadas), así que cada formato muestra exactamente lo mismo que el PDF. LaTeX y Word reproducen el estilo incluido
del perfil; un estilo propio es código Typst, así que para él salen como Legajo, y la exportación a Typst es la que lo
conserva. Word se comprueba abriendo los archivos en LibreOffice, en un contenedor, con Gelasio, que mide igual que
Georgia: no alcanza con que sean paquetes válidos, y los tests sostienen la disposición igual a la de Typst.

### Astro en vez de Next.js

El editor es completamente del lado del cliente, y las páginas públicas tienen que cargar rápido. Los puntos fuertes de
Next.js (renderizado en el servidor, server actions, optimización de imágenes) no sirven en una exportación estática, y
su configuración de WebAssembly en workers necesita ajustar el bundler. Astro genera páginas estáticas por defecto, está
construido sobre Vite (que maneja WebAssembly y module workers de forma nativa), no manda nada de JavaScript en la
página de inicio y tiene una acción oficial para GitHub Pages. El editor es una isla de React adentro, con Tailwind,
Zustand (el deshacer es propio, en el store) y dnd-kit. El service worker está escrito sin framework, porque el plugin
de PWA no soportaba la versión de Astro.

### Estilos propios

Todos los estilos incluidos son propios de Foja, así que todos están bajo su licencia: el aspecto de cvgen sale de la
plantilla Wenneker, que tiene licencia CC BY-NC-SA.

- **Legajo**, **Banda** y **Minimal** son los generales.
- **Claustro**, **Recto** y **Llano** son para los sistemas de selección de personal (ATS), que leen un CV antes que
  una persona. Son una sola columna de texto, sin íconos, con títulos estándar y el contacto en el cuerpo, y un test
  comprueba que el PDF lleva el texto en el orden en que se ve. Al elegir uno, el perfil queda con una columna, sin
  foto y con el largo corto.
- **Arco**, **Rótulo** y **Portada** son para un CV corto, un primer empleo o una pasantía: reparten lo que hay para
  que la hoja se vea llena, con las iniciales donde va la foto cuando no hay.

### Plantillas importadas, con reglas fijas

Una plantilla de CV escrita en Typst o en LaTeX se lee con reglas fijas, sin IA, y no se manda a ningún lado: su
contenido de ejemplo pasa a ser entradas del banco y un perfil, y su aspecto un estilo propio, después de un
formulario donde se revisa qué argumento de cada macro es cada campo. La línea de comandos hace lo mismo con
`foja import`, y toma la propuesta de las reglas tal como sale.

### JSON Resume

JSON Resume es el formato abierto de currículums que usan otras herramientas, así que Foja lo importa y exporta cada
perfil en él. Sus secciones son fijas: lo que no tiene lugar ahí se avisa al exportar en vez de perderse sin decirlo.

### Teléfonos

En el teléfono el editor muestra un panel por vez, con una barra abajo, al alcance del pulgar, para cambiar de panel y
exportar, y un menú que sube desde abajo. Las exportaciones van al menú de compartir del sistema, porque una descarga
desde una app web instalada en un iPhone muchas veces no hace nada. Los campos usan texto de 16 px en pantallas
táctiles para que Safari no haga zoom. Foja le pide al navegador que conserve el proyecto cuando se queda sin espacio,
y en un iPhone muestra cómo instalarla, porque Safari borra los datos de un sitio después de una semana sin usarse. Un
test recorre todos los paneles en una pantalla de 320 px y falla si algo se sale.

### Dos idiomas

El editor, la página de inicio, la línea de comandos y la documentación están en español y en inglés, y cada uno
elige según los idiomas del navegador o del sistema. Los tests fallan si a un texto o a un documento le falta su otro
idioma, así ninguno se queda atrás.

### La app de escritorio

Una ventana de Tauri 2 alrededor del mismo sitio, generado sin el service worker y con los archivos de LaTeX adentro,
así que funciona sin conexión desde el principio. Un webview no tiene descargas ni pestañas, así que las exportaciones
pasan por el diálogo de guardar del sistema y los links se abren en el navegador; todo lo demás es el editor web tal
cual. Un workflow que se corre a mano arma un `.deb`, un `.rpm` y un AppImage para Linux, un `.exe` de instalación
para Windows y un `.dmg` para los dos tipos de Mac en los runners de GitHub. Ninguno está firmado, para que el
proyecto siga sin costo; las notas de la release y la guía de uso dicen cómo abrirlos.

### Versiones dentro del proyecto

Las versiones viajan en el proyecto (`history`), no en un almacenamiento aparte: el JSON exportado las lleva y una
copia del proyecto es también una copia de su historia. Cada versión guarda el proyecto entero, no la diferencia con
la anterior, porque así se lee y se restaura sin reconstruir nada; el raleo deja unas 80 en un año de uso diario, y
las fotos se guardan una vez por contenido. Quedan fuera del deshacer, para que Ctrl+Z nunca borre una versión.

## Qué está hecho

- **El editor**: el banco de entradas y los perfiles, la vista previa en vivo con clic para editar y el indicador de
  una página, validación en línea, guardado automático en IndexedDB que conserva el proyecto anterior cuando se
  reemplaza y edita en una pestaña por vez, deshacer y rehacer, arrastrar y soltar con alternativa por teclado, una
  paleta de comandos y recorte de la foto.
- **Qué entra en cada perfil**: prioridades, largos, excepciones, un resumen corto y «Ajustar a una página».
- **Nueve estilos**, una biblioteca de Typst compartida, «Editar en Typst» y un editor de estilos; temas de interfaz,
  ampliables con un archivo JSON chico y validado o desde un script. Cada par de texto y fondo cumple el contraste
  WCAG AA en todos los temas.
- **Exportaciones** a PDF, JPG, Word, Typst, LaTeX, Markdown, JSON, JSON Resume y un `.zip` con todo, y «Abrir en
  Overleaf», que manda la de LaTeX a overleaf.com solo cuando se toca.
- **Plantillas importadas**, de Typst y de LaTeX, y archivos de JSON Resume.
- **La app web** en línea en [`bafif.github.io/foja/`](https://bafif.github.io/foja/), sin conexión e instalable, con
  su interfaz para el teléfono. El deploy se corre a mano.
- **La línea de comandos**, con `build`, `validate` e `import`, y un conversor desde los datos de cvgen. Está en npm
  como [`@bafif/foja`](https://www.npmjs.com/package/@bafif/foja): `npm install -g @bafif/foja` da el comando `foja`.
- **Los instaladores de escritorio**. Los paquetes de Linux están probados; los instaladores de Windows y macOS
  todavía no se probaron, y no se publicó ninguna versión.
- **Versiones** del proyecto, desactivadas por defecto: instantáneas al guardar que se ralean con el tiempo, versiones
  con nombre, vista previa, comparación campo por campo y restauración que se deshace con Ctrl+Z.
- **Español e inglés** en todo.

## Qué viene después

Primero lo que le falta al producto, en este orden. Las pruebas en dispositivos y cuentas reales pueden hacerse en
cualquier momento, y cada canal se publica cuando lo que lleva está probado.

### En el producto

1. **El mismo largo en todos los formatos.** Un CV que entra en una página en el PDF tiene que entrar también en
   LaTeX y en Word, y hoy puede pasarse (ver las limitaciones conocidas, más abajo). El arreglo vale para todos los
   estilos y formatos a la vez, sin ajustes por estilo: Typst decide dónde corta cada renglón y los demás formatos
   lo copian.
   - **La misma fuente.** El `.docx` lleva incrustadas XCharter y Noto Sans en vez de pedir Georgia. Word incrusta
     solo fuentes TrueType, así que XCharter, que viene en OpenType CFF, se convierte; su licencia permite modificarla
     y redistribuirla. Un programa que no lea fuentes incrustadas tiene que seguir mostrando una serif parecida.
   - **Los mismos renglones.** Antes de exportar, Typst compila el perfil con el estilo que reproduce el exportador
     (el del perfil, o Legajo o Minimal cuando el exportador lo reemplaza) y devuelve dónde termina cada renglón de
     cada párrafo. LaTeX y Word cortan ahí con un salto de línea forzado, con el mismo interlineado y los mismos
     espacios entre bloques, así cada párrafo ocupa los mismos renglones en los tres formatos sin depender de cómo
     parte las líneas cada programa. La plantilla LaTeX importada queda afuera: su PDF ya es el de LaTeX.
   - **Un test que lo sostenga.** Para cada perfil de los proyectos de ejemplo y cada estilo incluido, compila el
     LaTeX con TeX Live, abre el Word en LibreOffice y compara la cantidad de páginas con la del PDF de Typst. Corre en
     un contenedor propio, porque LibreOffice y TeX Live pesan, y un estilo nuevo queda cubierto sin escribir nada
     más.
2. **Archivos en la app de escritorio**: abrir y guardar proyectos como archivos, con su propio tipo de archivo, y que
   se actualice sola (salvo la de Flathub, que la actualiza Flatpak). Es la integración con el escritorio que pide
   Flathub para aceptarla.

### Pruebas en dispositivos y cuentas reales

Los tests automáticos corren en Linux, con un Chromium que emula el teléfono sin las mañas de Safari ni un menú de
compartir de verdad. Esto pide el aparato o la cuenta reales:

- **Teléfonos**: en un Android con Chrome y en un iPhone con Safari y con Chrome, instalarla siguiendo los pasos que
  muestra la app, editar, exportar a través del menú de compartir y usarla sin conexión.
- **Microsoft Word**: abrir las exportaciones a Word, que hasta ahora se comprobaron solo en LibreOffice.
- **Overleaf**: probar «Abrir en Overleaf» con una cuenta; los tests comprueban lo que se manda, pero interceptan el
  envío.
- **Windows y macOS**: instalar y abrir la app de escritorio con los instaladores, que se arman pero todavía no se
  probaron.

### Publicación

1. **Microsoft Store**: empaquetar la PWA publicada como MSIX con PWABuilder, desde una cuenta individual gratuita de
   Partner Center. El manifest ya tiene lo que PWABuilder pide y recomienda: id, íconos, captura, categorías y abrir
   la ventana que ya está abierta.
2. **La app de escritorio**: la primera versión en GitHub Releases, una vez probados los instaladores; después AUR, un
   Flatpak compilado desde el código fuente y la postulación a Flathub, y SignPath Foundation para Windows cuando el
   proyecto califique.
3. **Paquete para Android**: el mismo shell de Tauri 2 compilado para Android, como APK en GitHub Releases y, si
   califica, en F-Droid. En iPhone la app sigue siendo la PWA (ver los canales de distribución más arriba).

### Limitaciones conocidas

- La exportación a LaTeX corta las líneas un poco distinto que Typst y puede pasarse unas líneas de una página cuando
  el PDF entra; la de Word también, y más, porque Georgia es más ancha que XCharter (el perfil de programador del
  ejemplo se pasa unos veinte renglones en LibreOffice). Lo resuelve «El mismo largo en todos los formatos».
- Una plantilla LaTeX importada se ve en la vista previa sin el clic para editar ni las marcas de lo que se pasa de la
  página, y de las que necesitan LuaLaTeX se importan solo los datos.
- La línea de comandos no compila LaTeX: escribe el `.tex` lleno.

### A largo plazo

Un editor de Typst general, gráfico y en vivo, pensado alrededor de la libertad: juntás bloques (texto, listas,
entradas, imágenes, formas), los acomodás en la página y la plantilla los convierte en Typst. El CV es el primer
producto montado sobre esa idea. Los bloques con tipo del modelo de datos dejan la puerta abierta sin tener que
construirlo ahora; hasta entonces todo sigue enfocado en CV.

## Nombre y direcciones

El nombre viene de *foja de servicios*, el registro de la trayectoria de alguien.

- Código: [`bafif/foja`](https://github.com/bafif/foja), público, GPL-3.0 (una licencia OSI, como exige SignPath).
  cvgen y sus datos viven en `cvgen/`.
- Web: `bafif.github.io/foja/`. Más adelante un dominio propio puede servir el mismo sitio en su raíz sin ningún otro
  cambio.
- npm: `@bafif/foja` (npm no acepta `foja` a secas: se parece a otros paquetes); el comando es `foja`.
  ID de la app en Flathub: `io.github.bafif.Foja`.

## Dependencias

Todas libres y de código abierto, y todos los paquetes de Node se instalan solo dentro del contenedor de desarrollo:
Astro, React, Tailwind, Zustand, dnd-kit, typst.ts (compilador web, renderizador y el compilador de Node
para la CLI), `docx`, y Vitest y Playwright para los tests. No hay biblioteca de ZIP ni de JSON Schema: las dos cosas
son lo bastante chicas como para tenerlas en `packages/core`. Las fuentes incluidas son XCharter, Latin Modern Mono y
Noto Sans, cada una con su licencia al lado. Las plantillas LaTeX importadas usan los motores pdfTeX y XeTeX de
BusyTeX (texlyre-busytex) y archivos de TeX Live 2026, que arma el deploy y no están en el repositorio
([detalle y licencias](../apps/web/public/latex/README.es.md)). La app de escritorio suma Rust, Tauri 2 y sus plugins
de diálogo y de apertura, que se compilan solo en su contenedor y en los runners de la release; el Flatpak va a sumar
`flatpak-builder`.

## Fuentes

- Versiones de typst.ts: <https://github.com/Myriad-Dreamin/typst.ts/releases>
- Versiones de Typst: <https://github.com/typst/typst/releases>
- Plantillas de CV en Typst y RenderCV: <https://typst.app/universe/package/rendercv/>,
  <https://typst.app/universe/package/brilliant-cv/>
- Tauri con un sidecar de PyInstaller, problemas de firma:
  <https://github.com/phoson-lat/Phoson-Desktop/pull/11>,
  <https://github.com/ActivityWatch/activitywatch/issues/1249>
- LaTeX en el navegador: <https://github.com/TeXlyre/texlyre-busytex>
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
