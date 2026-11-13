// Word export with the `docx` library, in the look of the profile's built-in style (Legajo for a
// style of the user's own). Legajo: the name in small caps over a rule, the sidebar as a shaded
// cell, small-caps section titles, and every entry as a row with its dates in a column of their
// own; one or two columns following the layout options. Banda: the name in a band of the accent
// colour, titles marked with a bar of it. Minimal: the name in the accent colour, plain capitals
// for the titles. Both are one column. Claustro, Recto and Llano, made for applicant tracking
// systems, are paragraphs only (no tables), the contacts in the body, the dates on a right tab stop.
// The fonts are Typst's, XCharter or Noto Sans, embedded in the file in their four faces when the caller passes them
// (packages/template/word-fonts, made by scripts/word-fonts.py).

import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  ImageRun,
  LevelFormat,
  LineRuleType,
  Packer,
  Paragraph,
  ShadingType,
  Tab,
  TabStopType,
  Table,
  TableBorders,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type IParagraphOptions,
  type ParagraphChild,
} from "docx";
import { HYPHEN_LINE, LINE, type Lines } from "../lines.ts";
import { DEFAULT_ACCENT, inlineRuns } from "../project.ts";
import type { ResolvedBlock, ResolvedContact, ResolvedCv, ResolvedEntry, ResolvedSection } from "../resolve.ts";
import type { Item } from "../types.ts";
import { isAtsStyle, type AtsStyle, type ExportStyle } from "./style.ts";

const TWIP_PER_MM = 1440 / 25.4;
const PAPER = { a4: { width: 210, height: 297 }, "us-letter": { width: 215.9, height: 279.4 } };
const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE };
const INK = "1F2A2E";
const MUTED = "68767B";

/** The files of packages/template/word-fonts, by name (`XCharter-Regular.ttf`): the fonts the export embeds. */
export type WordFonts = Record<string, Uint8Array>;

const FACES = { data: "Regular", bold: "Bold", italic: "Italic", boldItalic: "BoldItalic" } as const;

/** The four faces of `family` to embed, when `fonts` has them. */
function embedded(family: string, fonts: WordFonts | undefined) {
  const face = (name: string) => fonts?.[`${family.replace(" ", "")}-${name}.ttf`];
  if (!face("Regular")) return [];
  const faces = Object.fromEntries(Object.entries(FACES).map(([option, name]) => [option, face(name)]).filter(([, data]) => data));
  // The library's type says Buffer; it only slices and copies the bytes, which a Uint8Array does too.
  return [{ name: family, ...faces } as unknown as { name: string; data: Buffer }];
}

/** `#rrggbb` mixed with white: `amount` 0 is the colour, 1 is white. */
function lighten(hex: string, amount: number): string {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return c.map((v) => Math.round(v + (255 - v) * amount).toString(16).padStart(2, "0")).join("").toUpperCase();
}

interface Ctx {
  cv: ResolvedCv;
  style: ExportStyle;
  font: string;
  accent: string;
  tint: string;
  rule: string;
  /** Half-points. */
  size: number;
  small: number;
  /** Twips. */
  sep: number;
  smallSep: number;
  /** Where Typst breaks each paragraph's lines. */
  lines?: Lines;
}

type RunOptions = { bold?: boolean; italics?: boolean; size?: number; color?: string; smallCaps?: boolean; characterSpacing?: number; break?: number };

// Control characters (a pasted \\v or \\f) are not valid XML: Word would refuse the file.
const xmlSafe = (text: string) => text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ");

const plain = (ctx: Ctx, text: string, o: RunOptions = {}) =>
  new TextRun({
    text: xmlSafe(text),
    font: ctx.font,
    size: o.size ?? ctx.size,
    bold: o.bold,
    italics: o.italics,
    color: o.color ?? INK,
    smallCaps: o.smallCaps,
    characterSpacing: o.characterSpacing,
    break: o.break,
  });

/** What a line of Word may be wider than Typst's, in pt, without being narrowed: rounding. */
const SLACK = 0.5;

/** `text`, with `**` for bold, in the lines Typst gave it when it has them: a line break where each of its lines
 * starts, and the letters of a line drawn closer where Typst narrowed its spaces, which Word does not do (it would
 * take the last word to one more line). */
function runs(ctx: Ctx, text: string, o: RunOptions = {}, markup = true): TextRun[] {
  const parts = (t: string) => (markup ? inlineRuns(t) : [{ text: t, bold: false }]);
  const laid = ctx.lines?.lay(text);
  if (!laid) return parts(text).map((r) => plain(ctx, r.text, { ...o, bold: o.bold || r.bold }));
  const lineTexts = laid.text.replaceAll("**", "").split(/[\uE000\uE001]/);
  // Word puts the spacing after every character, spaces included: in twentieths of a point.
  const squeeze = lineTexts.map((t, i) => {
    const over = laid.over[i] + SLACK;
    return over > 0 ? -Math.ceil((over * 20) / Math.max(1, t.length + 1)) : undefined;
  });
  const out: TextRun[] = [];
  let line = 0;
  let broken = false;
  for (const r of parts(laid.text)) {
    const look = { ...o, bold: o.bold || r.bold };
    for (const part of r.text.split(/([\uE000\uE001])/)) {
      if (part === LINE || part === HYPHEN_LINE) {
        if (part === HYPHEN_LINE) out.push(plain(ctx, "-", { ...look, characterSpacing: squeeze[line] }));
        line++;
        broken = true;
      } else if (part) {
        out.push(plain(ctx, part, { ...look, characterSpacing: squeeze[line], break: broken ? 1 : undefined }));
        broken = false;
      }
    }
  }
  return out;
}

/** Text with no markup (a title, a place, a date), in Typst's lines when it has them. */
const words = (ctx: Ctx, text: string, o: RunOptions = {}) => runs(ctx, text, o, false);

function para(children: ParagraphChild[], options: Omit<IParagraphOptions, "children"> = {}): Paragraph {
  return new Paragraph({ children, ...options });
}

/** The language of the text for Word, which wants a region: `es` → `es-ES`. */
export function wordLanguage(tag: string): string {
  if (tag.includes("-")) return tag;
  return { es: "es-ES", en: "en-US", pt: "pt-BR", fr: "fr-FR", de: "de-DE", it: "it-IT" }[tag] ?? tag;
}

/** A gap of exactly `twips`: an empty paragraph whose one line is that tall. An empty paragraph with spacing
 * after would add a whole blank line before it. */
function spacer(twips: number): Paragraph {
  return new Paragraph({ children: [], spacing: { before: 0, after: 0, line: Math.max(1, Math.round(twips)), lineRule: LineRuleType.EXACT } });
}

function bulletItems(ctx: Ctx, items: Item[]): Paragraph[] {
  return items.map((it) =>
    para(runs(ctx, (it.heading ? `**${it.heading}. **` : "") + it.text), {
      numbering: { reference: "dash", level: 0 },
      alignment: AlignmentType.JUSTIFIED,
    }),
  );
}

function contactChild(ctx: Ctx, c: ResolvedContact, size: number, color?: string): ParagraphChild {
  const run = plain(ctx, c.value, { size, color });
  return c.href && c.kind !== "phone" ? new ExternalHyperlink({ link: c.href, children: [run] }) : run;
}

function photoRun(cv: ResolvedCv, widthPt: number): ImageRun | undefined {
  const photo = cv.photo;
  if (!photo || photo.type === "image/svg+xml") return undefined;
  const size = photo.size ?? { width: 4, height: 3 };
  const width = Math.round((widthPt * 96) / 72); // docx sizes images in pixels at 96 dpi
  return new ImageRun({
    type: photo.type === "image/png" ? "png" : "jpg",
    data: photo.bytes,
    transformation: { width, height: Math.round((width * size.height) / size.width) },
  });
}

/** Small caps title with a hairline under it, kept with what follows. */
function sectionTitle(ctx: Ctx, title: string): Paragraph {
  if (ctx.style === "banda")
    return para([plain(ctx, title, { bold: true, size: Math.round(ctx.size * 1.15) })], {
      spacing: { before: ctx.sep, after: ctx.smallSep },
      border: { left: { style: BorderStyle.SINGLE, size: 24, color: ctx.accent, space: 6 } },
      keepNext: true,
    });
  if (ctx.style === "minimal")
    return para([plain(ctx, title.toUpperCase(), { bold: true, size: ctx.small })], { spacing: { before: Math.round(ctx.sep * 1.3), after: ctx.smallSep }, keepNext: true });
  if (ctx.style === "claustro")
    return para([plain(ctx, title.toUpperCase(), { bold: true })], {
      spacing: { before: ctx.sep, after: ctx.smallSep },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ctx.accent, space: 1 } },
      keepNext: true,
    });
  if (ctx.style === "recto")
    return para([plain(ctx, title.toUpperCase(), { bold: true, color: ctx.accent, size: ctx.small })], {
      spacing: { before: ctx.sep, after: ctx.smallSep },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "C9CDD1", space: 2 } },
      keepNext: true,
    });
  if (ctx.style === "llano") return para([plain(ctx, title, { bold: true, color: ctx.accent, size: Math.round(ctx.size * 1.1) })], { spacing: { before: ctx.sep, after: 60 }, keepNext: true });
  return para([plain(ctx, title.toLowerCase(), { bold: true, color: ctx.accent, smallCaps: true, size: Math.round(ctx.size * 1.1) })], {
    spacing: { before: ctx.sep, after: ctx.smallSep },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: ctx.rule, space: 2 } },
    keepNext: true,
  });
}

/** An entry of Banda or Minimal: the title with the dates at the right margin, as their Typst styles have it
 * (only Legajo gives the dates a column of their own). */
function datedEntry(ctx: Ctx, e: ResolvedEntry, compact: boolean, widthTwip: number, first: boolean): Paragraph[] {
  const banda = ctx.style === "banda";
  const date = e.period ? [new TextRun({ children: [new Tab(), xmlSafe(e.period)], font: ctx.font, size: ctx.small, color: MUTED })] : [];
  const out = [
    para([...words(ctx, e.title, { bold: banda }), ...date], {
      keepNext: true,
      tabStops: [{ type: TabStopType.RIGHT, position: widthTwip }],
      spacing: { before: first ? 0 : ctx.smallSep },
    }),
  ];
  if (e.place) out.push(para(words(ctx, e.place, banda ? { color: ctx.accent } : { size: ctx.small, color: MUTED }), { keepNext: !!(e.note || e.items.length) }));
  if (e.note) out.push(para(words(ctx, e.note, { size: ctx.small, color: MUTED })));
  if (!compact) out.push(...bulletItems(ctx, e.items));
  return out;
}

function mainSection(ctx: Ctx, s: ResolvedSection, widthTwip: number): (Paragraph | Table)[] {
  const dateWidth = Math.round(2 * 10 * TWIP_PER_MM * (ctx.cv.layout.fontSize / 10));
  const rows: TableRow[] = [];
  const out: (Paragraph | Table)[] = [sectionTitle(ctx, s.title)];
  const flushRows = () => {
    if (!rows.length) return;
    out.push(
      new Table({
        layout: TableLayoutType.FIXED,
        width: { size: widthTwip, type: WidthType.DXA },
        columnWidths: [dateWidth, widthTwip - dateWidth],
        borders: TableBorders.NONE,
        rows: rows.splice(0),
      }),
    );
  };
  for (const [i, b] of s.blocks.entries()) {
    if (b.type !== "entry") {
      flushRows();
      out.push(...(b.type === "item" ? bulletItems(ctx, [b]) : [para(runs(ctx, b.text), { alignment: AlignmentType.JUSTIFIED })]));
      continue;
    }
    if (ctx.style !== "legajo") {
      out.push(...datedEntry(ctx, b.entry, s.compact, widthTwip, i === 0));
      continue;
    }
    const e = b.entry;
    const content = [
      para(words(ctx, e.title, { bold: true }), { keepNext: true }),
      ...(e.place ? [para(words(ctx, e.place, { italics: true, color: MUTED }))] : []),
      ...(e.note ? [para(words(ctx, e.note, { size: ctx.small, color: MUTED }))] : []),
      ...(s.compact ? [] : bulletItems(ctx, e.items)),
      spacer(ctx.smallSep),
    ];
    rows.push(
      new TableRow({
        // An entry is never cut between two pages: it moves whole to the next one.
        cantSplit: true,
        children: [
          new TableCell({ borders: NO_BORDERS, children: [para(words(ctx, e.period, { size: ctx.small, color: MUTED }))] }),
          new TableCell({ borders: NO_BORDERS, margins: { left: 160 }, children: content }),
        ],
      }),
    );
  }
  flushRows();
  return out;
}

function header(ctx: Ctx): Paragraph[] {
  const { cv } = ctx;
  if (ctx.style === "minimal")
    return [
      para([plain(ctx, cv.name, { color: ctx.accent, size: Math.round(ctx.size * 2.6) })], { spacing: { after: 40 } }),
      para([plain(ctx, cv.subtitle, { color: MUTED, size: Math.round(ctx.size * 1.2) })], { spacing: { after: ctx.sep } }),
    ];
  return [
    para([plain(ctx, cv.name, { smallCaps: true, size: Math.round(ctx.size * 2.3) })], {
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: ctx.accent, space: 1 } },
      spacing: { after: 60 },
    }),
    para([plain(ctx, cv.subtitle, { italics: true, color: MUTED, size: Math.round(ctx.size * 1.25) })], { spacing: { after: ctx.sep } }),
  ];
}

function summary(ctx: Ctx): Paragraph[] {
  return ctx.cv.summary ? [para(runs(ctx, ctx.cv.summary), { alignment: AlignmentType.JUSTIFIED })] : [];
}

function sideBlock(ctx: Ctx, b: ResolvedBlock): Paragraph[] {
  if (b.type === "entry") {
    const e = b.entry;
    return [
      para(words(ctx, e.title, { bold: true, size: ctx.small })),
      ...[e.place, e.period].filter(Boolean).map((v) => para(words(ctx, v, { italics: true, size: ctx.small }))),
    ];
  }
  const heading = b.type === "item" && b.heading ? `**${b.heading}. **` : "";
  return [para(runs(ctx, heading + b.text, { size: ctx.small }), { alignment: AlignmentType.JUSTIFIED })];
}

/** Room between two skill groups side by side, in twips. */
const CELL_GAP = 120;

/** A generous guess of how wide `text` is in twips, at `size` half-points, in XCharter or Noto Sans (about 0.58 em a
 * letter; small capitals about 0.72 em). */
function textWidth(text: string, size: number, caps = false): number {
  return Math.ceil(text.length * (caps ? 0.72 : 0.58) * size * 10);
}

function sidebar(ctx: Ctx, widthPt: number): (Paragraph | Table)[] {
  const { cv } = ctx;
  const out: (Paragraph | Table)[] = [];
  const photo = photoRun(cv, widthPt);
  if (photo) out.push(para([photo], { alignment: AlignmentType.CENTER, spacing: { after: 160 } }));
  const heading = (title: string) =>
    para([plain(ctx, title.toLowerCase(), { bold: true, color: ctx.accent, smallCaps: true, size: ctx.small })], { keepNext: true, spacing: { after: 40 } });
  const block = (title: string, values: ParagraphChild[][]) => {
    out.push(heading(title), ...values.map((v) => para(v)), spacer(ctx.sep));
  };
  if (cv.highlight) block(cv.highlight.title, [words(ctx, cv.highlight.text, { size: ctx.small })]);
  if (cv.contacts.length) block(cv.labels.contact, cv.contacts.map((c) => [contactChild(ctx, c, ctx.small)]));
  const inner = Math.round(widthPt * 20);
  for (const row of cv.skills) {
    // Side by side only when the groups fit: a column too narrow cuts its words in two. Each column as wide as its longest line, and what is left shared.
    const needs = row.map((g) => Math.max(textWidth(g.title, ctx.small, true), ...g.items.map((v) => textWidth(v, ctx.small))) + CELL_GAP);
    const room = inner - needs.reduce((a, b) => a + b, 0);
    if (row.length === 1 || room < 0) {
      for (const g of row) block(g.title, g.items.map((v) => [plain(ctx, v, { size: ctx.small })]));
      continue;
    }
    const widths = needs.map((n) => Math.floor(n + room / row.length));
    out.push(
      new Table({
        layout: TableLayoutType.FIXED,
        width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
        columnWidths: widths,
        borders: TableBorders.NONE,
        rows: [
          new TableRow({
            children: row.map(
              (g, i) =>
                new TableCell({
                  width: { size: widths[i], type: WidthType.DXA },
                  borders: NO_BORDERS,
                  margins: { right: CELL_GAP },
                  children: [heading(g.title), ...g.items.map((v) => para([plain(ctx, v, { size: ctx.small })]))],
                }),
            ),
          }),
        ],
      }),
      spacer(ctx.sep),
    );
  }
  for (const s of cv.sections.filter((s) => s.side)) {
    out.push(heading(s.title));
    for (const b of s.blocks) out.push(...sideBlock(ctx, b), spacer(ctx.smallSep));
    out.push(spacer(ctx.sep));
  }
  return out;
}

function twoColumns(ctx: Ctx, textWidth: number): (Paragraph | Table)[] {
  const { layout } = ctx.cv;
  const gutter = Math.round(6 * TWIP_PER_MM);
  const side = Math.round((textWidth * layout.sidebarWidth) / 100);
  const main = textWidth - side - gutter;
  const pad = 200;
  const left = layout.sidebar === "left";
  // The whole CV is one row. Word, and LibreOffice after it, keep a row with what follows when the first
  // paragraph of a cell is kept with the next one (a title is): the row would not start on the first page.
  // Each cell starts with a paragraph that is not.
  const sideCell = new TableCell({
    width: { size: side, type: WidthType.DXA },
    borders: NO_BORDERS,
    shading: { type: ShadingType.CLEAR, color: "auto", fill: ctx.tint },
    margins: { top: pad, bottom: pad, left: pad, right: pad },
    children: [spacer(1), ...sidebar(ctx, (side - 2 * pad) / 20)],
  });
  const gap = new TableCell({ width: { size: gutter, type: WidthType.DXA }, borders: NO_BORDERS, children: [spacer(1)] });
  const mainCell = new TableCell({
    width: { size: main, type: WidthType.DXA },
    borders: NO_BORDERS,
    verticalAlign: VerticalAlign.TOP,
    margins: { left: 0, right: 0 },
    children: [spacer(1), ...summary(ctx), ...ctx.cv.sections.filter((s) => !s.side).flatMap((s) => mainSection(ctx, s, main))],
  });
  return [
    ...header(ctx),
    new Table({
      layout: TableLayoutType.FIXED,
      width: { size: textWidth, type: WidthType.DXA },
      columnWidths: left ? [side, gutter, main] : [main, gutter, side],
      borders: TableBorders.NONE,
      rows: [new TableRow({ children: left ? [sideCell, gap, mainCell] : [mainCell, gap, sideCell] })],
    }),
  ];
}

/** Banda's header: the name and the subtitle in white on the accent colour, the photo beside them. */
function band(ctx: Ctx, textWidth: number): Table {
  const { cv } = ctx;
  const photo = photoRun(cv, ctx.size * 4.25);
  const shading = { type: ShadingType.CLEAR, color: "auto", fill: ctx.accent };
  const margins = { top: 160, bottom: 160, left: 200, right: 200 };
  const names = [
    para([plain(ctx, cv.name, { bold: true, color: "FFFFFF", size: Math.round(ctx.size * 2.3) })], { spacing: { after: 40 } }),
    para([plain(ctx, cv.subtitle, { color: "FFFFFF", size: Math.round(ctx.size * 1.25) })]),
  ];
  const cells = [new TableCell({ borders: NO_BORDERS, shading, margins, verticalAlign: VerticalAlign.CENTER, children: names })];
  if (photo) cells.push(new TableCell({ borders: NO_BORDERS, shading, margins, verticalAlign: VerticalAlign.CENTER, children: [para([photo], { alignment: AlignmentType.RIGHT })] }));
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: textWidth, type: WidthType.DXA },
    columnWidths: photo ? [textWidth - 2000, 2000] : [textWidth],
    borders: TableBorders.NONE,
    rows: [new TableRow({ children: cells })],
  });
}

function oneColumn(ctx: Ctx, textWidth: number): (Paragraph | Table)[] {
  const { cv } = ctx;
  const dot = ctx.style === "banda" ? plain(ctx, "  •  ", { size: ctx.small, color: ctx.accent }) : plain(ctx, "  ·  ", { size: ctx.small, color: MUTED });
  const contacts: ParagraphChild[] = cv.contacts.flatMap((c, i) => [...(i ? [dot] : []), contactChild(ctx, c, ctx.small)]);
  const contactLine = contacts.length ? [para(contacts, { spacing: { before: ctx.style === "banda" ? ctx.smallSep : 0, after: ctx.sep } })] : [];
  const head = [...header(ctx), ...contactLine];
  const photo = photoRun(cv, ctx.size * 4.25);
  const top: (Paragraph | Table)[] = ctx.style === "banda" ? [band(ctx, textWidth), ...contactLine] : photo
    ? [
        new Table({
          layout: TableLayoutType.FIXED,
          width: { size: textWidth, type: WidthType.DXA },
          columnWidths: [textWidth - 2000, 2000],
          borders: TableBorders.NONE,
          rows: [
            new TableRow({
              children: [
                new TableCell({ borders: NO_BORDERS, verticalAlign: VerticalAlign.BOTTOM, children: head }),
                new TableCell({ borders: NO_BORDERS, children: [para([photo], { alignment: AlignmentType.RIGHT })] }),
              ],
            }),
          ],
        }),
      ]
    : head;
  const highlight = cv.highlight
    ? [para([plain(ctx, `${cv.highlight.title}  `, { bold: true, color: ctx.accent }), plain(ctx, cv.highlight.text)], { spacing: { after: ctx.smallSep } })]
    : [];
  const banda = ctx.style === "banda";
  const lines = cv.skills.flat().map((g) => {
    const title =
      ctx.style === "legajo"
        ? plain(ctx, `${g.title.toLowerCase()}: `, { smallCaps: true, color: MUTED })
        : plain(ctx, `${g.title}: `, banda ? { bold: true, size: ctx.small } : { color: MUTED });
    return para([title, plain(ctx, g.items.join(banda ? " · " : ", "), banda ? { size: ctx.small } : {})]);
  });
  // Banda has its skills under the contacts, without a title, as its Typst style does.
  const skills = lines.length && !banda ? [sectionTitle(ctx, cv.labels.skills), ...lines] : [];
  const above = banda && lines.length ? [...lines, spacer(ctx.smallSep)] : [];
  return [...top, ...highlight, ...above, ...summary(ctx), ...skills, ...cv.sections.flatMap((s) => mainSection(ctx, s, textWidth))];
}

/** Claustro, Recto and Llano, made for applicant tracking systems: paragraphs only (no tables),
 * the contacts in the body on one line, the dates on a tab stop at the right margin. */
function atsColumn(ctx: Ctx, textWidth: number, style: AtsStyle): Paragraph[] {
  const { cv } = ctx;
  const align = style === "claustro" ? { alignment: AlignmentType.CENTER } : {};
  const tabStops = [{ type: TabStopType.RIGHT, position: textWidth }];
  const dates = (period: string): ParagraphChild[] =>
    period ? [new TextRun({ children: [new Tab(), xmlSafe(period)], font: ctx.font, size: style === "claustro" ? ctx.size : ctx.small, color: style === "claustro" ? INK : MUTED })] : [];
  const out: Paragraph[] = [];
  const photo = photoRun(cv, ctx.size * 3.5);
  if (photo) out.push(para([photo], { alignment: style === "claustro" ? AlignmentType.CENTER : AlignmentType.RIGHT, spacing: { after: 80 } }));
  const nameSize = Math.round(ctx.size * (style === "llano" ? 2 : 2.2));
  out.push(para([plain(ctx, cv.name, { bold: style !== "llano", color: style === "llano" ? ctx.accent : INK, size: nameSize })], { ...align, spacing: { after: 40 } }));
  if (cv.subtitle) {
    const look = { claustro: { italics: true }, recto: { color: ctx.accent }, llano: {} }[style];
    out.push(para([plain(ctx, cv.subtitle, { ...look, size: Math.round(ctx.size * 1.15) })], { ...align, spacing: { after: 40 } }));
  }
  if (cv.contacts.length) {
    const color = style === "claustro" ? INK : MUTED;
    const sep = () => plain(ctx, style === "recto" ? "  |  " : "  ·  ", { size: ctx.small, color });
    const children = cv.contacts.flatMap((c, i) => [...(i ? [sep()] : []), contactChild(ctx, c, ctx.small, color)]);
    out.push(para(children, { ...align, spacing: { after: ctx.smallSep } }));
  }
  if (cv.highlight) {
    const title = plain(ctx, `${cv.highlight.title}: `, { bold: true, color: style === "recto" ? ctx.accent : INK });
    out.push(para([title, ...words(ctx, cv.highlight.text)], { spacing: { before: ctx.smallSep } }));
  }
  if (cv.summary) out.push(sectionTitle(ctx, cv.labels.profile), para(runs(ctx, cv.summary)));
  if (cv.skills.length) {
    out.push(sectionTitle(ctx, cv.labels.skills), ...cv.skills.flat().map((g) => para([plain(ctx, `${g.title}: `, { bold: true }), plain(ctx, g.items.join(", "))])));
  }
  for (const s of cv.sections) {
    out.push(sectionTitle(ctx, s.title));
    for (const b of s.blocks) {
      if (b.type === "item") out.push(...bulletItems(ctx, [b]));
      else if (b.type === "paragraph") out.push(para(runs(ctx, b.text)));
      else {
        const e = b.entry;
        const first = { keepNext: true, tabStops, spacing: { before: ctx.smallSep } };
        // Claustro: the institution above, the position and the dates below. Recto: the position
        // and the dates, the institution below. Llano: all on one line.
        if (style === "claustro" && e.place)
          out.push(para([plain(ctx, e.place, { bold: true })], first), para([plain(ctx, e.title, { italics: true }), ...dates(e.period)], { keepNext: true, tabStops }));
        else if (style === "llano") out.push(para([plain(ctx, e.title, { bold: true }), ...(e.place ? [plain(ctx, `, ${e.place}`)] : []), ...dates(e.period)], first));
        else {
          out.push(para([...words(ctx, e.title, { bold: true }), ...dates(e.period)], first));
          if (e.place) out.push(para(words(ctx, e.place, { color: MUTED }), { keepNext: true }));
        }
        if (e.note) out.push(para(words(ctx, e.note, { size: ctx.small, color: MUTED })));
        if (!s.compact) out.push(...bulletItems(ctx, e.items));
      }
    }
  }
  return out;
}

/** The `leading` of each Typst style (styles/*.typ). */
const LEADING: Record<ExportStyle, number> = { legajo: 0.55, banda: 0.6, minimal: 0.65, claustro: 0.55, recto: 0.6, llano: 0.55 };

/** Word's line spacing for the distance between baselines that Typst has: the cap height of the font (XCharter
 * 0.671 em, Noto Sans 0.714 em), where Typst's lines start, plus the style's leading, as a share of the font's single
 * line (1.199 em and 1.519 em: the ascent and descent of the embedded fonts, the one height every program reads in
 * them). In 240ths, as Word counts it. */
export function lineSpacing(style: ExportStyle, sans: boolean): number {
  return Math.round((240 * ((sans ? 0.714 : 0.671) + LEADING[style])) / (sans ? 1.519 : 1.199));
}

export async function renderDocx(cv: ResolvedCv, style: ExportStyle = "legajo", fonts?: WordFonts, lines?: Lines): Promise<Uint8Array> {
  const l = cv.layout;
  const density = { compact: 0.7, normal: 1, relaxed: 1.3 }[l.density];
  const accentHex = l.accent ?? DEFAULT_ACCENT;
  const ctx: Ctx = {
    cv,
    style,
    font: l.font === "Noto Sans" ? "Noto Sans" : "XCharter",
    accent: accentHex.slice(1).toUpperCase(),
    tint: lighten(accentHex, 0.92),
    rule: lighten(accentHex, 0.5),
    size: Math.round(l.fontSize * 2),
    small: Math.round(l.fontSize * 1.76),
    sep: Math.round(l.fontSize * 20 * density),
    smallSep: Math.round(l.fontSize * 10 * density),
    lines,
  };
  const paper = PAPER[l.paper];
  const m = l.margins;
  const textWidth = Math.round((paper.width - m.left - m.right) * TWIP_PER_MM);
  const doc = new Document({
    creator: "Foja",
    fonts: embedded(ctx.font, fonts),
    title: `${cv.name} — ${cv.subtitle}`,
    // Justified text breaks words as Typst does, by the rules of the CV's language.
    hyphenation: { autoHyphenation: true },
    styles: {
      default: {
        document: {
          // Kerning from 1 pt up, as Typst kerns all its text.
          run: { font: ctx.font, size: ctx.size, color: INK, kern: 2, language: { value: wordLanguage(cv.language) } },
          paragraph: { spacing: { before: 0, after: 0, line: lineSpacing(style, l.font === "Noto Sans") } },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "dash",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: style === "banda" || style === "claustro" || style === "recto" ? "•" : "–",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 240, hanging: 200 } }, run: { color: style === "minimal" || style === "llano" ? MUTED : style === "claustro" ? INK : ctx.accent } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: Math.round(paper.width * TWIP_PER_MM), height: Math.round(paper.height * TWIP_PER_MM) },
            margin: {
              top: Math.round(m.top * TWIP_PER_MM),
              bottom: Math.round(m.bottom * TWIP_PER_MM),
              left: Math.round(m.left * TWIP_PER_MM),
              right: Math.round(m.right * TWIP_PER_MM),
            },
          },
        },
        children:
          l.columns === 2 && style === "legajo" ? twoColumns(ctx, textWidth) : isAtsStyle(style) ? atsColumn(ctx, textWidth, style) : oneColumn(ctx, textWidth),
      },
    ],
  });
  return new Uint8Array(await Packer.toArrayBuffer(doc));
}
