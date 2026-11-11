# cvgen

*[English](README.md) · Español*

Foja empezó acá, como el generador que escribí para mi propio CV, y todavía armo mis CV con él.
Tengo mi CV como datos, en `data/`, y lo genero con dos generadores. Funcionan por separado,
leen los mismos archivos y producen el mismo diseño:

- **`python/`** (`cvgen`): arma LaTeX sobre la plantilla Wenneker y lo compila con
  [tectonic](https://tectonic-typesetting.github.io/). Compuesto en XCharter.
- **`c/`** (`cvgen-c`): escribe el PDF directamente en C17, sin más dependencias que la libc.
  Compuesto con las fuentes base de PDF (Helvetica), que son un poco más anchas, así que llena las páginas antes.

Cada CV es un *perfil*: un JSON chico que elige qué secciones y entradas mostrar, así que con
un solo conjunto de datos saco un CV para cada tipo de trabajo al que me postulo. Los datos son mi CV real, salvo
mi domicilio, teléfono y correo, que quedan fuera del repositorio (fijate en [`privado.json`](#privadojson)).

## Requisitos
- Generador en Python: [uv](https://docs.astral.sh/uv/) y tectonic (`pacman -S tectonic`).
  tectonic descarga los paquetes de LaTeX que necesita la primera vez que lo corrés.
- Generador en C: un compilador de C17 y `make`.

## Uso
Desde `cvgen/`:

```sh
make python PERFIL=docente-ia   # build/cv-docente-ia.pdf
make c PERFIL=docente-ia        # build/cv-docente-ia-c.pdf
make test                       # pytest + tests de C
make lint                       # ruff check + chequeo de formato
```

También podés llamar a los generadores directamente:

```sh
uv run cvgen --perfil docente-ia [--datos data] [--privado privado.json] [--salida out.pdf] [--tex]
c/build/cvgen-c -p docente-ia [-d data] [-P privado.json] [-o out.pdf]
```

`--tex` escribe el fuente LaTeX en vez de compilarlo. Los dos imprimen la ruta de salida si todo sale bien
y terminan con estado 1 y un mensaje en stderr cuando los datos no son válidos.

## Datos
```
data/
├── cv.json          datos personales, contactos, grupos de habilidades y todas las entradas, por id
├── privado.json     domicilio, teléfono y correo; git lo ignora, ver privado.ejemplo.json
├── img/foto.jpg     foto para la barra lateral
├── perfiles/*.json  un archivo por CV
└── textos/*.md      prosa: textos de perfil, listas de tareas, fortalezas
```

### `cv.json`
- `nombres`, `apellidos`, `foto` (ruta relativa a `data/`).
- `contactos`: los públicos, `github`, `linkedin` y `web`. El teléfono y el correo van en
  `privado.json`.
- `habilidades`: grupos de habilidades para la barra lateral, por ejemplo `{"Idiomas": ["Español (nativo)", …]}`.
- `entradas`: todas las entradas de experiencia, educación o proyectos, por id:

```json
"docencia": {
    "titulo": "Docente particular",
    "lugar": "Independiente",
    "desde": "2018-07",
    "hasta": null,
    "tareas": "textos/tareas_docencia.md",
    "nota": "línea opcional que se muestra debajo del título"
}
```

Las fechas son `YYYY-MM`. Una entrada que solo tiene `desde` es una fecha única; `"hasta": null` significa que sigue en curso.
`tareas` apunta a un archivo Markdown con el detalle; `nota` es una línea corta que se muestra incluso
en las secciones compactas.

### `privado.json`
Mi domicilio, teléfono y correo no están en el repositorio. Van en `data/privado.json`, que
git ignora; para armar uno, copiá `privado.ejemplo.json`, que tiene valores inventados:

- `contactos`: `telefono` y `correo`. Se suman a los de `cv.json`, y un perfil
  los muestra listándolos en sus `contactos`, como a cualquier otro.
- `domicilio`: `calle`, `ciudad`, `provincia`, `pais`. Solo los perfiles con `"domicilio": true`
  lo muestran; sin esa clave el CV no tiene domicilio.

El archivo es opcional, pero un perfil que muestre alguno de estos datos falla si no está. Los tests
usan siempre `privado.ejemplo.json`, nunca el archivo real.

### Perfiles
`data/perfiles/<perfil>.json` describe un CV:

```json
{
    "subtitulo": "Docente de Inteligencia Artificial",
    "perfil": "textos/perfil_docente_ia.md",
    "postulacion": "opcional; se muestra como un bloque «Curso» en la barra lateral",
    "domicilio": false,
    "contactos": ["telefono", "correo", "linkedin"],
    "habilidades": [["Web", "Programación"], "Idiomas"],
    "secciones": [
        {"titulo": "Experiencia docente", "entradas": ["docencia"]},
        {"titulo": "Fortalezas", "items": "textos/fortalezas_docente_ia.md"},
        {"titulo": "Educación", "entradas": ["tuia", "tecnico"], "compacto": true}
    ]
}
```

Cada fila de `habilidades` es el nombre de un grupo, o un par de nombres que se muestran uno al lado del otro: el de la derecha
tan ancho como su línea más larga, el de la izquierda en el resto de la barra lateral.

Una sección lista `entradas` (ids de `cv.json`), `items` (un archivo Markdown de párrafos con título,
o una lista de líneas simples), o ambas cosas. `"compacto": true` muestra cada entrada como título, lugar, fechas y `nota`, sin sus
`tareas`.
`"lateral": true` pasa la sección a la barra lateral, debajo de las habilidades, como títulos de entrada con
su lugar y fechas, párrafos con título justificados y líneas simples alineadas a la derecha. En cualquier ítem,
`**texto**` va en negrita. La barra lateral nunca se parte entre páginas: el generador en C
se detiene con un error si no entra, y LaTeX la desborda en la columna principal.

### Textos
`data/textos/*.md` tienen párrafos simples (textos de perfil) o líneas `# Título` seguidas cada una de un
párrafo (tareas y fortalezas).

## Largo de página
Un CV debería entrar en una página; recortá el perfil hasta que entre. Si no entra, ninguno de los generadores
falla: la barra lateral queda en la primera página y la columna principal sigue en las siguientes.

## Tests
`make test` corre las dos suites:

- `python/tests`: genera todos los perfiles, verifica la validación de los datos y compila un CV
  que desborda para comprobar que sigue en la columna principal (se saltea si no hay tectonic y `pdftotext`).
- `c/tests`: parseo de JSON y Markdown, fechas, métricas de fuentes y el PDF de cada perfil contra
  los datos reales (`docente-ia` y `programador`, cada uno en una página; `programador` con la experiencia dos veces
  desborda a una segunda).

## Licencia
GPL-3.0. Ver [LICENSE](../LICENSE).