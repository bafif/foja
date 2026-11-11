# Guía de uso de Foja

*[English](guide.md) · Español*

Foja es un editor de CV hecho sobre [Typst](https://typst.app). Vos completás formularios; la vista previa que tenés al lado es la salida real de Typst y se actualiza mientras escribís. Todo corre en tu navegador: tus datos no salen de tu dispositivo. Está en <https://bafif.github.io/foja/>.

## Para empezar

Abrí el editor y elegí una de estas opciones:

- **Empezar con el ejemplo**: mi propio CV, con tres perfiles (programador, docente de matemática, física y electrónica, y técnico electrónico) armados con los mismos datos, para ver cómo está armado uno real. Se pasa de uno a otro en **Perfil**, arriba.
- **Proyecto vacío**: un CV en blanco.
- **Importar JSON**: un archivo `.foja.json` exportado desde Foja (tuyo, o una plantilla que alguien compartió).

Tu trabajo se guarda en el navegador a medida que avanzás («Guardado» en el encabezado). **Ctrl+S** guarda en el momento. Reemplazar el proyecto (nuevo, ejemplo, importar) no pierde el anterior: **Proyecto ▾ → Recuperar el proyecto anterior** lo trae de vuelta. Cada tanto exportá el proyecto como JSON para tener una copia fuera del navegador.

## Perfiles y el banco de entradas

Un proyecto tiene **un banco de entradas** (trabajos, títulos, proyectos) y **varios perfiles** que eligen de ahí: un CV para un trabajo de programación y otro para un puesto docente pueden compartir las mismas entradas, cada uno con su propio subtítulo, resumen, secciones y diseño. Si editás una entrada, cambia en todos los perfiles que la usan; el formulario de la entrada te dice cuáles son.

- **Perfil ▾**, en el encabezado, cambia de perfil; **+ Nuevo perfil** y **Duplicar** crean más.
- **Datos**: datos personales y foto, contactos, grupos de habilidades y el banco de entradas.
- **Perfil**: el texto del perfil (subtítulo, resumen, qué contactos y habilidades muestra) y su **estilo y diseño**.
- **Secciones**: cada sección tiene bloques: una entrada del banco, un ítem (una viñeta con un encabezado opcional) o un párrafo. Arrastrá secciones y bloques para reordenarlos (o usá el asa con el teclado: Espacio, flechas, Espacio). Una sección puede ir en la barra lateral y puede ser *compacta* (entradas sin sus ítems, en letra chica).

Las fechas se cargan con selectores de mes; una entrada puede estar *en curso* o tener una *fecha única*. El texto admite `**negrita**`.

## Estilos

**Estilo y diseño** muestra los seis estilos de Foja, cada uno con una miniatura de tu CV:

- **Legajo** (el predeterminado): serif, el nombre en versalitas sobre una línea, una tarjeta en la barra lateral, las fechas en una columna propia.
- **Banda**: una franja de color con el nombre y la foto; una sola columna, sans-serif.
- **Minimal**: negro sobre blanco y mucho aire; el color, solo en el nombre.

Otros tres están hechos para los sistemas de selección (ATS) y los buscadores que leen CV para quienes reclutan, al estilo de los CV que recomienda la oficina de carreras de Harvard:

- **Claustro**: el clásico. Serif, el nombre centrado con el contacto en una línea debajo, títulos de sección en mayúsculas sobre una raya, la institución arriba del cargo y las fechas.
- **Recto**: moderno y simple, sans-serif y alineado a la izquierda; títulos en mayúsculas del color de acento sobre una línea fina, el cargo y las fechas en un renglón, la institución debajo.
- **Llano**: el más sobrio y compacto; títulos en negrita del color de acento, cada entrada en un renglón con el cargo y la institución.

Los tres son una sola columna de texto, sin íconos ni texto en imágenes, con el contacto en el cuerpo (nunca en el encabezado ni en el pie de Word), títulos estándar (el resumen bajo «Perfil», las habilidades bajo «Habilidades») y el texto del PDF en el orden en que se ve, cosa que comprueba un test. Al elegir uno, el perfil queda con una columna, sin foto y con el largo Corto (ver abajo), salvo que Corto deje el perfil sin entradas; todo se escribe en el perfil, así que se ve y se cambia como cualquier otra opción.

Debajo de los estilos, las opciones que respeta el estilo elegido: una o dos columnas, lado y ancho de la barra lateral, forma de la foto, tipografía, tamaño, color, márgenes, espaciado, papel, formato de fecha y el idioma de las etiquetas fijas (español, inglés, portugués).

**Editar en Typst** copia el estilo del perfil en un estilo propio y abre su código; **Nuevo estilo desde cero** arranca de un esqueleto mínimo. Los errores aparecen arriba de la vista previa, que conserva la última versión que compiló bien. Cómo escribir un estilo: [`templates.es.md`](templates.es.md).

## Importar una plantilla de Typst o de LaTeX

**Estilo y diseño → Importar una plantilla Typst o LaTeX** toma una plantilla de CV escrita en Typst o en LaTeX: un `.typ` o un `.tex`, o un `.zip` o `.tar.gz` con sus archivos. Foja la lee con reglas fijas, sin IA: las funciones que define, las que su contenido de ejemplo llama una y otra vez (cada llamada es una entrada), sus títulos (las secciones), las viñetas debajo de cada llamada (los ítems) y su `#show: x.with(...)` (el encabezado). Después propone qué argumento de cada macro es el cargo, el lugar, las fechas, una nota o los ítems, por el nombre del argumento (`title`, `company`, `dates`, `institución`…) y por cómo es su valor (una fecha, un correo, una URL).

El formulario muestra cada argumento con su valor de ejemplo y el campo al que va, que podés cambiar; debajo, lo que va a entrar. La misma correspondencia se usa dos veces:

- **los datos**: el contenido de ejemplo pasa a ser entradas del banco y un perfil nuevo, en el proyecto abierto o en uno nuevo;
- **el aspecto**: un estilo propio que guarda los archivos de la plantilla y llama a sus macros con los datos del CV; el perfil nuevo lo usa.

Los paquetes `@preview` no se bajan: si la plantilla usa alguno, subí un `.zip` que traiga su carpeta (con su `typst.toml`), o importá solo los datos. La licencia de la plantilla queda junto al estilo. La línea de comandos hace lo mismo con `foja import`.

Una plantilla LaTeX se lee igual: las macros que define (`\newcommand`, `\def`), las que su contenido de ejemplo llama una y otra vez, sus `\section`, los `\item` debajo de cada llamada y la llamada antes de la primera sección (el encabezado). Su aspecto es la plantilla misma: Foja escribe su `.tex` con el CV en lugar del contenido de ejemplo, a través de las macros de la plantilla, y lo compila con LaTeX en el navegador: pdfLaTeX, o XeLaTeX para una plantilla que elige sus fuentes por nombre (`fontspec`, `polyglossia` o `% !TEX program = xelatex`). La primera vez eso baja unos 9 MB (6 MB para XeLaTeX) y tarda unos segundos; después un cambio se ve en uno o dos segundos, igual más lento que con Typst. Hay un grupo de paquetes comunes (entre ellos los íconos de FontAwesome 5); LuaLaTeX no está, así que de algunas plantillas se importan los datos pero no el aspecto. Para XeLaTeX, Foja trae Latin Modern: una fuente que la plantilla pide por nombre y Foja no tiene aparece en **Estilo y diseño → Fuentes de la plantilla**, donde subís sus archivos `.otf` o `.ttf` (bajados de donde se publica la fuente); quedan guardados con el estilo. Las fuentes que vienen en el `.zip` de la plantilla se usan tal cual. La vista previa muestra las páginas de LaTeX sin el clic para editar ni las marcas rojas de lo que se pasa; el PDF que se exporta es el de LaTeX, y la exportación a LaTeX es el `.tex` de la plantilla, lleno, con sus archivos. La línea de comandos no tiene LaTeX: escribe ese `.tex` (`--format tex`) y no da PDF.

## Qué entra en cada perfil

Cada entrada, ítem y habilidad del banco tiene una prioridad, que se marca una sola vez donde se escribe: **Imprescindible**, **Normal** (la de siempre) o **Extra**. Después, cada perfil tiene un **largo**, en **Qué entra en este perfil**, debajo del texto del perfil:

- **Corto** muestra solo lo imprescindible;
- **Normal** muestra lo imprescindible y lo normal;
- **Completo** muestra todo.

Debajo del largo, las **casillas** listan las entradas del perfil con sus ítems, y sus habilidades: tildado, lo que entra. Lo que manda el largo va sin marca; una casilla que cambiás es una excepción de este perfil, marcada como tal, y si la volvés a cambiar vuelve a la regla. El perfil puede tener además un **resumen corto**, que se usa con el largo Corto (o siempre, o nunca, según **Resumen que usa**).

Cada perfil guarda su largo, sus excepciones y su resumen corto, y **Duplicar** los copia. LaTeX, Word, Markdown y JSON eligen exactamente lo mismo que muestra el PDF. El ejemplo trae tres perfiles, cada uno con su estilo y su largo: programador (Legajo, Normal), docente de matemática, física y electrónica (Claustro, Corto) y técnico electrónico (Banda, Completo).

**Ajustar a una página** compila el perfil y, mientras ocupe más de una página, lo achica de a un paso y en un orden fijo: el largo un paso más abajo, después el resumen corto, después lo extra que las excepciones todavía muestran, empezando por lo último. Nunca baja a Corto si eso deja el perfil sin entradas (primero marcá en el banco qué es imprescindible). El resultado queda escrito en el perfil, y **Deshacer el ajuste** (o Ctrl+Z) lo vuelve atrás de una vez.

## Una página

La insignia arriba de la vista previa te dice si el CV entra en una página y, si no, por cuántas líneas se pasa; las partes que sobran se tiñen de rojo, y las secciones a las que pertenecen llevan un ⚠ en la navegación. Hacé clic en cualquier parte de la vista previa para editarla.

## Exportar

**Exportar** (Ctrl+E) ofrece:

| Formato | Notas |
| :--- | :--- |
| PDF | El CV tal como lo ves. |
| JPG | Una imagen por página, a 72, 150 o 300 dpi. |
| Word (`.docx`) | Con el aspecto del estilo incluido del perfil, rehecho en Word, que no puede correr Typst. Un estilo propio sale como Legajo. Claustro, Recto y Llano van solo con párrafos, sin tablas, y las fechas en una tabulación en el margen derecho. |
| Typst (`.zip`) | El estilo, el proyecto y las fuentes: compila con `typst compile` y se abre en typst.app. Es la única exportación que conserva tal cual un estilo propio. |
| LaTeX (`.zip`) | Con el aspecto del estilo incluido del perfil; un estilo propio sale como Legajo. LaTeX corta las líneas un poco distinto, así que un CV que entra justo en el PDF puede pasarse por unas líneas. |
| Markdown | Un CV en texto plano para un README o un formulario que acepta texto. |
| JSON | El archivo del proyecto, para volver a importarlo o pasarlo a otro dispositivo. |
| Todos los formatos | Todos juntos en un `.zip`. |

Nombres en alfabetos no latinos: las fuentes incluidas cubren solo alfabetos latinos, así que por ahora los demás alfabetos se ven como glifos faltantes.

## En el celular o la tablet

Foja también funciona en el navegador del celular, de a un panel por vez: **Secciones**, **Editar** y **Vista previa**, que se cambian desde la barra de abajo.

- **Instalala como app.** En Android, en Chrome: **⋯ → Instalar como app** en el menú de Foja (o en el menú de Chrome → *Agregar a la pantalla principal*). En iPhone y iPad, en Safari o Chrome: **Compartir → Agregar a inicio** (en Chrome, Compartir está en la barra de direcciones). Se abre en pantalla completa, sin las barras del navegador, y funciona sin conexión.
- **En el iPhone, instalala si tu CV vive ahí.** iOS borra lo que un sitio guardó cuando pasa una semana sin abrirse, salvo que esté en la pantalla de inicio. La app de la pantalla de inicio tiene su propio almacenamiento, separado del del navegador: para llevarte un proyecto que empezaste en el navegador, exportalo como JSON e importalo en la app. Exportar el JSON cada tanto te deja una copia en cualquier caso.
- **Las exportaciones van a la hoja de compartir:** **Exportar → Preparar el archivo → Compartir o guardar…** ofrece Guardar en Archivos y apps de correo y mensajería. Lo que el sistema no puede compartir (en Android, los archivos de Word y los `.zip`) se descarga como siempre.

## Privacidad y almacenamiento

- No se manda nada a ningún lado: el proyecto vive en este navegador (IndexedDB) y en los archivos que exportás. No hay cuentas.
- El editor funciona sin conexión una vez que lo abriste.
- Foja edita en una pestaña por vez, así dos pestañas nunca se pisan; una segunda pestaña te ofrece tomar el control.

## Teclado

| Teclas | |
| :--- | :--- |
| Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y | deshacer, rehacer |
| Ctrl+S | guardar ahora |
| Ctrl+E | exportar |
| Ctrl+K | paleta de comandos: ir a cualquier panel, sección, entrada o perfil, o ejecutar una acción |
| Escape | cierra menús y diálogos |

En el editor de código del estilo, Tab indenta; Escape y después Tab te saca de ahí.

## Apariencia e idioma

**Apariencia ▾** cambia el tema de la interfaz (Papel y tinta, Neutro, Vivo, o uno que importes) y el modo claro u oscuro. Cómo hacer un tema: [`themes.es.md`](themes.es.md).

La interfaz está en español y en inglés. Arranca en español si tu navegador tiene el español entre sus idiomas, y en inglés si no; el selector de idioma del encabezado (también en la pantalla de bienvenida; en el celular, en **⋯**) la cambia, y Foja se acuerda de lo que elegiste.

## Línea de comandos

`npx foja build my.foja.json` genera todos los perfiles en PDF; `--format` suma svg, typ, tex, md, json, docx o all. Mirá [`packages/cli/README.es.md`](../packages/cli/README.es.md).