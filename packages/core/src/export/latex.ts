// LaTeX export: one self-contained `cv.tex` (memoir) with its photo, in a `.zip`, in the look of the
// profile's built-in style: Legajo (two columns with flowfram, or one), Banda, Minimal, Claustro,
// Recto or Llano. A style of the user's own is Typst code that cannot be turned into LaTeX, so it
// comes out as Legajo. It follows the layout options; the measurements are in big points (`bp`,
// the Typst point).

import { HYPHEN_LINE, LINE, Lines, type MeasuredWord } from "../lines.ts";
import { BLOCK, Flow, legajoLook, legajoTop, PAR, type LegajoLook } from "./flow.ts";
import type { ResolvedBlock, ResolvedCv, ResolvedEntry, ResolvedSection } from "../resolve.ts";
import { DEFAULT_ACCENT } from "../project.ts";
import type { Item, Project } from "../types.ts";
import type { ZipInput } from "../zip.ts";
import { isAtsStyle, resolveStyled, STYLE_NAMES, styleName, type AtsStyle, type ExportStyle } from "./style.ts";
import { latexStyleOf, latexTemplateBundle } from "./latex-template.ts";

type LatexStyle = ExportStyle;
const INK: Record<LatexStyle, string> = { legajo: "1F2A2E", banda: "1D2327", minimal: "141414", claustro: "1A1A1A", recto: "1B1F23", llano: "202020" };
const MARKER: Record<LatexStyle, string> = {
  legajo: "\\textcolor{accent}{--}",
  banda: "\\textcolor{accent}{\\textbullet}",
  minimal: "\\textcolor{muted}{--}",
  claustro: "\\textbullet",
  recto: "\\textcolor{accent}{\\textbullet}",
  llano: "\\textcolor{muted}{--}",
};

const SPECIAL: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "&": "\\&",
  "%": "\\%",
  $: "\\$",
  "#": "\\#",
  _: "\\_",
  "{": "\\{",
  "}": "\\}",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
};

export function escapeLatex(text: string): string {
  return [...text].map((c) => SPECIAL[c] ?? c).join("");
}

/** Escaped text where `**...**` is bold. */
export function inlineLatex(text: string): string {
  return escapeLatex(text).replace(/\*\*(.+?)\*\*/g, "\\textbf{$1}");
}

// Where Typst breaks the lines of the CV being written: set by renderLatex for the length of its run.
let lines: Lines | undefined;

/** `text` (`**` for bold, unless `markup` is false) in the lines Typst gave it when it has them: a forced break where
 * each line starts, which keeps the line before justified, and no other place to break (ties between the words). */
function laid(text: string, markup = true): string {
  const tex = markup ? inlineLatex : escapeLatex;
  const l = lines?.lay(text);
  if (!l) return tex(text);
  return tex(l.text)
    .replace(/ +/g, "~")
    .replaceAll(HYPHEN_LINE, "-\\linebreak{}")
    .replaceAll(LINE, "\\linebreak{}");
}

const BABEL: Record<string, string> = {
  es: "spanish,es-noshorthands",
  en: "english",
  pt: "portuguese",
  fr: "french",
  de: "ngerman",
  it: "italian",
};

const MM = 72 / 25.4; // bp per millimetre
const PAPER = { a4: { width: 210, height: 297, option: "a4paper" }, "us-letter": { width: 215.9, height: 279.4, option: "letterpaper" } };
const bp = (value: number) => `${+value.toFixed(3)}bp`;
/** A size of `size` bp whose lines are `baseline` bp apart. */
const sized = (size: number, baseline: number) => `\\fontsize{${bp(size)}}{${bp(baseline)}}\\selectfont `;

/** The photo's file name inside the bundle; SVG is left out (pdflatex cannot include it). */
function photoFile(cv: ResolvedCv): string | undefined {
  if (!cv.photo || cv.photo.type === "image/svg+xml") return undefined;
  return cv.photo.type === "image/png" ? "photo.png" : "photo.jpg";
}

/** Sizes in bp: TikZ does not parse `\dimexpr`, so every length is a number here. */
function photoCommand(cv: ResolvedCv, file: string, widthBp: number, shape = cv.layout.photo): string {
  const width = bp(widthBp);
  if (shape === "square") return `\\includegraphics[width=${width}]{${file}}`;
  const size = cv.photo!.size ?? { width: 1, height: 1 };
  if (shape === "circle") {
    // Fill a square of side `width` (the larger side is cut) and clip it round.
    const fit = size.width >= size.height ? `height=${width}` : `width=${width}`;
    return [
      "\\begin{tikzpicture}",
      `\\clip (0,0) circle (${bp(widthBp / 2)});`,
      `\\node[inner sep=0pt] at (0,0) {\\includegraphics[${fit}]{${file}}};`,
      "\\end{tikzpicture}",
    ].join("");
  }
  return [
    "\\begin{tikzpicture}",
    `\\clip[rounded corners=${bp(widthBp * 0.06)}] (0,0) rectangle (${width},${bp((widthBp * size.height) / size.width)});`,
    `\\node[inner sep=0pt,anchor=south west] at (0,0) {\\includegraphics[width=${width}]{${file}}};`,
    "\\end{tikzpicture}",
  ].join("");
}

/** Text width and column widths in bp, as in the Legajo style. */
function geometry(cv: ResolvedCv) {
  const l = cv.layout;
  const paper = PAPER[l.paper];
  const textWidth = (paper.width - l.margins.left - l.margins.right) * MM;
  const textHeight = (paper.height - l.margins.top - l.margins.bottom) * MM;
  const gutter = 6 * MM;
  const side = l.columns === 2 ? (textWidth * l.sidebarWidth) / 100 : 0;
  return { paper, textWidth, textHeight, gutter, side, main: l.columns === 2 ? textWidth - side - gutter : textWidth };
}

function preamble(cv: ResolvedCv, style: LatexStyle): string[] {
  const l = cv.layout;
  const { paper, textHeight, gutter, side, main } = geometry(cv);
  const size = [9, 10, 11, 12].reduce((a, b) => (Math.abs(b - l.fontSize) < Math.abs(a - l.fontSize) ? b : a));
  const density = { compact: 0.7, normal: 1, relaxed: 1.3 }[l.density];
  const m = l.margins;
  const accent = (l.accent ?? DEFAULT_ACCENT).slice(1).toUpperCase();
  const font = l.font === "Noto Sans" ? "\\usepackage[sfdefault]{noto}" : "\\usepackage{XCharter}";
  const lines = [
    `\\documentclass[${paper.option},${size}pt]{memoir}`,
    `% Made with Foja (https://github.com/bafif/foja), ${STYLE_NAMES[style]} style. Compile with pdflatex, lualatex or tectonic.`,
    "\\usepackage[T1]{fontenc}",
    font,
    `\\usepackage[${BABEL[cv.language.split("-")[0]] ?? "english"}]{babel}`,
    `\\usepackage[paperwidth=${paper.width}mm,paperheight=${paper.height}mm,top=${m.top}mm,bottom=${m.bottom}mm,left=${m.left}mm,right=${m.right}mm]{geometry}`,
    "\\usepackage{graphicx}",
    // flowfram 2 defines \\cleartoevenpage anew, which memoir has: LaTeX would stop there.
    style === "legajo" ? "\\let\\cleartoevenpage\\undefined\\usepackage{flowfram}" : style === "banda" ? "\\usepackage{eso-pic}" : "",
    "\\usepackage{xcolor}",
    "\\usepackage{tikz}",
    "\\usepackage{enumitem}",
    "\\usepackage[hidelinks]{hyperref}",
    `\\definecolor{accent}{HTML}{${accent}}`,
    `\\definecolor{ink}{HTML}{${INK[style]}}`,
    "\\colorlet{muted}{ink!62}",
    "\\colorlet{tint}{accent!8}",
    "\\pagestyle{empty}",
    "\\setlength{\\parindent}{0pt}",
    `\\setlength{\\parskip}{${+(0.15 * density).toFixed(2)}em}`,
    "\\color{ink}",
    `\\setlist[itemize]{leftmargin=1em,label=${MARKER[style]},itemsep=0.2em,topsep=0.2em,parsep=0pt}`,
    `\\newcommand{\\Sep}{\\vspace{${+(0.9 * density).toFixed(2)}em}}`,
    `\\newcommand{\\SmallSep}{\\vspace{${+(0.45 * density).toFixed(2)}em}}`,
    // Spaced capitals in a small size: XCharter's small caps lack accented letters in LaTeX.
    "\\newcommand{\\Caps}[1]{{\\footnotesize\\MakeUppercase{#1}}}",
  ].filter(Boolean);
  if (style === "banda") {
    // A block of the accent colour, then the title.
    lines.push("\\newcommand{\\CVSection}[1]{\\par\\Sep{\\color{accent}\\rule[-0.12em]{3.5bp}{0.95em}}\\hspace{0.5em}{\\large\\bfseries #1}\\par\\nopagebreak[4]\\SmallSep\\nopagebreak[4]}");
    return lines;
  }
  if (style === "claustro") {
    // Capitals in bold over a rule from margin to margin (drawn first, under the baseline).
    lines.push("\\newcommand{\\CVSection}[1]{\\par\\Sep\\noindent\\rlap{\\color{accent}\\rule[-0.4em]{\\linewidth}{0.7bp}}{\\bfseries\\MakeUppercase{#1}}\\par\\nopagebreak[4]\\SmallSep\\nopagebreak[4]}");
    return lines;
  }
  if (style === "recto") {
    // Small capitals of the accent colour over a hairline.
    lines.push("\\newcommand{\\CVSection}[1]{\\par\\Sep\\noindent\\rlap{\\color{ink!22}\\rule[-0.45em]{\\linewidth}{0.5bp}}{\\color{accent}\\bfseries\\Caps{#1}}\\par\\nopagebreak[4]\\SmallSep\\nopagebreak[4]}");
    return lines;
  }
  if (style === "llano") {
    // Bold in the accent colour, nothing else.
    lines.push("\\newcommand{\\CVSection}[1]{\\par\\Sep{\\large\\color{accent}\\bfseries #1\\par}\\nopagebreak[4]\\vspace{0.2em}\\nopagebreak[4]}");
    return lines;
  }
  if (style === "minimal") {
    // Small spaced capitals in bold, nothing else.
    lines.push("\\newcommand{\\CVSection}[1]{\\par\\Sep\\SmallSep{\\bfseries\\Caps{#1}}\\par\\nopagebreak[4]\\SmallSep\\nopagebreak[4]}");
    return lines;
  }
  const k = legajoLook(cv.layout);
  lines.push(
    // Typst's sizes and distances (legajo.typ): a line is its cap height plus the leading below the one before, and
    // a tall letter does not move it; between blocks only the spacing the body writes. The small size keeps the
    // leading of the normal one, as in Typst, where it is set inside the paragraph.
    `\\renewcommand{\\normalsize}{${sized(k.S, (k.cap + 0.55) * k.S)}}\\normalsize`,
    `\\newcommand{\\Small}{${sized(k.small, k.cap * k.small + k.lead)}}`,
    `\\setlength{\\topskip}{${bp(k.S)}}\\setlength{\\parskip}{0pt}\\setlength{\\lineskiplimit}{-4bp}`,
    `\\setlist[itemize]{itemsep=${bp(0.4 * k.d * k.S - k.lead)},topsep=0pt,partopsep=0pt,parsep=0pt}`,
    // A section title in small caps, then a hairline to the end of the line.
    // \\nopagebreak keeps a title with what follows; needspace would misjudge flowfram's frames.
    "\\newcommand{\\CVSection}[1]{{\\color{accent}\\bfseries\\Caps{#1}}\\hspace{0.6em}{\\color{accent!50}\\leaders\\hrule height 0.36em depth -0.32em\\hfill}\\par\\nopagebreak[4]}",
    "\\newcommand{\\SideHeading}[1]{{\\footnotesize\\color{accent}\\bfseries\\Caps{#1}}\\par}",
    `\\newlength{\\DateWidth}\\setlength{\\DateWidth}{${bp(2 * 28.35 * (l.fontSize / 10))}}`,
    // A row of two columns, the period (or a skill's name) and the rest, as a grid row in Typst: each column ends at
    // its last baseline, and the next line is as far below the lower one as below any line.
    "\\newcommand{\\Row}[2]{\\noindent\\parbox[t]{\\DateWidth}{\\raggedright\\Small\\leavevmode\\color{muted}#1\\par\\vskip-\\prevdepth}\\hspace{0.8em}\\parbox[t]{\\dimexpr\\linewidth-\\DateWidth-0.8em\\relax}{#2\\par\\vskip-\\prevdepth}\\par\\prevdepth=0pt}",
  );
  if (l.columns === 2) {
    const left = l.sidebar === "left";
    const sideX = left ? 0 : main + gutter;
    const mainX = left ? side + gutter : 0;
    // The columns' first baselines are where Typst has them: \\topskip below the top of their frame, and the cap
    // height below the top of the column in Typst.
    const raise = (1 - k.cap) * k.S;
    const header = legajoTop(k) - raise;
    const below = textHeight - header;
    lines.push(
      "% Page 1: the header across the top, the sidebar and the main column below it; the main",
      "% column continues on the next pages.",
      `\\newstaticframe[1]{\\textwidth}{${bp(header)}}{0pt}{${bp(below)}}[header]`,
      "\\setstaticframe*{header}{valign=t}",
      `\\newflowframe[1]{${bp(side)}}{${bp(below - raise)}}{${bp(sideX)}}{0pt}[side]`,
      `\\newflowframe[1]{${bp(main)}}{${bp(below)}}{${bp(mainX)}}{0pt}[main]`,
      `\\newflowframe[>1]{${bp(main)}}{${bp(textHeight + raise)}}{${bp(mainX)}}{0pt}[continuation]`,
      // The sidebar exists on page 1 only: if it is taller than its frame, it is scaled to fit
      // rather than pushing the main column off the page.
      "\\newsavebox{\\SideBox}",
      `\\newcommand{\\FitSide}[1]{\\sbox{\\SideBox}{#1}\\ifdim\\dimexpr\\ht\\SideBox+\\dp\\SideBox\\relax>${bp(below - raise - 4)}\\resizebox*{!}{${bp(below - raise - 4)}}{\\usebox{\\SideBox}}\\else\\usebox{\\SideBox}\\fi}`,
    );
  }
  return lines;
}

function items(list: Item[]): string[] {
  if (list.length === 0) return [];
  return ["\\begin{itemize}", ...list.map((it) => `\\item ${laid((it.heading ? `**${it.heading}.** ` : "") + it.text)}`), "\\end{itemize}"];
}

/** The vertical space before the next line or block of `flow`, as TeX adds it to the distance between baselines. */
function skip(flow: Flow, k: LegajoLook): string {
  return `\\par\\vspace{${bp(flow.take() - k.lead)}}`;
}

/** Legajo: the period in its own column, the rest beside it. */
function legajoEntry(e: ResolvedEntry, compact: boolean, k: LegajoLook): string {
  const cell = new Flow();
  cell.take();
  const content = [`\\textbf{${laid(e.title, false)}}`, e.place ? `\\\\{\\itshape\\color{muted}${laid(e.place, false)}}` : ""];
  cell.space(0.55 * k.d * k.S, PAR);
  if (e.note) {
    content.push(skip(cell.space(0.55 * k.d * k.S, PAR), k), `{\\Small\\leavevmode\\color{muted}${laid(e.note, false)}\\par}`);
    cell.space(0.55 * k.d * k.S, PAR);
  }
  if (!compact && e.items.length) content.push(skip(cell.space(0.4 * k.d * k.S, BLOCK), k), items(e.items).join("\n"));
  return `\\Row{${laid(e.period, false)}}{${content.join("")}}`;
}

/** A section of Legajo's main column: the title, then its entries, items and paragraphs. */
function legajoSection(s: ResolvedSection, flow: Flow, k: LegajoLook): string[] {
  const { S, d } = k;
  const out = [skip(flow.space(1.15 * d * S, BLOCK), k), `\\CVSection{${escapeLatex(s.title)}}`];
  flow.space(0.6 * d * S, BLOCK);
  for (const b of s.blocks) {
    if (b.type === "entry") {
      out.push(skip(flow.space(0.75 * d * S, BLOCK), k), legajoEntry(b.entry, s.compact, k));
      flow.space(0, BLOCK);
    } else if (b.type === "item") {
      out.push(skip(flow.space(0.5 * d * S, BLOCK), k), ...items([b]));
      flow.space(0, BLOCK);
    } else {
      out.push(skip(flow.space(0.55 * d * S, PAR), k), `${laid(b.text)}\\par`);
      flow.space(0.55 * d * S, PAR);
    }
  }
  return out;
}

/** Banda and Minimal: the title with the period on the right, the place below it. */
function lineEntry(style: "banda" | "minimal") {
  return (e: ResolvedEntry, compact: boolean): string =>
    [
      "\\par\\SmallSep\\noindent ",
      style === "banda" ? `\\textbf{${laid(e.title, false)}}` : laid(e.title, false),
      `\\hfill{\\small\\color{muted}${escapeLatex(e.period)}}`,
      e.place ? (style === "banda" ? `\\\\{\\small\\color{accent}\\bfseries ${laid(e.place, false)}}` : `\\\\{\\small\\color{muted}${laid(e.place, false)}}`) : "",
      "\\par",
      e.note ? `{\\small\\color{muted}${laid(e.note, false)}}\\par` : "",
      !compact && e.items.length ? items(e.items).join("\n") : "",
    ].join("");
}

type EntryLatex = (e: ResolvedEntry, compact: boolean) => string;

function mainSection(s: ResolvedSection, entry: EntryLatex): string[] {
  const out = [`\\CVSection{${escapeLatex(s.title)}}`];
  let pending: Item[] = [];
  const flush = () => {
    out.push(...items(pending));
    pending = [];
  };
  for (const b of s.blocks) {
    if (b.type === "item") {
      pending.push(b);
      continue;
    }
    flush();
    if (b.type === "paragraph") out.push(`${laid(b.text)}\\par`);
    else out.push(entry(b.entry, s.compact));
  }
  flush();
  return out;
}

function sideBlock(b: ResolvedBlock): string {
  if (b.type === "entry") {
    const e = b.entry;
    return [`\\textbf{${laid(e.title, false)}}`, ...[e.place, e.period].filter(Boolean).map((v) => `\\\\{\\itshape ${laid(v, false)}}`)].join("") + "\\par";
  }
  if (b.type === "item" && b.heading) return `{${laid(`**${b.heading}.** ${b.text}`)}\\par}`;
  return `${laid(b.text)}\\par`;
}

/** A URL safe inside \\href: everything but a few plain characters is percent-encoded, then
 * the percent signs are escaped. No brace, backslash or space can reach TeX. */
export function latexUrl(url: string): string {
  const encoded = [...new TextEncoder().encode(url)]
    .map((b) => (/[A-Za-z0-9\-./:?=@+,;]/.test(String.fromCharCode(b)) && b < 128 ? String.fromCharCode(b) : `%${b.toString(16).toUpperCase().padStart(2, "0")}`))
    .join("");
  return encoded.replace(/%/g, "\\%");
}

function contactValue(c: ResolvedCv["contacts"][number]): string {
  return c.href && c.kind !== "phone" ? `\\href{${latexUrl(c.href)}}{${escapeLatex(c.value)}}` : escapeLatex(c.value);
}

function sidebar(cv: ResolvedCv, photo: string | undefined): string[] {
  const { side } = geometry(cv);
  const k = legajoLook(cv.layout);
  const small = k.small;
  const pitch = small * (k.cap + 0.5);
  // Typst's sidebar: the small size with a leading of 0.5em, a block of 1.1em below every part, 0.25em and the
  // paragraph spacing under its title, 0.6em between the entries of a section.
  const gap = (typst: number, next = small) => `\\vspace{${bp(typst + k.cap * next - pitch)}}`;
  const heading = 0.836 * k.S;
  const inner = side - 2 * 10;
  const out = ["\\setlength{\\fboxsep}{10bp}", `\\FitSide{\\colorbox{tint}{\\begin{minipage}[t]{${bp(inner)}}`, `\\vspace*{2bp}\\raggedright${sized(small, pitch)}`];
  if (photo) out.push(`\\centering${photoCommand(cv, photo, inner)}\\par\\raggedright\\vspace{6bp}`);
  const title = (text: string) => [`\\SideHeading{${escapeLatex(text)}}`, gap(0.25 * small + 0.55 * k.d * small)];
  // `\\\\{}`: a line break that a next line starting with [ or * cannot extend.
  const block = (text: string, values: string[]) => out.push(...title(text), values.join("\\\\{}"), `\\par${gap(1.1 * k.d * small, heading)}`);
  if (cv.highlight) block(cv.highlight.title, [escapeLatex(cv.highlight.text)]);
  if (cv.contacts.length) block(cv.labels.contact, cv.contacts.map(contactValue));
  for (const row of cv.skills) {
    if (row.length === 1) block(row[0].title, row[0].items.map(escapeLatex));
    else {
      const columns = row.map(
        (g) => `\\begin{tabular}[t]{@{}l@{}}{\\footnotesize\\color{accent}\\bfseries\\Caps{${escapeLatex(g.title)}}}\\\\{} ${g.items.map(escapeLatex).join(" \\\\{} ")}\\end{tabular}`,
      );
      out.push(`${columns.join("\\hspace{1em}")}\\par${gap(1.1 * k.d * small, heading)}`);
    }
  }
  for (const s of cv.sections.filter((s) => s.side)) {
    out.push(...title(s.title));
    out.push(s.blocks.map(sideBlock).join(gap(0.6 * small)), gap(1.1 * k.d * small, heading));
  }
  out.push("\\vspace*{2bp}\\end{minipage}}}");
  return out;
}

/** Legajo's name over a rule and the subtitle, each line as far from the one before as in Typst (legajoTop). */
function heading(cv: ResolvedCv, k: LegajoLook): string[] {
  const { S, d, cap } = k;
  return [
    `{${sized(2.1 * S, cap * 2.1 * S)}\\scshape ${escapeLatex(cv.name)}\\par}`,
    `{\\setlength{\\baselineskip}{${bp(0.55 * d * 2.1 * S - 0.35 * S)}}\\noindent{\\color{accent}\\rule[-0.8bp]{\\linewidth}{1.6bp}}\\par}`,
    `{${sized(1.25 * S, 0.1 * S + 0.55 * d * 1.25 * S + cap * 1.25 * S)}\\itshape\\color{muted}${escapeLatex(cv.subtitle)}\\par}`,
  ];
}

function summary(cv: ResolvedCv): string[] {
  return cv.summary ? [`${laid(cv.summary)}\\par`] : [];
}

/** A paragraph of Legajo's main column: the highlight or the summary. */
function legajoPar(flow: Flow, k: LegajoLook, tex: string): string[] {
  const out = [skip(flow.space(0.55 * k.d * k.S, PAR), k), tex];
  flow.space(0.55 * k.d * k.S, PAR);
  return out;
}

/** Legajo, in one column or two. */
function body(cv: ResolvedCv, photo: string | undefined): string[] {
  const k = legajoLook(cv.layout);
  const { S, d } = k;
  const flow = new Flow();
  if (cv.layout.columns === 2) {
    const start = cv.summary ? legajoPar(flow, k, summary(cv)[0]).slice(1) : [];
    const main = cv.sections.filter((s) => !s.side).flatMap((s) => legajoSection(s, flow, k));
    return ["\\begin{staticcontents*}{header}", ...heading(cv, k), "\\end{staticcontents*}", ...sidebar(cv, photo), "\\framebreak", ...start, ...main];
  }
  // The contacts 0.4em below the subtitle, then 1em more than the spacing of the paragraphs down to the body.
  const contacts = cv.contacts.map(contactValue).join(" \\enspace$\\cdot$\\enspace ");
  const below = contacts ? `{${sized(k.small, 0.4 * S + 0.55 * d * 1.25 * S + k.cap * k.small)}\\color{muted}${contacts}\\par}` : "";
  const head = [...heading(cv, k), below].filter(Boolean);
  flow.take();
  flow.space(0.55 * d * (contacts ? k.small : 1.25 * S), PAR).v(d * S);
  const photoWidth = cv.layout.fontSize * 8.5;
  const top = photo
    ? [
        `\\begin{minipage}[b]{\\dimexpr\\linewidth-${bp(photoWidth)}-1em\\relax}`,
        ...head,
        "\\end{minipage}\\hfill",
        `\\begin{minipage}[t]{${bp(photoWidth)}}\\vspace{0pt}${photoCommand(cv, photo, photoWidth)}\\end{minipage}\\par`,
      ]
    : head;
  const out = [...top];
  if (cv.highlight) out.push(...legajoPar(flow, k, `{\\color{accent}\\bfseries ${escapeLatex(cv.highlight.title)}}\\hspace{0.5em}${escapeLatex(cv.highlight.text)}\\par`));
  if (cv.summary) out.push(...legajoPar(flow, k, summary(cv)[0]));
  if (cv.skills.length) {
    // Each skill as a row of a grid, its name in the column of the periods; 0.45em between rows.
    out.push(skip(flow.space(1.15 * d * S, BLOCK), k), `\\CVSection{${escapeLatex(cv.labels.skills)}}`);
    flow.space(0.6 * d * S, BLOCK);
    for (const g of cv.skills.flat()) {
      out.push(skip(flow, k), `\\Row{\\Caps{${escapeLatex(g.title)}}}{${g.items.map(escapeLatex).join(", ")}}`);
      flow.v(0.45 * S);
    }
  }
  return [...out, ...cv.sections.flatMap((s) => legajoSection(s, flow, k))];
}

const DOT = " $\\cdot$ ";
const size = (cv: ResolvedCv, scale: number) => `\\fontsize{${+(cv.layout.fontSize * scale).toFixed(1)}}{${+(cv.layout.fontSize * scale * 1.2).toFixed(1)}}\\selectfont `;

/** Banda: a band of the accent colour across the top of page 1 with the name and the photo in
 * white; contacts, skills, highlight and summary below it; one column. */
function bandaBody(cv: ResolvedCv, photo: string | undefined): string[] {
  const band = 36; // mm, as in banda.typ
  const inner = Math.max(band - cv.layout.margins.top, 12) * MM;
  const photoWidth = Math.max(band - cv.layout.margins.top - 8, 10) * MM;
  const names = [`{${size(cv, 2.3)}\\bfseries ${escapeLatex(cv.name)}\\par}`, "\\vspace{2bp}", `{${size(cv, 1.25)}${escapeLatex(cv.subtitle)}\\par}`];
  const head = photo
    ? [
        `\\begin{minipage}{\\dimexpr\\linewidth-${bp(photoWidth)}-1em\\relax}`,
        ...names,
        `\\end{minipage}\\hfill\\begin{minipage}{${bp(photoWidth)}}${photoCommand(cv, photo, photoWidth, cv.layout.photo === "square" ? "rounded" : cv.layout.photo)}\\end{minipage}`,
      ]
    : names;
  const out = [
    `\\AddToShipoutPictureBG*{\\AtPageUpperLeft{\\color{accent}\\rule[-${band}mm]{\\paperwidth}{${band}mm}}}`,
    `\\noindent\\parbox[b][${bp(inner)}][c]{\\linewidth}{\\color{white}`,
    ...head,
    "}\\par\\vspace{0.9em}",
  ];
  if (cv.contacts.length) out.push(`{\\small\\color{muted}${cv.contacts.map(contactValue).join("\\enspace{\\color{accent}\\textbullet}\\enspace ")}\\par}`);
  for (const row of cv.skills) {
    const group = (g: (typeof row)[number]) => `\\textbf{${escapeLatex(g.title)}}: ${g.items.map(escapeLatex).join(DOT)}`;
    const width = `\\dimexpr(\\linewidth-${1.5 * (row.length - 1)}em)/${row.length}\\relax`;
    out.push(`{\\small${row.map((g) => `\\parbox[t]{${width}}{\\raggedright ${group(g)}}`).join("\\hspace{1.5em}")}\\par}\\vspace{0.25em}`);
  }
  if (cv.highlight) out.push(`\\SmallSep{\\color{accent}\\bfseries ${escapeLatex(cv.highlight.title)}}\\hspace{0.4em}${escapeLatex(cv.highlight.text)}\\par`);
  if (cv.summary) out.push("\\SmallSep", ...summary(cv));
  return [...out, ...cv.sections.flatMap((s) => mainSection(s, lineEntry("banda")))];
}

/** Minimal: the name in the accent colour, the subtitle below it, the contacts on the right; a
 * lot of air, hierarchy from size and weight; one column. */
function minimalBody(cv: ResolvedCv, photo: string | undefined): string[] {
  const photoWidth = cv.layout.fontSize * 7.5;
  const names = [`{${size(cv, 2.6)}\\color{accent}${escapeLatex(cv.name)}\\par}`, "\\vspace{2bp}", `{${size(cv, 1.2)}\\color{muted}${escapeLatex(cv.subtitle)}\\par}`];
  const out = [`\\noindent\\begin{minipage}[b]{${cv.contacts.length || photo ? "0.55" : "1"}\\linewidth}`, ...names, "\\end{minipage}\\hfill"];
  if (cv.contacts.length) out.push(`{\\small\\color{muted}\\begin{tabular}[b]{@{}r@{}}${cv.contacts.map(contactValue).join("\\\\{}")}\\end{tabular}}`);
  if (photo) out.push(`\\hspace{1.4em}\\begin{minipage}[b]{${bp(photoWidth)}}${photoCommand(cv, photo, photoWidth)}\\end{minipage}`);
  out.push("\\par");
  if (cv.highlight) out.push(`\\Sep{\\bfseries ${escapeLatex(cv.highlight.title)}}\\hspace{0.4em}${escapeLatex(cv.highlight.text)}\\par`);
  if (cv.summary) out.push("\\Sep", ...summary(cv));
  if (cv.skills.length) {
    out.push(`\\CVSection{${escapeLatex(cv.labels.skills)}}`, "\\begin{tabular}{@{}p{0.22\\linewidth}@{\\hspace{1.5em}}p{\\dimexpr0.78\\linewidth-1.5em\\relax}@{}}");
    out.push(...cv.skills.flat().map((g) => `\\leavevmode{\\small\\color{muted}${escapeLatex(g.title)}} & ${g.items.map(escapeLatex).join(DOT)}\\\\[0.3em]`));
    out.push("\\end{tabular}\\par");
  }
  return [...out, ...cv.sections.flatMap((s) => mainSection(s, lineEntry("minimal")))];
}

/** An entry of Claustro (the institution above, the position and the dates below), Recto (the
 * position and the dates, the institution below) or Llano (all on one line). */
function atsEntry(style: AtsStyle): EntryLatex {
  return (e, compact) => {
    const title = laid(e.title, false);
    const place = laid(e.place, false);
    const period = e.period ? `\\hfill{${style === "claustro" ? "" : "\\small\\color{muted}"}${escapeLatex(e.period)}}` : "";
    const head =
      style === "claustro"
        ? e.place
          ? `\\textbf{${place}}\\\\\\textit{${title}}${period}`
          : `\\textbf{${title}}${period}`
        : style === "recto"
          ? `\\textbf{${title}}${period}${e.place ? `\\\\{\\color{muted}${place}}` : ""}`
          : `\\textbf{${title}}${e.place ? `, ${place}` : ""}${period}`;
    return [
      "\\par\\SmallSep\\noindent ",
      head,
      "\\par",
      e.note ? `{\\small\\color{muted}${laid(e.note, false)}}\\par` : "",
      !compact && e.items.length ? items(e.items).join("\n") : "",
    ].join("");
  };
}

/** Claustro, Recto and Llano, made for applicant tracking systems: one column of plain text in the
 * order it is read, the contacts on one line in the body, every part under a standard title. */
function atsBody(cv: ResolvedCv, photo: string | undefined, style: AtsStyle): string[] {
  const sep = style === "recto" ? "\\enspace\\textbar\\enspace " : "\\enspace\\textperiodcentered\\enspace ";
  const contacts = cv.contacts.map(contactValue).join(sep);
  const subtitleLook = { claustro: "\\itshape ", recto: "\\color{accent}", llano: "" }[style];
  const head = [
    style === "claustro" ? "{\\centering" : "{",
    `{${size(cv, style === "llano" ? 2 : 2.2)}${style === "llano" ? "\\color{accent}" : "\\bfseries "}${escapeLatex(cv.name)}\\par}`,
    cv.subtitle ? `\\vspace{2bp}{${size(cv, style === "llano" ? 1.1 : 1.15)}${subtitleLook}${escapeLatex(cv.subtitle)}\\par}` : "",
    contacts ? `\\vspace{2bp}{\\small${style === "claustro" ? " " : "\\color{muted}"}${contacts}\\par}` : "",
    "}",
  ].filter(Boolean);
  const photoWidth = cv.layout.fontSize * 7;
  const top = photo
    ? [
        `\\noindent\\begin{minipage}[t]{\\dimexpr\\linewidth-${bp(photoWidth)}-1em\\relax}\\vspace{0pt}`,
        ...head,
        "\\end{minipage}\\hfill",
        `\\begin{minipage}[t]{${bp(photoWidth)}}\\vspace{0pt}${photoCommand(cv, photo, photoWidth)}\\end{minipage}\\par`,
      ]
    : head;
  // Ragged right and no hyphenation, as in Typst: a word split at a line end reaches a parser in two.
  const out = ["\\raggedright\\hyphenpenalty=10000\\exhyphenpenalty=10000", ...top];
  if (cv.highlight) out.push(`\\Sep{${style === "recto" ? "\\color{accent}" : ""}\\bfseries ${escapeLatex(cv.highlight.title)}}: ${escapeLatex(cv.highlight.text)}\\par`);
  if (cv.summary) out.push(`\\CVSection{${escapeLatex(cv.labels.profile)}}`, ...summary(cv));
  if (cv.skills.length) {
    out.push(`\\CVSection{${escapeLatex(cv.labels.skills)}}`, ...cv.skills.flat().map((g) => `\\textbf{${escapeLatex(g.title)}}: ${g.items.map(escapeLatex).join(", ")}\\par`));
  }
  return [...out, ...cv.sections.flatMap((s) => mainSection(s, atsEntry(style)))];
}

/** The CV in LaTeX; with `measured` (measure.typ's words), in the lines Typst gave it. */
export function renderLatex(cv: ResolvedCv, style: LatexStyle = "legajo", measured?: MeasuredWord[]): string {
  const photo = photoFile(cv);
  lines = measured && new Lines(measured);
  try {
    const content =
      style === "banda" ? bandaBody(cv, photo) : style === "minimal" ? minimalBody(cv, photo) : isAtsStyle(style) ? atsBody(cv, photo, style) : body(cv, photo);
    // The lines are Typst's: no word is cut where Typst did not cut it.
    const unbroken = measured ? ["\\hyphenpenalty=10000\\exhyphenpenalty=10000"] : [];
    return [...preamble(cv, style), "\\begin{document}", ...unbroken, ...content, "\\end{document}", ""].join("\n");
  } finally {
    lines = undefined;
  }
}

export function latexBundle(project: Project, profileId: string, measured?: MeasuredWord[]): ZipInput {
  // An imported LaTeX template is handed out as itself, filled with the CV.
  if (latexStyleOf(project, profileId)) return latexTemplateBundle(project, profileId);
  const { cv, style, custom, standsIn } = resolveStyled(project, profileId);
  const files: ZipInput = {
    "cv.tex": renderLatex(cv, style, measured),
    "README.txt": [
      "CV made with Foja (https://github.com/bafif/foja).",
      "",
      "Compile cv.tex with pdflatex (or lualatex, or tectonic); it needs the memoir, XCharter (or",
      "noto), flowfram, eso-pic, tikz, enumitem and hyperref packages, which come with TeX Live",
      "and MiKTeX.",
      custom
        ? "The profile uses a style of your own, written in Typst, which cannot be turned into LaTeX: this is in Foja's Legajo look. The Typst export keeps your style."
        : standsIn
          ? `The profile uses Foja's ${styleName(standsIn)} style, which has no LaTeX version of its own: this is in the layout of the ${STYLE_NAMES[style]} style, with ${styleName(standsIn)}'s colour. The Typst export keeps ${styleName(standsIn)}.`
          : `It is in the look of Foja's ${STYLE_NAMES[style]} style, the one the profile uses.`,
      ...(cv.photo?.type === "image/svg+xml" ? ["", "The photo is an SVG, which pdflatex cannot include, so it was left out."] : []),
      "",
    ].join("\n"),
  };
  const photo = photoFile(cv);
  if (photo) files[photo] = cv.photo!.bytes;
  return files;
}
