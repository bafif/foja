# Cómo hacer un tema de interfaz

*[English](themes.md) · Español*

Los temas cambian cómo se ve el editor, nunca el CV. Foja trae tres (**Papel y tinta**,
**Neutro**, **Vivo**); un tema propio es un archivo JSON chico:

```json
{
  "id": "bosque",
  "name": "Bosque",
  "radius": "8px",
  "fonts": { "ui": "system-ui, sans-serif", "heading": "serif" },
  "light": {
    "bg": "#f1f7f3", "surface": "#ffffff", "surface2": "#e3efe7", "ink": "#16241c",
    "muted": "#5b6e62", "line": "#cfe0d5", "accent": "#2d6a4f", "accentSoft": "#d8eee2",
    "accentInk": "#1b4332", "onAccent": "#ffffff", "danger": "#b42318", "desk": "#dde9e1"
  },
  "dark": {
    "bg": "#101814", "surface": "#17221c", "surface2": "#1f2d25", "ink": "#e3efe7",
    "muted": "#9db3a6", "line": "#2c3d33", "accent": "#74c69d", "accentSoft": "#1f3a2c",
    "accentInk": "#c7ecd6", "onAccent": "#0b1a12", "danger": "#f08c84", "desk": "#0a100d"
  }
}
```

En el editor, **Apariencia ▾ → Importar un tema (.json)…** lo agrega; **Descargar este tema como base**
te da el actual para que partas de ahí. Los temas se guardan en este navegador.

## Los colores

| Clave | Para qué se usa |
| :--- | :--- |
| `bg` | el fondo detrás de todo |
| `surface`, `surface2` | paneles, campos; menús y el resaltado al pasar el mouse |
| `ink`, `muted` | texto; texto secundario |
| `line` | bordes |
| `accent`, `onAccent` | botones y enlaces; texto sobre un fondo de acento |
| `accentSoft`, `accentInk` | elementos seleccionados; el texto sobre ellos |
| `danger` | acciones destructivas y errores |
| `desk` | detrás de la hoja de la vista previa |

Todas las claves son opcionales: las que faltan se toman de Papel y tinta. Sin `dark`, el tema
queda claro cuando el sistema o el usuario piden el modo oscuro.

Los valores tienen que ser colores (`#hex`, `rgb()`, `hsl()`, `oklch()`, un nombre de color).
`radius` es una longitud (`px`, `rem`, `em`); `fonts.ui` y `fonts.heading` son listas de nombres
de fuentes instaladas (`"serif"` para los títulos elige XCharter). No se acepta nada más (ni
`url()` ni otro CSS), así que un tema no puede cargar nada ni ir más allá de los colores del editor.

## Desde un script

Los plugins pueden hacer lo mismo en tiempo de ejecución:

```js
window.foja.themes.register({ id: "noche", name: "Noche", light: { accent: "#7048e8" }, dark: { accent: "#b197fc" } });
window.foja.themes.use("noche");
window.foja.themes.list(); // [{ id, name }, …]
```

`register` lanza un error con el motivo cuando el tema no es válido.