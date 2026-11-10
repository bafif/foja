# Cómo escribir un estilo de CV

*[English](templates.md) · Español*

Un estilo de Foja es un solo archivo Typst. Importa la biblioteca de Foja y compone `cv`, el perfil que se está armando, ya resuelto:

```typst
#import "/lib.typ": *

#set document(..document-info)
#set page(width: paper.width, height: paper.height, margin: margins((top: 18, bottom: 18, left: 18, right: 18)))
#set text(font: opt("font", "Noto Sans"), size: base-size, lang: lang)

#text(size: 2em, weight: "bold", fill: accent(rgb("#1f5f5b")), cv.name)
#cv.subtitle
```

En el editor, **Estilo y diseño → Editar en Typst** copia el estilo del perfil en uno tuyo y abre su código. **Nuevo estilo desde cero** arranca de un esqueleto mínimo. Tus estilos se guardan en el archivo del proyecto (`templates`), así que viajan con él y con la exportación a Typst.

## Qué contiene `cv`

| Campo | |
| :--- | :--- |
| `cv.name`, `cv.given`, `cv.family` | el nombre completo, los nombres de pila, los apellidos |
| `cv.subtitle`, `cv.summary` | cadenas (`summary` puede ser `""`) |
| `cv.highlight` | `(title: …, text: …)` o `none` (por ejemplo, el curso al que se postula) |
| `cv.photo`, `cv.photo-shape` | una ruta para `image()` o `none`; `"square"`, `"rounded"` o `"circle"` |
| `cv.contacts` | arreglo de `(kind, label, value, link)`; `link` es `none` para el teléfono y la ubicación |
| `cv.skills` | filas de grupos `(title, items)`; los grupos de una misma fila están pensados para ir uno al lado del otro |
| `cv.sections` | arreglo de `(index, path, id, title, side, compact, blocks)` |

Cada bloque de una sección es o bien una entrada,
`(type: "entry", path, id, title, place, period, note, items)`, o bien
`(type: "item" | "paragraph", path, heading, text)`. `period` ya viene formateado
(`05/2026 – actualidad`). `items` son pares `(heading, text)`. `side` es verdadero para las secciones que el usuario puso en la barra lateral. Un estilo de una sola columna puede ignorarlo.

## Funciones auxiliares

| | |
| :--- | :--- |
| `inline(text)` | una cadena con los tramos `**bold**` en negrita |
| `item-body(item)` | un ítem con su encabezado en negrita |
| `photo(width, shape: …)` | la foto recortada con su forma, o `none` |
| `contact-text(contact)` | el valor, con enlace cuando lo tiene |
| `labels` | palabras fijas en el idioma del CV: `labels.profile`, `labels.contact`, `labels.skills`, `labels.present`, `labels.contacts.phone`, … |
| `month(value)`, `period(entry)` | fechas en el formato del perfil (ya aplicado en `cv`) |
| `document-info` | `(title, author)` para `#set document(..document-info)` |

## Opciones de diseño

Las opciones del perfil (el panel **Opciones**) le llegan al estilo a través de `opt(key, default)` y de algunos valores ya listos: `accent(default-colour)`, `base-size`, `density` (0.7, 1 o 1.3), `paper` (`(width, height)`), `margins(defaults-in-mm)` y `lang`. Un estilo lee las opciones que le interesan e ignora el resto. También están `opt("columns", 2)`, `opt("sidebar", "left")`, `opt("sidebarWidth", 30)`, `opt("photo", "square")`, `opt("font", …)` y `opt("dateFormat", …)`.

Fuentes disponibles: **XCharter** (serif), **Noto Sans** (sans) y **Latin Modern Mono 9**.

## Clic para editar y el indicador de ajuste a la página

Dos llamadas opcionales le permiten al editor entender la página:

- `anchored(path, body, column: "main")` marca `body` como la parte que está en `path`. Así, un clic sobre ella en la vista previa abre esa parte y la selección se remarca encima. Usá las rutas que da `cv` (`s.path`, `b.path`) y estas: `"name"`, `"subtitle"`, `"summary"`, `"photo"`, `"highlight"`, `"contacts"`, `"skills.0"` (una fila). El indicador de ajuste a la página también cuenta las líneas a partir de las marcas.
- `geometry(main: (x: …, width: …), side: (x: …, width: …))` le dice al editor dónde están las columnas (medidas desde el borde izquierdo de la página), para que los contornos tengan el ancho correcto. Sin esto, van desde la marca hasta el margen derecho.

Un estilo sin ninguna de las dos igual compila y se ve en la vista previa; solo pierde esas dos cosas.

## Los estilos incluidos

`packages/template/styles/legajo.typ`, `banda.typ` y `minimal.typ` son ejemplos completos, y `packages/template/lib.typ` es la biblioteca en sí.