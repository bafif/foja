// The landing page's text, in Spanish (at the site's root) and English (under en/). The editor has its own catalog
// (editor/i18n.ts).

export type PageLanguage = "es" | "en";

const es = {
  title: "Foja — tu CV en Typst, sin escribir código",
  description: "Editor de CV sobre Typst: formularios, vista previa en vivo y exportación a PDF, Word, LaTeX y más. Todo en tu navegador.",
  languages: "Idioma",
  heading: "Tu CV en Typst, sin escribir código",
  intro:
    'Completás formularios y ves al lado el resultado real de <a class="underline" href="https://typst.app">Typst</a>, al instante. Un mismo banco de experiencias alimenta varios perfiles: el CV para un puesto de programación y el de docencia salen de los mismos datos.',
  open: "Abrir el editor",
  source: "Código fuente",
  note: "Gratis, sin cuentas, y funciona sin conexión una vez abierto. En el celular se instala como una app: desde Chrome en Android y desde Safari o Chrome en iPhone (Compartir → «Agregar a inicio»).",
  screenshot: "El editor de Foja: a la izquierda, los formularios de una entrada; a la derecha, la vista previa del CV.",
  features: [
    [
      "Tus datos no salen de tu dispositivo",
      "Foja corre entero en el navegador: el compilador de Typst incluido. No hay servidor que guarde tu CV; queda en este navegador y en los archivos que exportes.",
    ],
    [
      "Una página, sin adivinar",
      "Un indicador te dice si el CV entra en una página y, si no, cuántas líneas sobran y qué partes quedan afuera. Hacés clic en la vista previa y vas directo a editar esa parte.",
    ],
    [
      "Estilos propios, en Typst",
      "Tres estilos de Foja (Legajo, Banda y Minimal) con sus opciones: columnas, foto, color, letra, márgenes, papel. Y si querés otro, «Editar en Typst» te da el código del estilo para hacerlo tuyo.",
    ],
  ],
  exportHeading: "Exportá a lo que te pidan",
  formats: [
    ["PDF", "el CV listo para mandar"],
    ["JPG", "una imagen por página, para formularios que piden imagen"],
    ["Word", "en una o dos columnas, editable"],
    ["Typst", "el código fuente, que abre en typst.app"],
    ["LaTeX", "para Overleaf o tu instalación de TeX"],
    ["Markdown", "para un README o un perfil de GitHub"],
    ["JSON", "tu proyecto, para guardarlo o pasarlo a otro dispositivo"],
  ],
  footer:
    'Foja es software libre (GPL-3.0): <a class="underline" href="https://github.com/bafif/foja">github.com/bafif/foja</a>. Fuentes: XCharter (licencia libre de Bitstream Charter) y Latin Modern Mono (GUST Font License).',
};

const en: typeof es = {
  title: "Foja — your CV in Typst, without writing code",
  description: "A CV editor on Typst: forms, a live preview and exports to PDF, Word, LaTeX and more. All in your browser.",
  languages: "Language",
  heading: "Your CV in Typst, without writing code",
  intro:
    'You fill in forms and see the real <a class="underline" href="https://typst.app">Typst</a> output next to them, as you type. One bank of experience feeds several profiles: the CV for a programming job and the one for teaching come from the same data.',
  open: "Open the editor",
  source: "Source code",
  note: "Free, no accounts, and it works offline once it has been opened. On a phone it installs as an app: from Chrome on Android, and from Safari or Chrome on iPhone (Share → “Add to Home Screen”).",
  screenshot: "Foja's editor: on the left, the forms of an entry; on the right, the preview of the CV.",
  features: [
    [
      "Your data stays on your device",
      "Foja runs entirely in the browser, the Typst compiler included. No server keeps your CV; it stays in this browser and in the files you export.",
    ],
    [
      "One page, no guessing",
      "A badge tells you whether the CV fits on one page and, if not, how many lines spill over and which parts are left out. Click the preview and you go straight to editing that part.",
    ],
    [
      "Styles of your own, in Typst",
      "Three Foja styles (Legajo, Banda and Minimal) with their options: columns, photo, colour, typeface, margins, paper. And if you want another, “Edit in Typst” gives you the style's code to make it yours.",
    ],
  ],
  exportHeading: "Export to whatever they ask for",
  formats: [
    ["PDF", "the CV, ready to send"],
    ["JPG", "one image per page, for forms that want an image"],
    ["Word", "in one or two columns, editable"],
    ["Typst", "the source code, which opens in typst.app"],
    ["LaTeX", "for Overleaf or your own TeX installation"],
    ["Markdown", "for a README or a GitHub profile"],
    ["JSON", "your project, to keep it or move it to another device"],
  ],
  footer:
    'Foja is free software (GPL-3.0): <a class="underline" href="https://github.com/bafif/foja">github.com/bafif/foja</a>. Fonts: XCharter (under Bitstream Charter\'s free licence) and Latin Modern Mono (GUST Font License).',
};

export const landing: Record<PageLanguage, typeof es> = { es, en };
