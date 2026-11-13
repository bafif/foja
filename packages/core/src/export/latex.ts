// LaTeX export: one self-contained `cv.tex` (memoir) with its photo, in a `.zip`, in the look of the
// profile's built-in style: Legajo (two columns with flowfram, or one), Banda, Minimal, Claustro,
// Recto or Llano. A style of the user's own is Typst code that cannot be turned into LaTeX, so it
// comes out as Legajo. It follows the layout options; the measurements are in big points (`bp`,
// the Typst point).

import { HYPHEN_LINE, LINE, Lines, type MeasuredWord } from "../lines.ts";
import { BLOCK, capHeight, Flow, legajoLook, legajoTop, look, PAR, photoHeight, titleLook, type LegajoLook, type Look, type OneColumnStyle } from "./flow.ts";
import type { ResolvedBlock, ResolvedCv, ResolvedEntry, ResolvedSection } from "../resolve.ts";
import { DEFAULT_ACCENT } from "../project.ts";
import type { Item, Project } from "../types.ts";
import type { ZipInput } from "../zip.ts";
import { resolveStyled, STYLE_NAMES, styleName, type AtsStyle, type ExportStyle } from "./style.ts";
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
  const m = l.margins;
  const accent = (l.accent ?? DEFAULT_ACCENT).slice(1).toUpperCase();
  const font = l.font === "Noto Sans" ? "\\usepackage[sfdefault]{noto}" : "\\usepackage{XCharter}";
  // The one-column styles' text starts (1 − cap height) em higher: their first baseline, \\topskip below it, is where
  // Typst has it, the cap height below the margin.
  const top = style === "legajo" ? `${m.top}mm` : bp(m.top * MM - (1 - capHeight(l.font === "Noto Sans")) * look(style, l).S);
  const lines = [
    `\\documentclass[${paper.option},${size}pt]{memoir}`,
    `% Made with Foja (https://github.com/bafif/foja), ${STYLE_NAMES[style]} style. Compile with pdflatex, lualatex or tectonic.`,
    "\\usepackage[T1]{fontenc}",
    font,
    `\\usepackage[${BABEL[cv.language.split("-")[0]] ?? "english"}]{babel}`,
    `\\usepackage[paperwidth=${paper.width}mm,paperheight=${paper.height}mm,top=${top},bottom=${m.bottom}mm,left=${m.left}mm,right=${m.right}mm]{geometry}`,
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
    "\\color{ink}",
    `\\setlist[itemize]{leftmargin=1em,label=${MARKER[style]},itemsep=0.2em,topsep=0.2em,parsep=0pt}`,
    // Spaced capitals in a small size: XCharter's small caps lack accented letters in LaTeX.
    "\\newcommand{\\Caps}[1]{{\\footnotesize\\MakeUppercase{#1}}}",
  ].filter(Boolean);
  if (style !== "legajo") {
    // Typst's sizes and distances (styles/*.typ), as Legajo's below.
    const k = look(style, l);
    const t = titleLook(style, k);
    const title = `{${sized(t.size, t.top + k.lead)}\\noindent `;
    const TITLE: Record<OneColumnStyle, string> = {
      // A block of the accent colour, then the title.
      banda: `${title}{\\color{accent}\\rule[${bp(-0.12 * k.S)}]{3.5bp}{${bp(0.95 * k.S)}}}\\hspace{${bp(0.5 * k.S)}}\\bfseries #1\\par}`,
      // Small capitals in bold, nothing else.
      minimal: `${title}\\bfseries\\MakeUppercase{#1}\\par}`,
      // Capitals in bold over a rule from margin to margin (drawn first), at the bottom of the title's inset.
      claustro: `${title}\\rlap{\\color{accent}\\rule[${bp(-t.under - 0.35)}]{\\linewidth}{0.7bp}}\\bfseries\\MakeUppercase{#1}\\par}`,
      // Small capitals of the accent colour over a hairline.
      recto: `${title}\\rlap{\\color{ink!22}\\rule[${bp(-t.under - 0.25)}]{\\linewidth}{0.5bp}}\\color{accent}\\bfseries\\MakeUppercase{#1}\\par}`,
      // Bold in the accent colour, nothing else.
      llano: `${title}\\color{accent}\\bfseries #1\\par}`,
    };
    lines.push(
      `\\renewcommand{\\normalsize}{${sized(k.S, k.cap * k.S + k.lead)}}\\normalsize`,
      `\\newcommand{\\Small}{${sized(k.small, k.cap * k.small + k.lead)}}`,
      `\\setlength{\\topskip}{${bp(k.S)}}\\setlength{\\parskip}{0pt}\\setlength{\\lineskiplimit}{-4bp}`,
      // As Typst's list: the marker `indent` in, the text `body-indent` after it.
      `\\setlist[itemize]{leftmargin=${bp(k.indent + k.marker + k.body)},labelwidth=${bp(k.marker)},labelsep=${bp(k.body)},align=left,itemsep=${bp(k.list - k.lead)},topsep=0pt,partopsep=0pt,parsep=0pt}`,
      `\\newcommand{\\CVSection}[1]{${TITLE[style]}\\nopagebreak[4]}`,
      "\\newlength{\\SkillWidth}",
    );
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

/** The vertical space before the next line or block of `flow`, as TeX adds it to the distance between baselines: less
 * `lead`, the leading of the paragraph that follows. */
function skip(flow: Flow, k: { lead: number }, lead = k.lead): string {
  return `\\par\\vspace{${bp(flow.take() - lead)}}`;
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
    // Each skill as a row of a grid, its name in the column of the periods; 0.45em between rows, and between the grids
    // of two rows of skills the paragraph spacing too.
    out.push(skip(flow.space(1.15 * d * S, BLOCK), k), `\\CVSection{${escapeLatex(cv.labels.skills)}}`);
    flow.space(0.6 * d * S, BLOCK);
    for (const row of cv.skills) {
      row.forEach((g, i) => {
        if (i === 0) flow.space(0.55 * d * S, PAR);
        else flow.v(0.45 * S);
        out.push(skip(flow, k), `\\Row{\\Caps{${laid(g.title, false)}}}{${g.items.map(escapeLatex).join(", ")}}`);
      });
      flow.space(0.55 * d * S, PAR).v(0.45 * S);
    }
  }
  return [...out, ...cv.sections.flatMap((s) => legajoSection(s, flow, k))];
}

// ---------------------------------------------------------------- the one-column styles, with Typst's spacing

/** Justified, as the paragraphs set with `justify: true` in a style whose others are not. */
const JUSTIFIED = "\\rightskip=0pt\\parfillskip=0pt plus1fil ";

/** How many lines Typst gave `text`, when it has them; one when not. */
function lineCount(text: string): number {
  const l = lines?.lay(text);
  return l ? l.text.split(new RegExp(`[${LINE}${HYPHEN_LINE}]`)).length : 1;
}

/** A header as Typst lays it out: a line whose baseline is the cap height below the top margin, where Typst has a
 * page's first line, and on it every piece at its place, `y` its baseline below the top margin, across the text width
 * to the left, the centre or the right. None of it takes room: the body goes on from where Typst has the header end. */
function placed(k: Look, pieces: { y: number; tex: string; align?: "l" | "c" | "r" }[]): string {
  const at = (p: (typeof pieces)[number]) => `\\smash{\\rlap{\\raisebox{${bp(k.cap * k.S - p.y)}}{\\makebox[\\linewidth][${p.align ?? "l"}]{${p.tex}}}}}`;
  return `\\noindent\\rule{0pt}{${bp(k.S)}}${pieces.map(at).join("")}\\par`;
}

/** A row of a grid: its cells side by side, `gutter` bp apart, each ending at its last baseline; the next line is as
 * far below the lowest of them as below any line. */
function cells(widths: string[], contents: string[], gutter: number): string {
  const cell = (c: string, i: number) => `\\parbox[t]{${widths[i]}}{\\raggedright\\leavevmode ${c}\\par\\vskip-\\prevdepth}`;
  return `\\noindent${contents.map(cell).join(`\\hspace{${bp(gutter)}}`)}\\par\\prevdepth=0pt`;
}

/** A paragraph of the text size, after the spacing of a paragraph. */
function columnPar(flow: Flow, k: Look, tex: string): string[] {
  const out = [skip(flow.space(k.par, PAR), k), tex];
  flow.space(k.par, PAR);
  return out;
}

/** A section title of a one-column style, kept with what follows. */
function columnTitle(style: OneColumnStyle, flow: Flow, k: Look, title: string): string[] {
  const out = [skip(flow.space(k.above, BLOCK), k), `\\CVSection{${escapeLatex(title)}}`];
  flow.v(titleLook(style, k).under).space(k.below, BLOCK);
  return out;
}

/** An entry of a one-column style. Banda: the title with the dates on the right in the small size, the place below it
 * in the accent colour, the note in a paragraph of its own. Minimal: the title and the dates in a grid, the place and
 * the note in paragraphs of the small size. Claustro: the institution above, the position and the dates below. Recto:
 * the position and the dates, the institution below. Llano: all on one line. The lines of one paragraph in Typst are
 * paragraphs here as far apart, each with the leading of its size. */
function columnEntry(style: OneColumnStyle, e: ResolvedEntry, compact: boolean, flow: Flow, k: Look): string[] {
  const out = [skip(flow.space(k.entry, BLOCK), k)];
  const title = laid(e.title, false);
  const place = laid(e.place, false);
  const period = e.period ? `\\hfill{${style === "claustro" ? "" : "\\Small\\color{muted}"}${escapeLatex(e.period)}}` : "";
  const small = (tex: string) => `{\\Small\\leavevmode${tex}\\par}`;
  const note = e.note ? small(`\\color{muted}${laid(e.note, false)}`) : "";
  if (style === "minimal") {
    out.push(`${title}${period}\\par`);
    flow.space(k.par, PAR);
    if (e.place) {
      const lead = k.leadEm * k.small;
      out.push(skip(flow.space(k.parEm * k.small, PAR), k, lead), `{${sized(k.small, k.cap * k.small + lead)}\\leavevmode\\color{muted}${place}\\par}`);
      flow.space(k.parEm * k.small, PAR);
    }
    if (note) out.push(...columnPar(flow, k, note));
    if (!compact && e.items.length) flow.v(0.2 * k.S);
  } else {
    const head =
      style === "banda"
        ? [`\\textbf{${title}}${period}\\par`, e.place ? small(`\\color{accent}\\bfseries ${place}`) : ""]
        : style === "claustro"
          ? e.place
            ? [`\\textbf{${place}}\\par`, `\\textit{${title}}${period}\\par`]
            : [`\\textbf{${title}}${period}\\par`]
          : style === "recto"
            ? [`\\textbf{${title}}${period}\\par`, e.place ? `{\\leavevmode\\color{muted}${place}}\\par` : ""]
            : [`\\textbf{${title}}${e.place ? `, ${place}` : ""}${period}\\par`];
    out.push(head.join(""));
    flow.space(k.par, PAR);
    if (style === "banda" && note) out.push(...columnPar(flow, k, note));
    else out.push(note);
  }
  if (!compact && e.items.length) out.push(skip(flow.space(k.list, BLOCK), k), ...items(e.items));
  flow.space(0, BLOCK);
  return out;
}

/** A section of a one-column style: the title, then its entries, items and paragraphs. */
function columnSection(style: OneColumnStyle, s: ResolvedSection, flow: Flow, k: Look): string[] {
  const out = columnTitle(style, flow, k, s.title);
  for (const b of s.blocks) {
    if (b.type === "entry") out.push(...columnEntry(style, b.entry, s.compact, flow, k));
    else if (b.type === "item") {
      out.push(skip(flow.space(k.item, BLOCK), k), ...items([b]));
      flow.space(0, BLOCK);
    } else out.push(...columnPar(flow, k, `${laid(b.text)}\\par`));
  }
  return out;
}

/** Banda: a band of the accent colour across the top of page 1, as tall as Typst's, with the name and the photo in
 * white; the contacts, the skills in a grid, the highlight and the summary below it. */
function bandaTop(cv: ResolvedCv, photo: string | undefined, flow: Flow, k: Look): string[] {
  const band = 36; // mm, as in banda.typ
  const height = Math.max(band - cv.layout.margins.top, 12) * MM;
  const name = 2.3 * k.B;
  const subtitle = 1.25 * k.B;
  const names = k.cap * name + k.parEm * name + 0.1 * k.S + k.cap * subtitle;
  const width = Math.max(band - cv.layout.margins.top - 8, 10) * MM;
  const shape = cv.layout.photo === "square" ? "rounded" : cv.layout.photo;
  const tall = photo ? photoHeight(width, shape, cv.photo?.size) : 0;
  const row = Math.max(names, tall);
  const top = (row - names) / 2;
  const pieces: Parameters<typeof placed>[1] = [
    { y: top + k.cap * name, tex: `${sized(name, 1.2 * name)}\\color{white}\\bfseries ${escapeLatex(cv.name)}` },
    { y: top + names, tex: `${sized(subtitle, 1.2 * subtitle)}\\color{white}${escapeLatex(cv.subtitle)}` },
  ];
  if (photo) pieces.push({ y: (row - tall) / 2 + tall, tex: photoCommand(cv, photo, width, shape), align: "r" });
  const out = [`\\AddToShipoutPictureBG*{\\AtPageUpperLeft{\\color{accent}\\rule[-${band}mm]{\\paperwidth}{${band}mm}}}`, placed(k, pieces)];
  flow.take();
  flow.v(height - k.cap * k.S).space(k.par, PAR).v(0.9 * k.S);
  const lead = k.leadEm * k.small;
  const smallPar = `${sized(k.small, k.cap * k.small + lead)}\\leavevmode`;
  if (cv.contacts.length) {
    const dot = `\\hspace{${bp(0.45 * k.small)}}{\\color{accent}\\textbullet}\\hspace{${bp(0.45 * k.small)}}`;
    out.push(skip(flow.space(k.parEm * k.small, PAR), k, lead), `{${smallPar}\\color{muted}${cv.contacts.map(contactValue).join(dot)}\\par}`);
    flow.space(k.parEm * k.small, PAR);
  }
  if (cv.skills.length) flow.v(0.5 * k.S);
  for (const row of cv.skills) {
    const w = `\\dimexpr(\\linewidth-${bp(1.5 * k.S * (row.length - 1))})/${row.length}\\relax`;
    const group = (g: (typeof row)[number]) => `\\textbf{${escapeLatex(g.title)}}: ${g.items.map(escapeLatex).join(" \\textperiodcentered{} ")}`;
    out.push(skip(flow.space(k.par, PAR), k, lead), `{${smallPar}${cells(row.map(() => w), row.map(group), 1.5 * k.S)}}`);
    flow.space(k.par, PAR).v(0.25 * k.S);
  }
  if (cv.highlight) {
    flow.v(0.5 * k.S);
    out.push(...columnPar(flow, k, `\\leavevmode{\\color{accent}\\bfseries ${escapeLatex(cv.highlight.title)}}\\hspace{${bp(0.4 * k.S)}}${escapeLatex(cv.highlight.text)}\\par`));
  }
  if (cv.summary) {
    flow.v(0.4 * k.S);
    out.push(...columnPar(flow, k, `{${JUSTIFIED}${lines ? "" : "\\hyphenpenalty=50 "}${laid(cv.summary)}\\par}`));
  }
  return out;
}

/** Minimal: the name in the accent colour over the subtitle, the contacts one under the other on their right and the
 * photo beside them, all at the bottom of one row but the photo; a lot of air, hierarchy from size and weight. */
function minimalTop(cv: ResolvedCv, photo: string | undefined, flow: Flow, k: Look): string[] {
  const name = 2.6 * k.B;
  const subtitle = 1.2 * k.B;
  const names = k.cap * name + k.parEm * name + 0.15 * k.S + k.cap * subtitle;
  const pitch = k.leadEm * k.small + k.cap * k.small;
  const n = cv.contacts.length;
  const width = 7.5 * k.B;
  const tall = photo ? photoHeight(width, cv.layout.photo, cv.photo?.size) : 0;
  const row = Math.max(names, n ? k.cap * k.small + (n - 1) * pitch : 0, tall);
  const right = photo ? `\\hspace{${bp(width + 1.4 * k.S)}}` : "";
  const pieces: Parameters<typeof placed>[1] = [
    { y: row - names + k.cap * name, tex: `${sized(name, 1.2 * name)}\\color{accent}${escapeLatex(cv.name)}` },
    { y: row, tex: `${sized(subtitle, 1.2 * subtitle)}\\color{muted}${escapeLatex(cv.subtitle)}` },
    ...cv.contacts.map((c, i) => ({ y: row - (n - 1 - i) * pitch, tex: `{\\Small\\color{muted}${contactValue(c)}}${right}`, align: "r" as const })),
  ];
  if (photo) pieces.push({ y: tall, tex: photoCommand(cv, photo, width), align: "r" });
  const out = [placed(k, pieces)];
  flow.take();
  flow.v(row - k.cap * k.S).space(k.par, PAR);
  if (cv.highlight) {
    flow.v(1.4 * k.d * k.S);
    out.push(...columnPar(flow, k, `\\leavevmode{\\bfseries ${escapeLatex(cv.highlight.title)}}\\hspace{${bp(0.4 * k.S)}}${escapeLatex(cv.highlight.text)}\\par`));
  }
  if (cv.summary) {
    // In a size of its own, with the leading of the text size.
    flow.v(1.4 * k.d * k.S);
    const size = 1.02 * k.B;
    out.push(...columnPar(flow, k, `{${sized(size, k.cap * size + k.lead)}${JUSTIFIED}${lines ? "" : "\\hyphenpenalty=50 "}${laid(cv.summary)}\\par}`));
  }
  if (cv.skills.length) out.push(...columnTitle("minimal", flow, k, cv.labels.skills));
  for (const row of cv.skills) {
    // A grid for each row of groups, its first column as wide as its longest name.
    out.push(`\\settowidth{\\SkillWidth}{\\Small\\begin{tabular}{@{}l@{}}${row.map((g) => escapeLatex(g.title)).join("\\\\")}\\end{tabular}}`);
    row.forEach((g, i) => {
      if (i === 0) flow.space(k.par, PAR);
      else flow.v(0.5 * k.S);
      const contents = [`\\Small\\color{muted}${escapeLatex(g.title)}`, g.items.map(escapeLatex).join(" \\textperiodcentered{} ")];
      out.push(skip(flow, k), cells(["\\SkillWidth", `\\dimexpr\\linewidth-\\SkillWidth-${bp(1.5 * k.S)}\\relax`], contents, 1.5 * k.S));
    });
    flow.space(k.par, PAR).v(0.5 * k.S);
  }
  return out;
}

/** Claustro, Recto and Llano, made for applicant tracking systems: one column of plain text in the order it is read,
 * the name, the subtitle and the contacts on a line each (centred in Claustro), the photo beside them; every part under
 * a standard title. */
function atsTop(cv: ResolvedCv, photo: string | undefined, style: AtsStyle, flow: Flow, k: Look): string[] {
  const name = (style === "llano" ? 2 : 2.2) * k.B;
  const subtitle = (style === "recto" ? 1.15 : 1.1) * k.B;
  const width = (style === "llano" ? 6.5 : 7) * k.B;
  const tall = photo ? photoHeight(width, cv.layout.photo, cv.photo?.size) : 0;
  const gutter = (style === "claustro" ? 1 : 1.2) * k.S;
  const align = style === "claustro" ? "c" : "l";
  const column = !photo ? "\\linewidth" : `\\dimexpr\\linewidth-${bp((style === "claustro" ? 2 : 1) * (width + gutter))}\\relax`;
  const head: Parameters<typeof placed>[1] = [];
  let y = k.cap * name;
  head.push({ y, align, tex: `${sized(name, 1.2 * name)}${style === "llano" ? "\\color{accent}" : "\\bfseries "}${escapeLatex(cv.name)}` });
  if (cv.subtitle) {
    y += k.par + k.cap * subtitle;
    head.push({ y, align, tex: `${sized(subtitle, 1.2 * subtitle)}${{ claustro: "\\itshape ", recto: "\\color{accent}", llano: "" }[style]}${escapeLatex(cv.subtitle)}` });
  }
  if (cv.contacts.length) {
    const sep = style === "recto" ? " | " : " · ";
    const tex = cv.contacts.map(contactValue).join(style === "recto" ? " \\textbar{} " : " \\textperiodcentered{} ");
    y += k.par + k.cap * k.small;
    head.push({ y, align, tex: `\\parbox[t]{${column}}{${style === "claustro" ? "\\centering" : "\\raggedright"}\\Small${style === "claustro" ? " " : "\\color{muted}"}${tex}}` });
    y += (lineCount(cv.contacts.map((c) => c.value).join(sep)) - 1) * (k.lead + k.cap * k.small);
  }
  // Beside the photo, the header in the middle of the row.
  const row = Math.max(y, tall);
  const pieces = head.map((p) => ({ ...p, y: p.y + (row - y) / 2 }));
  if (photo) pieces.push({ y: tall, tex: photoCommand(cv, photo, width), align: "r" });
  const out = [placed(k, pieces)];
  flow.take();
  flow.v(row - k.cap * k.S).space(k.par, PAR);
  if (cv.highlight) {
    flow.v((style === "llano" ? 0.5 : 0.6) * k.d * k.S);
    out.push(...columnPar(flow, k, `\\leavevmode{${style === "recto" ? "\\color{accent}" : ""}\\bfseries ${escapeLatex(cv.highlight.title)}}: ${escapeLatex(cv.highlight.text)}\\par`));
  }
  if (cv.summary) out.push(...columnTitle(style, flow, k, cv.labels.profile), ...columnPar(flow, k, `${laid(cv.summary)}\\par`));
  if (cv.skills.length) out.push(...columnTitle(style, flow, k, cv.labels.skills));
  for (const g of cv.skills.flat()) out.push(...columnPar(flow, k, `\\textbf{${escapeLatex(g.title)}}: ${g.items.map(escapeLatex).join(", ")}\\par`));
  return out;
}

/** Banda, Minimal, Claustro, Recto or Llano: one column, ragged right, words cut only where Typst cuts them. */
function columnBody(cv: ResolvedCv, photo: string | undefined, style: OneColumnStyle): string[] {
  const k = look(style, cv.layout);
  const flow = new Flow();
  const top = style === "banda" ? bandaTop(cv, photo, flow, k) : style === "minimal" ? minimalTop(cv, photo, flow, k) : atsTop(cv, photo, style, flow, k);
  return ["\\raggedright\\hyphenpenalty=10000\\exhyphenpenalty=10000", ...top, ...cv.sections.flatMap((s) => columnSection(style, s, flow, k))];
}

/** The CV in LaTeX; with `measured` (measure.typ's words), in the lines Typst gave it. */
export function renderLatex(cv: ResolvedCv, style: LatexStyle = "legajo", measured?: MeasuredWord[]): string {
  const photo = photoFile(cv);
  lines = measured && new Lines(measured);
  try {
    const content =
      style === "legajo" ? body(cv, photo) : columnBody(cv, photo, style);
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
