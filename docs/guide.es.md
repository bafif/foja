# Guía de uso de Foja

*[English](guide.md) · Español*

Foja es un editor de CV hecho sobre [Typst](https://typst.app). Vos completás formularios; la vista previa que tenés al lado es la salida real de Typst y se actualiza mientras escribís. Todo corre en tu navegador: tus datos no salen de tu dispositivo. Está en <https://bafif.github.io/foja/>.

## Para empezar

Abrí el editor y elegí una de estas opciones:

- **Empezar con el ejemplo**: mi propio CV, con dos perfiles (programador y docente de IA) armados con los mismos datos, para ver cómo está armado uno real. Se pasa de uno a otro en **Perfil**, arriba.
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

**Estilo y diseño** muestra los tres estilos de Foja, cada uno con una miniatura de tu CV:

- **Legajo** (el predeterminado): serif, el nombre en versalitas sobre una línea, una tarjeta en la barra lateral, las fechas en una columna propia.
- **Banda**: una franja de color con el nombre y la foto; una sola columna, sans-serif.
- **Minimal**: negro sobre blanco y mucho aire; el color, solo en el nombre.

Debajo, las opciones que respeta el estilo elegido: una o dos columnas, lado y ancho de la barra lateral, forma de la foto, tipografía, tamaño, color, márgenes, espaciado, papel, formato de fecha y el idioma de las etiquetas fijas (español, inglés, portugués).

**Editar en Typst** copia el estilo del perfil en un estilo propio y abre su código; **Nuevo estilo desde cero** arranca de un esqueleto mínimo. Los errores aparecen arriba de la vista previa, que conserva la última versión que compiló bien. Cómo escribir un estilo: [`templates.es.md`](templates.es.md).

## Una página

La insignia arriba de la vista previa te dice si el CV entra en una página y, si no, por cuántas líneas se pasa; las partes que sobran se tiñen de rojo, y las secciones a las que pertenecen llevan un ⚠ en la navegación. Hacé clic en cualquier parte de la vista previa para editarla.

## Exportar

**Exportar** (Ctrl+E) ofrece:

| Formato | Notas |
| :--- | :--- |
| PDF | El CV tal como lo ves. |
| JPG | Una imagen por página, a 72, 150 o 300 dpi. |
| Word (`.docx`) | Con el aspecto del estilo del perfil (Legajo, Banda o Minimal), rehecho en Word, que no puede correr Typst. Un estilo propio sale como Legajo. |
| Typst (`.zip`) | El estilo, el proyecto y las fuentes: compila con `typst compile` y se abre en typst.app. Es la única exportación que conserva tal cual un estilo propio. |
| LaTeX (`.zip`) | Con el aspecto del estilo del perfil (Legajo, Banda o Minimal); un estilo propio sale como Legajo. LaTeX corta las líneas un poco distinto, así que un CV que entra justo en el PDF puede pasarse por unas líneas. |
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