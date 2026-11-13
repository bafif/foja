// Word export with the `docx` library, in the look of the profile's built-in style (Legajo for a
// style of the user's own). Legajo: the name in small caps over a rule, the sidebar as a shaded
// cell, small-caps section titles, and every entry as a row with its dates in a column of their
// own; one or two columns following the layout options. Banda: the name in a band of the accent
// colour, titles marked with a bar of it. Minimal: the name in the accent colour, plain capitals
// for the titles. Both are one column. Claustro, Recto and Llano, made for applicant tracking
// systems, are paragraphs only (no tables), the contacts in the body, the dates on a right tab stop.
// Every style takes Typst's spacing (flow.ts) in lines of an exact height, to come out as long as the PDF.
// The fonts are Typst's, XCharter or Noto Sans, embedded in the file in their four faces when the caller passes them
// (packages/template/word-fonts, made by scripts/word-fonts.py).

import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeightRule,
  HorizontalPositionAlign,
  HorizontalPositionRelativeFrom,
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
  TextWrappingType,
  VerticalAlign,
  VerticalPositionRelativeFrom,
  WidthType,
  type IParagraphOptions,
  type ParagraphChild,
} from "docx";
import { HYPHEN_LINE, LINE, type Lines } from "../lines.ts";
import { DEFAULT_ACCENT, inlineRuns } from "../project.ts";
import type { ResolvedContact, ResolvedCv, ResolvedEntry, ResolvedSection } from "../resolve.ts";
import type { Item } from "../types.ts";
import { BLOCK, Flow, legajoLook, legajoRule, look, PAR, photoHeight, titleLook, type LegajoLook, type Look, type OneColumnStyle } from "./flow.ts";
import type { AtsStyle, ExportStyle } from "./style.ts";

const TWIP_PER_MM = 1440 / 25.4;
const MM = 72 / 25.4; // pt per millimetre
const PAPER = { a4: { width: 210, height: 297 }, "us-letter": { width: 215.9, height: 279.4 } };
const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE };
/** No margins in a cell: LibreOffice gives cells that set none margins of its own. */
const NO_MARGINS = { top: 0, bottom: 0, left: 0, right: 0 };
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
  /** Where Typst breaks each paragraph's lines. */
  lines?: Lines;
  /** How many lines Typst gave the last text laid out in its lines, if it had them. */
  laid?: number;
}

type RunOptions = { bold?: boolean; italics?: boolean; /** Half-points. */ size?: number; color?: string; smallCaps?: boolean; characterSpacing?: number; break?: number };

// Control characters (a pasted \\v or \\f) are not valid XML: Word would refuse the file.
const xmlSafe = (text: string) => text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ");

/** A run of `text`. Word sizes go by half-points: a size between two (Typst's 8.8 pt) takes the nearest one, its
 * letters drawn closer or apart by what that adds to an average letter, half an em, so that its lines are as long. */
function plain(ctx: Ctx, text: string, o: RunOptions = {}): TextRun {
  const size = o.size ?? ctx.size;
  const whole = Math.round(size);
  const spacing = (o.characterSpacing ?? 0) + Math.round((size - whole) * 5);
  return new TextRun({
    text: xmlSafe(text),
    font: ctx.font,
    size: whole,
    bold: o.bold,
    italics: o.italics,
    color: o.color ?? INK,
    smallCaps: o.smallCaps,
    characterSpacing: spacing || undefined,
    break: o.break,
  });
}

/** How much narrower than Typst's a line must be for Word to keep it whole, in pt: LibreOffice takes a line of 60 to
 * 70 letters to one more line when it is a point short of its width (measured). Drawing the letters of a justified
 * line closer does not show: its spaces grow by as much. */
const SLACK = 3;

/** `text`, with `**` for bold, in the lines Typst gave it when it has them: a line break where each of its lines
 * starts, and the letters of a line drawn closer where Typst narrowed its spaces, which Word does not do (it would
 * take the last word to one more line). */
function runs(ctx: Ctx, text: string, o: RunOptions = {}, markup = true): TextRun[] {
  const parts = (t: string) => (markup ? inlineRuns(t) : [{ text: t, bold: false }]);
  const laid = ctx.lines?.lay(text);
  ctx.laid = laid?.over.length;
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

function contactChild(ctx: Ctx, c: ResolvedContact, size: number, color?: string): ParagraphChild {
  const run = plain(ctx, c.value, { size, color });
  return c.href && c.kind !== "phone" ? new ExternalHyperlink({ link: c.href, children: [run] }) : run;
}

/** The photo `widthPt` wide; with `top`, floating that many pt below the top margin at the right margin, where the text
 * does not go round it, as beside Typst's grid. */
function photoRun(cv: ResolvedCv, widthPt: number, top?: number): ImageRun | undefined {
  const photo = cv.photo;
  if (!photo || photo.type === "image/svg+xml") return undefined;
  const size = photo.size ?? { width: 4, height: 3 };
  const width = Math.round((widthPt * 96) / 72); // docx sizes images in pixels at 96 dpi
  return new ImageRun({
    type: photo.type === "image/png" ? "png" : "jpg",
    data: photo.bytes,
    transformation: { width, height: Math.round((width * size.height) / size.width) },
    floating:
      top === undefined
        ? undefined
        : {
            horizontalPosition: { relative: HorizontalPositionRelativeFrom.MARGIN, align: HorizontalPositionAlign.RIGHT },
            verticalPosition: { relative: VerticalPositionRelativeFrom.MARGIN, offset: Math.round(top * 12700) },
            wrap: { type: TextWrappingType.NONE },
            allowOverlap: true,
          },
  });
}


/** Room between two skill groups side by side, in twips. */
const CELL_GAP = 120;

/** A generous guess of how wide `text` is in twips, at `size` half-points, in XCharter or Noto Sans (about 0.58 em a
 * letter; small capitals about 0.72 em). */
function textWidth(text: string, size: number, caps = false): number {
  return Math.ceil(text.length * (caps ? 0.72 : 0.58) * size * 10);
}


// ---------------------------------------------------------------- Legajo, with Typst's spacing

/** Where the baseline of an exact line is, as a share of its height from the top: LibreOffice puts four fifths of the
 * line above it, whatever the font (measured; in XCharter that is also the ascent's share of the font's height). */
const BASELINE = 0.8;

/** What a column needs of a style's measures (LegajoLook, Look), in pt. */
type Measures = { S: number; d: number; cap: number; lead: number; small: number };

/** A column of a style, which takes Typst's spacing (flow.ts) and remembers the height of its last line. Word starts a
 * line where the one before ends; in lines of an exact height, the cap height plus the leading, the baselines stand as
 * far apart as Typst's. Word has no negative spacing: what it cannot take away before a paragraph comes off the
 * paragraph's lines, so that the paragraph still ends where Typst's does. */
class Column {
  readonly flow = new Flow();
  readonly k: Measures;
  /** BASELINE. */
  readonly a: number;
  private prev?: number;
  /** What the last paragraph takes below its last line, in pt: a border. */
  private extra = 0;
  /** How tall the column is so far, in pt. */
  height = 0;

  /** `prev`: the height of the line above the column, if its first line is not placed by what is around it. */
  constructor(k: Measures, a: number, prev?: number) {
    this.k = k;
    this.a = a;
    this.prev = prev;
  }

  /** The spacing of a paragraph of `n` lines of text `size` pt, `lead` pt apart (plus the cap height). */
  next(size: number, n = 1, lead = this.k.lead, gap = this.flow.take()) {
    const pitch = this.k.cap * size + lead;
    const count = Math.max(1, n);
    if (this.prev === undefined) {
      this.prev = pitch;
      this.height += count * pitch;
      return { before: 0, after: 0, line: Math.round(pitch * 20), lineRule: LineRuleType.EXACT };
    }
    // From where the paragraph's first line starts down to its last baseline, as far as Typst has it; that much
    // spacing before lines of the full height, or none before lines shorter.
    const lines = count - 1 + this.a;
    const reach = gap + this.k.cap * size + (count - 1) * pitch - (1 - this.a) * this.prev - this.extra;
    const before = reach - lines * pitch;
    const line = before < 0 ? reach / lines : pitch;
    this.prev = line;
    this.extra = 0;
    this.height += Math.max(0, before) + count * line;
    return { before: Math.max(0, Math.round(before * 20)), after: 0, line: Math.round(line * 20), lineRule: LineRuleType.EXACT };
  }

  /** The spacing of a paragraph that goes on a line of Typst's paragraph above it, `lead` pt below. */
  line(size: number, n = 1, lead = this.k.lead) {
    return this.next(size, n, lead, lead);
  }

  /** The spacing of the column's first line, its baseline `y` pt below the top. */
  start(y: number) {
    this.flow.take();
    this.prev = y / this.a;
    this.height = this.prev;
    return { before: 0, after: 0, line: Math.round(this.prev * 20), lineRule: LineRuleType.EXACT };
  }

  /** The last paragraph takes `pt` more below its last line. */
  drop(pt: number): void {
    this.extra += pt;
    this.height += pt;
  }

  /** The height of the column's last line. */
  get last(): number | undefined {
    return this.prev;
  }

  /** Goes on below a table whose last line is `height` pt, whatever spacing was left. */
  below(height: number): void {
    this.flow.take();
    this.prev = height;
    this.extra = 0;
  }
}

/** How many lines `text` takes, `size` pt in a column `width` pt wide: Typst's count, or a guess. */
const lineCount = (ctx: Ctx, text: string, size: number, width: number) => ctx.laid ?? Math.max(1, Math.ceil(textWidth(text, size * 2) / (width * 20)));

/** A table of Legajo's two columns, the period's and the rest's, as wide as `width` twips, with no margins of its own. */
function legajoTable(ctx: Ctx, rows: TableRow[], width: number): Table {
  const dateWidth = Math.round(2 * 10 * TWIP_PER_MM * (ctx.cv.layout.fontSize / 10));
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: width, type: WidthType.DXA },
    columnWidths: [dateWidth, width - dateWidth],
    borders: TableBorders.NONE,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    rows,
  });
}

/** A row of a Legajo table: the period (or a skill's name) and what goes beside it, both as far below what comes before
 * as Typst's grid row. The column beside it is 0.8em to the right. */
function legajoRow(ctx: Ctx, col: Column, left: (c: Column) => Paragraph[], right: (c: Column) => Paragraph[]): TableRow {
  const gap = col.flow.take();
  const leftCol = new Column(col.k, col.a, col.last);
  const rightCol = new Column(col.k, col.a, col.last);
  leftCol.flow.take();
  rightCol.flow.take();
  leftCol.flow.v(gap);
  rightCol.flow.v(gap);
  const row = new TableRow({
    // An entry is never cut between two pages: it moves whole to the next one.
    cantSplit: true,
    children: [
      new TableCell({ borders: NO_BORDERS, children: left(leftCol) }),
      new TableCell({ borders: NO_BORDERS, margins: { left: Math.round(0.8 * col.k.S * 20) }, children: right(rightCol) }),
    ],
  });
  // The next line comes below the column beside the period, usually the longer.
  col.below(rightCol.last ?? col.k.cap * col.k.S + col.k.lead);
  return row;
}

/** Items as Typst's list: 0.4em between them, the dash and 0.5em before each one's text. */
function legajoItems(ctx: Ctx, col: Column, items: Item[], width: number): Paragraph[] {
  const { S, d } = col.k;
  return items.map((it) => {
    col.flow.space(0.4 * d * S, BLOCK);
    const text = (it.heading ? `**${it.heading}. **` : "") + it.text;
    const children = runs(ctx, text);
    return para(children, {
      numbering: { reference: "dash", level: 0 },
      alignment: AlignmentType.JUSTIFIED,
      spacing: col.next(S, lineCount(ctx, text, S, width - S)),
    });
  });
}

/** A paragraph of `text` in a column of Legajo, after the spacing of a paragraph. */
function legajoPar(ctx: Ctx, col: Column, children: ParagraphChild[], text: string, width: number, options: Omit<IParagraphOptions, "children"> = {}): Paragraph {
  const { S, d } = col.k;
  col.flow.space(0.55 * d * S, PAR);
  const out = para(children, { ...options, spacing: col.next(S, lineCount(ctx, text, S, width)) });
  col.flow.space(0.55 * d * S, PAR);
  return out;
}

/** A section title of Legajo over its rule, kept with what follows. The rule takes a point and a half below the
 * title's line, which the title gives up above it. */
function legajoTitle(ctx: Ctx, col: Column, title: string): Paragraph {
  const { S, d } = col.k;
  col.flow.space(1.15 * d * S, BLOCK);
  // Not the first paragraph of a cell, which Word would keep with the row after the one of the whole CV.
  const keepNext = col.last !== undefined;
  const spacing = col.next(S);
  const out = para([plain(ctx, title.toLowerCase(), { bold: true, color: ctx.accent, smallCaps: true, characterSpacing: Math.round(0.08 * S * 20) })], {
    spacing: { ...spacing, before: Math.max(0, spacing.before - 30) },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: ctx.rule, space: 1 } },
    keepNext,
  });
  col.flow.space(0.6 * d * S, BLOCK);
  return out;
}

/** A section of Legajo's main column, `width` twips wide. */
function legajoSection(ctx: Ctx, col: Column, s: ResolvedSection, width: number): (Paragraph | Table)[] {
  const { S, d, small } = col.k;
  const pt = width / 20;
  const dateWidth = 2 * 28.35 * (S / 10);
  const inner = pt - dateWidth - 0.8 * S;
  const out: (Paragraph | Table)[] = [legajoTitle(ctx, col, s.title)];
  const rows: TableRow[] = [];
  const flush = () => rows.length && out.push(legajoTable(ctx, rows.splice(0), width));
  for (const b of s.blocks) {
    if (b.type === "item") {
      flush();
      col.flow.space(0.5 * d * S, BLOCK);
      out.push(...legajoItems(ctx, col, [b], pt));
      col.flow.space(0, BLOCK);
      continue;
    }
    if (b.type === "paragraph") {
      flush();
      out.push(legajoPar(ctx, col, runs(ctx, b.text), b.text, pt, { alignment: AlignmentType.JUSTIFIED }));
      continue;
    }
    const e = b.entry;
    col.flow.space(0.75 * d * S, BLOCK);
    rows.push(
      legajoRow(
        ctx,
        col,
        (c) => {
          const period = words(ctx, e.period, { size: small * 2, color: MUTED });
          return [para(period, { spacing: c.next(small, lineCount(ctx, e.period, small, dateWidth)) })];
        },
        (c) => {
          // The title and the place are one paragraph in Typst, a line break between them.
          const title = words(ctx, e.title, { bold: true });
          let n = lineCount(ctx, e.title, S, inner);
          const place = e.place ? words(ctx, e.place, { italics: true, color: MUTED }) : [];
          if (e.place) n += lineCount(ctx, e.place, S, inner);
          const cell = [para([...title, ...(e.place ? [new TextRun({ break: 1 }), ...place] : [])], { keepNext: true, spacing: c.next(S, n) })];
          c.flow.space(0.55 * d * S, PAR);
          if (e.note) {
            const note = words(ctx, e.note, { size: small * 2, color: MUTED });
            cell.push(para(note, { spacing: c.next(small, lineCount(ctx, e.note, small, inner)) }));
            c.flow.space(0.55 * d * S, PAR);
          }
          if (!s.compact) cell.push(...legajoItems(ctx, c, e.items, inner));
          return cell;
        },
      ),
    );
    col.flow.space(0, BLOCK);
  }
  flush();
  return out;
}

/** Legajo's name over its rule and the subtitle, where Typst has them (legajoTop), and `after` pt below it. Each line
 * as tall as puts its baseline the cap height below its top. The rule is the name's bottom border, as far below the
 * line as Word's whole points let it be. */
function legajoHeader(ctx: Ctx, k: LegajoLook, a: number, after = 0): Paragraph[] {
  const { S, d, cap } = k;
  const { cv } = ctx;
  const name = (cap * 2.1 * S) / a;
  const rule = Math.max(0, Math.round(legajoRule(k) - 0.8 - (1 - a) * name));
  const exact = (height: number, before = 0, below = 0) => ({
    before: Math.max(0, Math.round(before * 20)),
    after: Math.max(0, Math.round(below * 20)),
    line: Math.round(height * 20),
    lineRule: LineRuleType.EXACT,
  });
  return [
    para([plain(ctx, cv.name, { smallCaps: true, size: S * 4.2, characterSpacing: Math.round(0.04 * 2.1 * S * 20) })], {
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: ctx.accent, space: rule } },
      spacing: exact(name),
    }),
    para([plain(ctx, cv.subtitle, { italics: true, color: MUTED, size: S * 2.5 })], {
      spacing: exact((cap * 1.25 * S) / a, legajoRule(k) + 0.1 * S + 0.55 * d * 1.25 * S - (1 - a) * name - rule - 1.5, after),
    }),
  ];
}

/** Legajo's sidebar, `widthPt` wide inside its margins: the small size with a leading of 0.5em, a block of 1.1em
 * below every part, 0.25em and the paragraph spacing under its title, 0.6em between the entries of a section. */
function legajoSidebar(ctx: Ctx, k: LegajoLook, a: number, widthPt: number): (Paragraph | Table)[] {
  const { cv } = ctx;
  const { d, small } = k;
  const lead = 0.5 * small;
  const heading = 0.836 * k.S;
  // Typst's inset of 12 pt above: an empty line, as tall as puts the first title's baseline its cap height below it.
  const out: (Paragraph | Table)[] = [spacer(Math.max(1, (12 + k.cap * heading - a * (k.cap * heading + lead)) * 20))];
  const col = new Column(k, a);
  const photo = photoRun(cv, widthPt);
  if (photo) out.push(para([photo], { alignment: AlignmentType.CENTER, spacing: { after: 120 } }));
  const title = (text: string) => {
    // Not the first paragraph of the cell, which Word would keep with the row after the one of the whole CV.
    const p = para([plain(ctx, text.toLowerCase(), { bold: true, color: ctx.accent, smallCaps: true, size: heading * 2, characterSpacing: Math.round(0.08 * heading * 20) })], {
      keepNext: true,
      spacing: col.next(heading, 1, lead),
    });
    col.flow.space(0.55 * d * small, PAR).v(0.25 * small);
    return p;
  };
  const line = (children: ParagraphChild[], text: string, options: Omit<IParagraphOptions, "children"> = {}, more = false) =>
    para(children, { ...options, spacing: more ? col.line(small, 1, lead) : col.next(small, lineCount(ctx, text, small, widthPt), lead) });
  // The values of a block are the lines of one paragraph.
  const block = (text: string, values: [ParagraphChild[], string][]) => {
    out.push(title(text), ...values.map(([v, t], i) => line(v, t, {}, i > 0)));
    col.flow.space(1.1 * d * small, BLOCK);
  };
  if (cv.highlight) block(cv.highlight.title, [[words(ctx, cv.highlight.text, { size: small * 2 }), cv.highlight.text]]);
  if (cv.contacts.length) block(cv.labels.contact, cv.contacts.map((c) => [[contactChild(ctx, c, small * 2)], c.value]));
  const inner = Math.round(widthPt * 20);
  for (const row of cv.skills) {
    // Side by side only when the groups fit: a column too narrow cuts its words in two. Each column as wide as its longest line, and what is left shared.
    const needs = row.map((g) => Math.max(textWidth(g.title, small * 2, true), ...g.items.map((v) => textWidth(v, small * 2))) + CELL_GAP);
    const room = inner - needs.reduce((a, b) => a + b, 0);
    if (row.length === 1 || room < 0) {
      for (const g of row) block(g.title, g.items.map((v) => [[plain(ctx, v, { size: small * 2 })], v]));
      continue;
    }
    const widths = needs.map((n) => Math.floor(n + room / row.length));
    const gap = col.flow.take();
    const cells = row.map((g, i) => {
      const c = new Column(k, a, col.last);
      c.flow.take();
      c.flow.v(gap);
      const children = [
        para([plain(ctx, g.title.toLowerCase(), { bold: true, color: ctx.accent, smallCaps: true, size: heading * 2 })], { keepNext: true, spacing: c.next(heading, 1, lead) }),
      ];
      c.flow.space(0.55 * d * small, PAR).v(0.25 * small);
      children.push(...g.items.map((v, j) => para([plain(ctx, v, { size: small * 2 })], { spacing: j ? c.line(small, 1, lead) : c.next(small, 1, lead) })));
      return new TableCell({ width: { size: widths[i], type: WidthType.DXA }, borders: NO_BORDERS, margins: { right: CELL_GAP }, children });
    });
    out.push(
      new Table({
        layout: TableLayoutType.FIXED,
        width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
        columnWidths: widths,
        borders: TableBorders.NONE,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        rows: [new TableRow({ children: cells })],
      }),
    );
    col.below(k.cap * small + lead);
    col.flow.space(1.1 * d * small, BLOCK);
  }
  for (const s of cv.sections.filter((s) => s.side)) {
    out.push(title(s.title));
    for (const b of s.blocks) {
      if (b.type === "entry") {
        const e = b.entry;
        out.push(line(words(ctx, e.title, { bold: true, size: small * 2 }), e.title));
        for (const v of [e.place, e.period].filter(Boolean)) out.push(line(words(ctx, v, { italics: true, size: small * 2 }), v, {}, true));
      } else {
        const text = (b.type === "item" && b.heading ? `**${b.heading}. **` : "") + b.text;
        out.push(line(runs(ctx, text, { size: small * 2 }), text, { alignment: AlignmentType.JUSTIFIED }));
      }
      col.flow.space(0.6 * small, BLOCK);
    }
    col.flow.space(1.1 * d * small, BLOCK);
  }
  return out;
}

/** Legajo in two columns: the header across the page, then one row with the sidebar and the main column. */
function twoColumns(ctx: Ctx, textWidth: number): (Paragraph | Table)[] {
  const { layout } = ctx.cv;
  const k = legajoLook(layout);
  const a = BASELINE;
  const gutter = Math.round(6 * TWIP_PER_MM);
  const side = Math.round((textWidth * layout.sidebarWidth) / 100);
  const main = textWidth - side - gutter;
  const left = layout.sidebar === "left";
  // The main column's first baseline where Typst has it: 1em and the subtitle's paragraph spacing below the subtitle,
  // and the cap height into the column.
  const { S, d } = k;
  const paragraphs = legajoHeader(ctx, k, a, 0.55 * d * 1.25 * S + d * S + k.cap * S - a * (k.cap * S + k.lead) - ((1 - a) * k.cap * 1.25 * S) / a);
  // The whole CV is one row. Word, and LibreOffice after it, keep a row with what follows when the first
  // paragraph of a cell is kept with the next one (a title is): the row would not start on the first page.
  // The first paragraph of each cell is not.
  const sideCell = new TableCell({
    width: { size: side, type: WidthType.DXA },
    borders: NO_BORDERS,
    shading: { type: ShadingType.CLEAR, color: "auto", fill: ctx.tint },
    // No margins above and below: LibreOffice would give every cell of the row the first one's. The sidebar starts
    // and ends with empty lines instead.
    margins: { top: 0, bottom: 0, left: 200, right: 200 },
    children: [...legajoSidebar(ctx, k, a, (side - 400) / 20), spacer(240)],
  });
  const gap = new TableCell({ width: { size: gutter, type: WidthType.DXA }, borders: NO_BORDERS, children: [spacer(1)] });
  const col = new Column(k, a);
  const body: (Paragraph | Table)[] = [];
  if (ctx.cv.summary) body.push(legajoPar(ctx, col, runs(ctx, ctx.cv.summary), ctx.cv.summary, main / 20, { alignment: AlignmentType.JUSTIFIED }));
  for (const s of ctx.cv.sections.filter((s) => !s.side)) body.push(...legajoSection(ctx, col, s, main));
  const mainCell = new TableCell({
    width: { size: main, type: WidthType.DXA },
    borders: NO_BORDERS,
    verticalAlign: VerticalAlign.TOP,
    margins: { left: 0, right: 0, top: 0, bottom: 0 },
    children: body.length ? body : [spacer(1)],
  });
  return [
    ...paragraphs,
    new Table({
      layout: TableLayoutType.FIXED,
      width: { size: textWidth, type: WidthType.DXA },
      columnWidths: left ? [side, gutter, main] : [main, gutter, side],
      borders: TableBorders.NONE,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      rows: [new TableRow({ children: left ? [sideCell, gap, mainCell] : [mainCell, gap, sideCell] })],
    }),
  ];
}


/** Legajo in one column: the header with the contacts below it and the photo beside it, the highlight, the summary,
 * the skills as rows of a table, then the sections. */
function legajoOneColumn(ctx: Ctx, textWidth: number): (Paragraph | Table)[] {
  const { cv } = ctx;
  const k = legajoLook(cv.layout);
  const a = BASELINE;
  const { S, d, cap, small } = k;
  const head = legajoHeader(ctx, k, a);
  const subtitle = (cap * 1.25 * S) / a;
  const contactLine = (cap * small) / a;
  const dot = plain(ctx, "  ·  ", { size: small * 2, color: MUTED });
  const contacts: ParagraphChild[] = cv.contacts.flatMap((c, i) => [...(i ? [dot] : []), contactChild(ctx, c, small * 2, MUTED)]);
  // The contacts 0.4em and the subtitle's paragraph spacing below it.
  if (contacts.length)
    head.push(
      para(contacts, {
        spacing: {
          before: Math.round((0.4 * S + 0.55 * d * 1.25 * S - (1 - a) * subtitle) * 20),
          after: 0,
          line: Math.round(contactLine * 20),
          lineRule: LineRuleType.EXACT,
        },
      }),
    );
  const photo = photoRun(cv, S * 8.5);
  const top: (Paragraph | Table)[] = photo
    ? [
        new Table({
          layout: TableLayoutType.FIXED,
          width: { size: textWidth, type: WidthType.DXA },
          columnWidths: [textWidth - Math.round(S * 8.5 * 20 + 1.2 * S * 20), Math.round(S * 8.5 * 20 + 1.2 * S * 20)],
          borders: TableBorders.NONE,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
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
  // Then 1em more than the paragraph spacing down to the body.
  const above = contacts.length ? small : 1.25 * S;
  const col = new Column(k, a, contacts.length ? contactLine : subtitle);
  col.flow.take();
  col.flow.space(0.55 * d * above, PAR).v(d * S);
  const out: (Paragraph | Table)[] = [...top];
  const pt = textWidth / 20;
  if (cv.highlight) {
    const text = `${cv.highlight.title}  ${cv.highlight.text}`;
    out.push(legajoPar(ctx, col, [plain(ctx, `${cv.highlight.title}  `, { bold: true, color: ctx.accent }), ...words(ctx, cv.highlight.text)], text, pt));
  }
  if (cv.summary) out.push(legajoPar(ctx, col, runs(ctx, cv.summary), cv.summary, pt, { alignment: AlignmentType.JUSTIFIED }));
  if (cv.skills.length) {
    // Each skill as a row of a grid, its name in the column of the periods; 0.45em between rows, and between the grids
    // of two rows of skills the paragraph spacing too.
    out.push(legajoTitle(ctx, col, cv.labels.skills));
    const dateWidth = 2 * 28.35 * (S / 10);
    const rows = cv.skills.flatMap((groups) => {
      const grid = groups.map((g, i) => {
        if (i === 0) col.flow.space(0.55 * d * S, PAR);
        else col.flow.v(0.45 * S);
        return legajoRow(
          ctx,
          col,
          (c) => {
            // In the column of the periods, where Typst may cut a long name in two.
            const title = words(ctx, g.title.toLowerCase(), { smallCaps: true, color: MUTED, size: small * 2 });
            return [para(title, { spacing: c.next(small, lineCount(ctx, g.title, small, dateWidth)) })];
          },
          (c) => [para([plain(ctx, g.items.join(", "))], { spacing: c.next(S) })],
        );
      });
      col.flow.space(0.55 * d * S, PAR).v(0.45 * S);
      return grid;
    });
    out.push(legajoTable(ctx, rows, textWidth));
  }
  return [...out, ...cv.sections.flatMap((s) => legajoSection(ctx, col, s, textWidth))];
}

// ---------------------------------------------------------------- the one-column styles, with Typst's spacing

/** How many lines Typst gave `text`, when it has them; one when not. */
function laidLines(ctx: Ctx, text: string): number {
  const l = ctx.lines?.lay(text);
  return l ? l.over.length : 1;
}

/** A paragraph of the text size (or `size`) in a one-column style, after the spacing of a paragraph. */
function columnPar(ctx: Ctx, col: Column, k: Look, children: ParagraphChild[], text: string, width: number, options: Omit<IParagraphOptions, "children"> = {}, size = k.S): Paragraph {
  col.flow.space(k.par, PAR);
  const out = para(children, { ...options, spacing: col.next(size, lineCount(ctx, text, size, width / 20)) });
  col.flow.space(k.par, PAR);
  return out;
}

/** A section title of a one-column style, kept with what follows. A rule under it is the paragraph's bottom border, as
 * far below the baseline as Word's whole points let it be; the paragraph is as much longer. */
function columnTitle(ctx: Ctx, col: Column, k: Look, title: string): Paragraph {
  const style = ctx.style as OneColumnStyle;
  const t = titleLook(style, k);
  col.flow.space(k.above, BLOCK);
  const spacing = col.next(t.top / k.cap);
  const run = (text: string, o: RunOptions) => plain(ctx, text, { size: t.size * 2, bold: true, ...o });
  const tracked = (em: number) => Math.round(em * t.size * 20);
  // How far below the line the rule is, for it to be `at` pt below the baseline.
  const space = (at: number) => Math.max(0, Math.round(at - (1 - col.a) * (spacing.line / 20)));
  let p: Paragraph;
  if (style === "banda") {
    // The bar of the accent colour on the left, 3.5 pt wide and 0.5em from the title.
    const gap = Math.round(0.5 * k.S);
    p = para([run(title, {})], { spacing, keepNext: true, indent: { left: Math.round((3.5 + gap) * 20) }, border: { left: { style: BorderStyle.SINGLE, size: 28, color: ctx.accent, space: gap } } });
  } else if (style === "minimal") p = para([run(title.toUpperCase(), { characterSpacing: tracked(0.14) })], { spacing, keepNext: true });
  else if (style === "claustro" || style === "recto") {
    const claustro = style === "claustro";
    const width = claustro ? 0.75 : 0.5;
    const under = space(t.under - width / 2);
    p = para([run(title.toUpperCase(), claustro ? { characterSpacing: tracked(0.05) } : { color: ctx.accent, characterSpacing: tracked(0.1) })], {
      spacing,
      keepNext: true,
      border: { bottom: { style: BorderStyle.SINGLE, size: claustro ? 6 : 4, color: claustro ? ctx.accent : lighten("#1b1f23", 0.78), space: under } },
    });
    col.drop(under + width);
  } else p = para([run(title, { color: ctx.accent })], { spacing, keepNext: true });
  col.flow.v(t.under).space(k.below, BLOCK);
  return p;
}

/** Items as Typst's list: `list` pt apart (`item` before a loose one), the marker `indent` in and the text after it. */
function columnItems(ctx: Ctx, col: Column, k: Look, items: Item[], width: number): Paragraph[] {
  const inner = width / 20 - (k.indent + k.marker + k.body);
  return items.map((it) => {
    col.flow.space(k.list, BLOCK);
    const text = (it.heading ? `**${it.heading}. **` : "") + it.text;
    const children = runs(ctx, text);
    return para(children, { numbering: { reference: "dash", level: 0 }, spacing: col.next(k.S, lineCount(ctx, text, k.S, inner)) });
  });
}

/** An entry of a one-column style, as in latex.ts: the lines of one paragraph in Typst are paragraphs here, each a line
 * below the one before. */
function columnEntry(ctx: Ctx, col: Column, k: Look, e: ResolvedEntry, compact: boolean, width: number): Paragraph[] {
  const style = ctx.style as OneColumnStyle;
  const pt = width / 20;
  const tabStops = [{ type: TabStopType.RIGHT, position: width }];
  const small = k.small * 2;
  const dates: ParagraphChild[] = e.period ? [new TextRun({ children: [new Tab()] }), plain(ctx, e.period, style === "claustro" ? {} : { size: small, color: MUTED })] : [];
  const first = (children: ParagraphChild[], text: string) => para(children, { tabStops, spacing: col.next(k.S, lineCount(ctx, text, k.S, pt)) });
  const below = (children: ParagraphChild[], size: number, text: string) => para(children, { tabStops, spacing: col.line(size, lineCount(ctx, text, size, pt)) });
  const note = () => words(ctx, e.note!, { size: small, color: MUTED });
  col.flow.space(k.entry, BLOCK);
  const out: Paragraph[] = [];
  if (style === "minimal") {
    out.push(first([...words(ctx, e.title), ...dates], e.title));
    col.flow.space(k.par, PAR);
    if (e.place) {
      col.flow.space(k.parEm * k.small, PAR);
      const children = words(ctx, e.place, { size: small, color: MUTED });
      out.push(para(children, { spacing: col.next(k.small, lineCount(ctx, e.place, k.small, pt), k.leadEm * k.small) }));
      col.flow.space(k.parEm * k.small, PAR);
    }
    if (e.note) out.push(columnPar(ctx, col, k, note(), e.note, width, {}, k.small));
    if (!compact && e.items.length) col.flow.v(0.2 * k.S);
  } else {
    if (style === "banda") {
      out.push(first([...words(ctx, e.title, { bold: true }), ...dates], e.title));
      if (e.place) out.push(below(words(ctx, e.place, { size: small, color: ctx.accent, bold: true }), k.small, e.place));
    } else if (style === "claustro" && e.place) {
      out.push(first(words(ctx, e.place, { bold: true }), e.place), below([...words(ctx, e.title, { italics: true }), ...dates], k.S, e.title));
    } else if (style === "llano") {
      out.push(first([...words(ctx, e.title, { bold: true }), ...(e.place ? [plain(ctx, `, ${e.place}`)] : []), ...dates], e.title));
    } else {
      out.push(first([...words(ctx, e.title, { bold: true }), ...dates], e.title));
      if (style === "recto" && e.place) out.push(below(words(ctx, e.place, { color: MUTED }), k.S, e.place));
    }
    col.flow.space(k.par, PAR);
    // Banda's note is a paragraph of its own; the others', a line of the entry's.
    if (e.note) out.push(style === "banda" ? columnPar(ctx, col, k, note(), e.note, width, {}, k.small) : below(note(), k.small, e.note));
  }
  if (!compact && e.items.length) out.push(...columnItems(ctx, col, k, e.items, width));
  col.flow.space(0, BLOCK);
  return out;
}

/** A section of a one-column style. */
function columnSection(ctx: Ctx, col: Column, k: Look, s: ResolvedSection, width: number): Paragraph[] {
  const out = [columnTitle(ctx, col, k, s.title)];
  for (const b of s.blocks) {
    if (b.type === "entry") out.push(...columnEntry(ctx, col, k, b.entry, s.compact, width));
    else if (b.type === "item") {
      col.flow.space(k.item, BLOCK);
      out.push(...columnItems(ctx, col, k, [b], width));
      col.flow.space(0, BLOCK);
    } else out.push(columnPar(ctx, col, k, runs(ctx, b.text), b.text, width));
  }
  return out;
}

/** A table with no borders or margins of its own, its columns `widths` twips wide. */
function plainTable(widths: number[], rows: TableRow[]): Table {
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    borders: TableBorders.NONE,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    rows,
  });
}

/** A row of a grid, its cells `gutter` twips apart, all as far below what comes before as Typst's grid row; what follows
 * goes below the cell that ends lowest. */
function gridRow(col: Column, cells: ((c: Column) => Paragraph[])[], gutter: number): TableRow {
  const gap = col.flow.take();
  const columns = cells.map(() => {
    const c = new Column(col.k, col.a, col.last);
    c.flow.take();
    c.flow.v(gap);
    return c;
  });
  const children = cells.map((cell, i) => new TableCell({ borders: NO_BORDERS, margins: { ...NO_MARGINS, left: i ? gutter : 0 }, children: cell(columns[i]) }));
  const lowest = columns.reduce((a, b) => (b.height > a.height ? b : a));
  col.below(lowest.last ?? col.k.cap * col.k.S + col.k.lead);
  return new TableRow({ cantSplit: true, children });
}

/** Banda: a band of the accent colour as tall as Typst's, with the name and the subtitle in white and the photo beside
 * them; the contacts, the skills in a grid, the highlight and the summary below it. `top`: how much higher than Typst's
 * the page's text starts. */
function bandaTop(ctx: Ctx, col: Column, k: Look, width: number, top: number): (Paragraph | Table)[] {
  const { cv } = ctx;
  const band = 36; // mm, as in banda.typ
  const height = Math.max(band - cv.layout.margins.top, 12) * MM;
  const name = 2.3 * k.B;
  const subtitle = 1.25 * k.B;
  const names = k.cap * name + k.parEm * name + 0.1 * k.S + k.cap * subtitle;
  const side = Math.max(band - cv.layout.margins.top - 8, 10) * MM;
  const shape = cv.layout.photo === "square" ? "rounded" : cv.layout.photo;
  const photo = photoRun(cv, side);
  const row = Math.max(names, photo ? photoHeight(side, shape, cv.photo?.size) : 0);
  const inner = new Column(k, col.a);
  const nameLines = [para([plain(ctx, cv.name, { bold: true, color: "FFFFFF", size: name * 2 })], { spacing: inner.start(top + (row - names) / 2 + k.cap * name) })];
  inner.flow.space(k.parEm * name, PAR).v(0.1 * k.S);
  nameLines.push(para([plain(ctx, cv.subtitle, { color: "FFFFFF", size: subtitle * 2 })], { spacing: inner.next(subtitle) }));
  const shading = { type: ShadingType.CLEAR, color: "auto", fill: ctx.accent };
  const cells = [new TableCell({ borders: NO_BORDERS, margins: NO_MARGINS, shading, verticalAlign: VerticalAlign.TOP, children: nameLines })];
  const photoWidth = Math.round((side + 0.5 * k.S) * 20);
  if (photo)
    cells.push(
      new TableCell({
        borders: NO_BORDERS,
        margins: NO_MARGINS,
        shading,
        verticalAlign: VerticalAlign.CENTER,
        children: [para([photo], { alignment: AlignmentType.RIGHT, spacing: { before: 0, after: 0, line: 240, lineRule: LineRuleType.AUTO } })],
      }),
    );
  const out: (Paragraph | Table)[] = [
    plainTable(photo ? [width - photoWidth, photoWidth] : [width], [new TableRow({ height: { value: Math.round((top + height) * 20), rule: HeightRule.EXACT }, children: cells })]),
  ];
  // Below the band, the paragraph spacing and 0.9em.
  col.below(0);
  col.flow.space(k.par, PAR).v(0.9 * k.S);
  if (cv.contacts.length) {
    const dot = plain(ctx, "  •  ", { size: k.small * 2, color: ctx.accent });
    const contacts = cv.contacts.flatMap((c, i) => [...(i ? [dot] : []), contactChild(ctx, c, k.small * 2, MUTED)]);
    col.flow.space(k.parEm * k.small, PAR);
    out.push(para(contacts, { spacing: col.next(k.small, 1, k.leadEm * k.small) }));
    col.flow.space(k.parEm * k.small, PAR);
  }
  if (cv.skills.length) col.flow.v(0.5 * k.S);
  const gutter = Math.round(1.5 * k.S * 20);
  for (const groups of cv.skills) {
    // Each row a grid of its groups side by side, as wide as each other.
    const w = Math.floor((width - gutter * (groups.length - 1)) / groups.length);
    col.flow.space(k.par, PAR);
    const row = gridRow(
      col,
      groups.map((g) => (c: Column) => [
        para([plain(ctx, `${g.title}: `, { bold: true, size: k.small * 2 }), plain(ctx, g.items.join(" · "), { size: k.small * 2 })], { spacing: c.next(k.small, 1, k.leadEm * k.small) }),
      ]),
      gutter,
    );
    out.push(plainTable(groups.map((_, i) => w + (i ? gutter : 0)), [row]));
    col.flow.space(k.par, PAR).v(0.25 * k.S);
  }
  if (cv.highlight) {
    col.flow.v(0.5 * k.S);
    ctx.laid = undefined;
    const text = `${cv.highlight.title}  ${cv.highlight.text}`;
    out.push(columnPar(ctx, col, k, [plain(ctx, `${cv.highlight.title}  `, { bold: true, color: ctx.accent }), plain(ctx, cv.highlight.text)], text, width));
  }
  if (cv.summary) {
    col.flow.v(0.4 * k.S);
    out.push(columnPar(ctx, col, k, runs(ctx, cv.summary), cv.summary, width, { alignment: AlignmentType.JUSTIFIED }));
  }
  return out;
}

/** Minimal: one row of a table as tall as Typst's grid, with the name in the accent colour over the subtitle, the
 * contacts one under the other on their right and the photo beside them; then the highlight, the summary and the skills,
 * each group's name in a column as wide as the longest. */
function minimalTop(ctx: Ctx, col: Column, k: Look, width: number, top: number): (Paragraph | Table)[] {
  const { cv } = ctx;
  const name = 2.6 * k.B;
  const subtitle = 1.2 * k.B;
  const names = k.cap * name + k.parEm * name + 0.15 * k.S + k.cap * subtitle;
  const lead = k.leadEm * k.small;
  const pitch = lead + k.cap * k.small;
  const n = cv.contacts.length;
  const side = 7.5 * k.B;
  const photo = photoRun(cv, side);
  const row = Math.max(names, n ? k.cap * k.small + (n - 1) * pitch : 0, photo ? photoHeight(side, cv.layout.photo, cv.photo?.size) : 0);
  const left = new Column(k, col.a);
  const nameLines = [para([plain(ctx, cv.name, { color: ctx.accent, size: name * 2 })], { spacing: left.start(top + row - names + k.cap * name) })];
  left.flow.space(k.parEm * name, PAR).v(0.15 * k.S);
  nameLines.push(para([plain(ctx, cv.subtitle, { color: MUTED, size: subtitle * 2 })], { spacing: left.next(subtitle) }));
  const right = new Column(k, col.a);
  const contactLines = cv.contacts.map((c, i) =>
    para([contactChild(ctx, c, k.small * 2, MUTED)], { alignment: AlignmentType.RIGHT, spacing: i ? right.line(k.small, 1, lead) : right.start(top + row - (n - 1) * pitch) }),
  );
  const gutter = Math.round(1.4 * k.S * 20);
  const contactWidth = n ? Math.max(...cv.contacts.map((c) => textWidth(c.value, k.small * 2))) + gutter : 0;
  const photoWidth = photo ? Math.round(side * 20) + gutter : 0;
  const cells = [new TableCell({ borders: NO_BORDERS, margins: NO_MARGINS, children: nameLines })];
  if (n) cells.push(new TableCell({ borders: NO_BORDERS, margins: NO_MARGINS, children: contactLines }));
  if (photo) cells.push(new TableCell({ borders: NO_BORDERS, margins: NO_MARGINS, children: [para([photo], { alignment: AlignmentType.RIGHT, spacing: { before: 0, after: 0, line: 240, lineRule: LineRuleType.AUTO } })] }));
  // The row ends where the subtitle's line does, its baseline at the bottom of Typst's grid.
  const subtitleLine = left.last ?? 0;
  const widths = [width - contactWidth - photoWidth, ...(n ? [contactWidth] : []), ...(photo ? [photoWidth] : [])];
  const out: (Paragraph | Table)[] = [
    plainTable(widths, [new TableRow({ height: { value: Math.round((top + row + (1 - col.a) * subtitleLine) * 20), rule: HeightRule.EXACT }, children: cells })]),
  ];
  col.below(subtitleLine);
  col.flow.space(k.par, PAR);
  if (cv.highlight) {
    col.flow.v(1.4 * k.d * k.S);
    ctx.laid = undefined;
    const text = `${cv.highlight.title}  ${cv.highlight.text}`;
    out.push(columnPar(ctx, col, k, [plain(ctx, `${cv.highlight.title}  `, { bold: true }), plain(ctx, cv.highlight.text)], text, width));
  }
  if (cv.summary) {
    // In a size of its own, with the leading of the text size.
    col.flow.v(1.4 * k.d * k.S);
    const size = 1.02 * k.B;
    out.push(columnPar(ctx, col, k, runs(ctx, cv.summary, { size: size * 2 }), cv.summary, width, { alignment: AlignmentType.JUSTIFIED }, size));
  }
  if (cv.skills.length) out.push(columnTitle(ctx, col, k, cv.labels.skills));
  const gap = Math.round(1.5 * k.S * 20);
  for (const groups of cv.skills) {
    const titles = Math.max(...groups.map((g) => textWidth(g.title, k.small * 2)));
    const rows = groups.map((g, i) => {
      if (i === 0) col.flow.space(k.par, PAR);
      else col.flow.v(0.5 * k.S);
      return gridRow(
        col,
        [
          (c) => [para([plain(ctx, g.title, { size: k.small * 2, color: MUTED })], { spacing: c.next(k.small) })],
          (c) => [para([plain(ctx, g.items.join(" · "))], { spacing: c.next(k.S) })],
        ],
        gap,
      );
    });
    out.push(plainTable([titles, width - titles], rows));
    col.flow.space(k.par, PAR).v(0.5 * k.S);
  }
  return out;
}

/** Claustro, Recto and Llano, made for applicant tracking systems: paragraphs only (no tables), the name, the subtitle
 * and the contacts on a line each (centred in Claustro), the photo floating beside them; every part under a standard
 * title, the dates on a tab stop at the right margin. */
function atsTop(ctx: Ctx, col: Column, k: Look, width: number, top: number): Paragraph[] {
  const { cv } = ctx;
  const style = ctx.style as AtsStyle;
  const name = (style === "llano" ? 2 : 2.2) * k.B;
  const subtitle = (style === "recto" ? 1.15 : 1.1) * k.B;
  const side = (style === "llano" ? 6.5 : 7) * k.B;
  const photo = photoRun(cv, side, top);
  const tall = photo ? photoHeight(side, cv.layout.photo, cv.photo?.size) : 0;
  const gutter = Math.round(((style === "claustro" ? 1 : 1.2) * k.S + side) * 20);
  const sep = style === "recto" ? " | " : " · ";
  const n = cv.contacts.length ? laidLines(ctx, cv.contacts.map((c) => c.value).join(sep)) : 0;
  let y = k.cap * name;
  if (cv.subtitle) y += k.par + k.cap * subtitle;
  if (n) y += k.par + k.cap * k.small + (n - 1) * (k.lead + k.cap * k.small);
  const row = Math.max(y, tall);
  const line = {
    alignment: style === "claustro" ? AlignmentType.CENTER : AlignmentType.LEFT,
    indent: photo ? (style === "claustro" ? { left: gutter, right: gutter } : { right: gutter }) : undefined,
  };
  const nameRuns: ParagraphChild[] = [plain(ctx, cv.name, { bold: style !== "llano", color: style === "llano" ? ctx.accent : INK, size: name * 2 })];
  if (photo) nameRuns.push(photo);
  // Beside the photo, the header in the middle of the row.
  const out = [para(nameRuns, { ...line, spacing: col.start(top + (row - y) / 2 + k.cap * name) })];
  if (cv.subtitle) {
    col.flow.space(k.par, PAR);
    const o = { claustro: { italics: true }, recto: { color: ctx.accent }, llano: {} }[style];
    out.push(para([plain(ctx, cv.subtitle, { ...o, size: subtitle * 2 })], { ...line, spacing: col.next(subtitle) }));
  }
  if (n) {
    col.flow.space(k.par, PAR);
    const color = style === "claustro" ? INK : MUTED;
    const children = cv.contacts.flatMap((c, i) => [...(i ? [plain(ctx, sep, { size: k.small * 2, color })] : []), contactChild(ctx, c, k.small * 2, color)]);
    out.push(para(children, { ...line, spacing: col.next(k.small, n) }));
  }
  col.flow.space(k.par, PAR).v((row - y) / 2);
  if (cv.highlight) {
    col.flow.v((style === "llano" ? 0.5 : 0.6) * k.d * k.S);
    ctx.laid = undefined;
    const title = plain(ctx, `${cv.highlight.title}: `, { bold: true, color: style === "recto" ? ctx.accent : INK });
    out.push(columnPar(ctx, col, k, [title, plain(ctx, cv.highlight.text)], `${cv.highlight.title}: ${cv.highlight.text}`, width));
  }
  if (cv.summary) out.push(columnTitle(ctx, col, k, cv.labels.profile), columnPar(ctx, col, k, runs(ctx, cv.summary), cv.summary, width));
  if (cv.skills.length) out.push(columnTitle(ctx, col, k, cv.labels.skills));
  for (const g of cv.skills.flat()) {
    ctx.laid = undefined;
    out.push(columnPar(ctx, col, k, [plain(ctx, `${g.title}: `, { bold: true }), plain(ctx, g.items.join(", "))], `${g.title}: ${g.items.join(", ")}`, width));
  }
  return out;
}

/** Banda, Minimal, Claustro, Recto or Llano: one column. `top`: how much higher than Typst's the page's text starts. */
function oneColumn(ctx: Ctx, k: Look, textWidth: number, top: number): (Paragraph | Table)[] {
  const style = ctx.style as OneColumnStyle;
  const col = new Column(k, BASELINE);
  const head = style === "banda" ? bandaTop(ctx, col, k, textWidth, top) : style === "minimal" ? minimalTop(ctx, col, k, textWidth, top) : atsTop(ctx, col, k, textWidth, top);
  return [...head, ...ctx.cv.sections.flatMap((s) => columnSection(ctx, col, k, s, textWidth))];
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
  const accentHex = l.accent ?? DEFAULT_ACCENT;
  const one = style === "legajo" ? undefined : look(style, l);
  const ctx: Ctx = {
    cv,
    style,
    font: l.font === "Noto Sans" ? "Noto Sans" : "XCharter",
    accent: accentHex.slice(1).toUpperCase(),
    tint: lighten(accentHex, 0.92),
    rule: lighten(accentHex, 0.5),
    size: one ? one.S * 2 : Math.round(l.fontSize * 2),
    lines,
  };
  const paper = PAPER[l.paper];
  const m = l.margins;
  // Typst ends a page where a line's baseline would not fit, its descent hanging over the margin; Word where its
  // whole line would not. The lines have their height in Word: the bottom margin gives up what is below the baseline.
  // Typst starts a page's first line the cap height below the top margin, Word the line's height above the baseline:
  // the one-column styles' text starts that much higher, and their headers as much lower.
  const k = one ?? legajoLook(l);
  const a = BASELINE;
  const pitch = k.cap * k.S + k.lead;
  const hang = (1 - a) * pitch * 20;
  const top = one ? a * pitch - k.cap * k.S : 0;
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
          run: { font: ctx.font, size: Math.round(ctx.size), color: INK, kern: 2, language: { value: wordLanguage(cv.language) } },
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
              // As Typst's list: the marker `indent` in, the text `body-indent` after it (Legajo's: the dash, then 0.5em).
              style: {
                paragraph: {
                  indent: one
                    ? { left: Math.round((one.indent + one.marker + one.body) * 20), hanging: Math.round((one.marker + one.body) * 20) }
                    : { left: Math.round(l.fontSize * 20), hanging: Math.round(l.fontSize * 20) },
                },
                run: { color: style === "minimal" || style === "llano" ? MUTED : style === "claustro" ? INK : ctx.accent },
              },
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
              top: Math.round(m.top * TWIP_PER_MM - top * 20),
              bottom: Math.round(m.bottom * TWIP_PER_MM - hang),
              left: Math.round(m.left * TWIP_PER_MM),
              right: Math.round(m.right * TWIP_PER_MM),
            },
          },
        },
        children:
          one ? oneColumn(ctx, one, textWidth, top) : l.columns === 2 ? twoColumns(ctx, textWidth) : legajoOneColumn(ctx, textWidth),
      },
    ],
  });
  return new Uint8Array(await Packer.toArrayBuffer(doc));
}
