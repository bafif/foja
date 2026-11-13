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
import type { ResolvedContact, ResolvedCv, ResolvedEntry, ResolvedSection } from "../resolve.ts";
import type { Item } from "../types.ts";
import { BLOCK, Flow, legajoLook, legajoRule, PAR, type LegajoLook } from "./flow.ts";
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
  const out: (Paragraph | Table)[] = [sectionTitle(ctx, s.title)];
  for (const [i, b] of s.blocks.entries()) {
    if (b.type === "entry") out.push(...datedEntry(ctx, b.entry, s.compact, widthTwip, i === 0));
    else out.push(...(b.type === "item" ? bulletItems(ctx, [b]) : [para(runs(ctx, b.text), { alignment: AlignmentType.JUSTIFIED })]));
  }
  return out;
}

/** Minimal's name in the accent colour over the subtitle. */
function header(ctx: Ctx): Paragraph[] {
  const { cv } = ctx;
  return [
    para([plain(ctx, cv.name, { color: ctx.accent, size: Math.round(ctx.size * 2.6) })], { spacing: { after: 40 } }),
    para([plain(ctx, cv.subtitle, { color: MUTED, size: Math.round(ctx.size * 1.2) })], { spacing: { after: ctx.sep } }),
  ];
}

function summary(ctx: Ctx): Paragraph[] {
  return ctx.cv.summary ? [para(runs(ctx, ctx.cv.summary), { alignment: AlignmentType.JUSTIFIED })] : [];
}


/** Room between two skill groups side by side, in twips. */
const CELL_GAP = 120;

/** A generous guess of how wide `text` is in twips, at `size` half-points, in XCharter or Noto Sans (about 0.58 em a
 * letter; small capitals about 0.72 em). */
function textWidth(text: string, size: number, caps = false): number {
  return Math.ceil(text.length * (caps ? 0.72 : 0.58) * size * 10);
}


// ---------------------------------------------------------------- Legajo, with Typst's spacing

/** Where the baseline of an exact line is, as a share of its height from the top: LibreOffice puts it there, the
 * ascent's share of the Word fonts' height (scripts/word-fonts.py). */
const baselineShare = (sans: boolean) => (sans ? 1.124 / 1.519 : 0.963 / 1.199);

/** A column of Legajo, which takes Typst's spacing (flow.ts) and remembers the height of its last line. Word starts a
 * line where the one before ends; in lines of an exact height, the cap height plus the leading, the baselines stand as
 * far apart as Typst's. Word has no negative spacing: what it cannot take away before a paragraph comes off the
 * paragraph's lines, so that the paragraph still ends where Typst's does. */
class Column {
  readonly flow = new Flow();
  readonly k: LegajoLook;
  /** baselineShare. */
  readonly a: number;
  private prev?: number;

  /** `prev`: the height of the line above the column, if its first line is not placed by what is around it. */
  constructor(k: LegajoLook, a: number, prev?: number) {
    this.k = k;
    this.a = a;
    this.prev = prev;
  }

  /** The spacing of a paragraph of `n` lines of text `size` pt, `lead` pt apart (plus the cap height). */
  next(size: number, n = 1, lead = this.k.lead, gap = this.flow.take()) {
    const pitch = this.k.cap * size + lead;
    if (this.prev === undefined) {
      this.prev = pitch;
      return { before: 0, after: 0, line: Math.round(pitch * 20), lineRule: LineRuleType.EXACT };
    }
    // From where the paragraph's first line starts down to its last baseline, as far as Typst has it; that much
    // spacing before lines of the full height, or none before lines shorter.
    const lines = Math.max(1, n) - 1 + this.a;
    const reach = gap + this.k.cap * size + (Math.max(1, n) - 1) * pitch - (1 - this.a) * this.prev;
    const before = reach - lines * pitch;
    const line = before < 0 ? reach / lines : pitch;
    this.prev = line;
    return { before: Math.max(0, Math.round(before * 20)), after: 0, line: Math.round(line * 20), lineRule: LineRuleType.EXACT };
  }

  /** The spacing of a paragraph that goes on a line of Typst's paragraph above it, `lead` pt below. */
  line(size: number, lead = this.k.lead) {
    return this.next(size, 1, lead, lead);
  }

  /** The height of the column's last line. */
  get last(): number | undefined {
    return this.prev;
  }

  /** Goes on below a table whose last line is `height` pt, whatever spacing was left. */
  below(height: number): void {
    this.flow.take();
    this.prev = height;
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
    para(children, { ...options, spacing: more ? col.line(small, lead) : col.next(small, lineCount(ctx, text, small, widthPt), lead) });
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
      children.push(...g.items.map((v, j) => para([plain(ctx, v, { size: small * 2 })], { spacing: j ? c.line(small, lead) : c.next(small, 1, lead) })));
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
  const a = baselineShare(layout.font === "Noto Sans");
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
  const a = baselineShare(cv.layout.font === "Noto Sans");
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
    // Each skill as a row of a grid, its name in the column of the periods; 0.45em between rows.
    out.push(legajoTitle(ctx, col, cv.labels.skills));
    const rows = cv.skills.flat().map((g) => {
      const row = legajoRow(
        ctx,
        col,
        (c) => [para([plain(ctx, g.title.toLowerCase(), { smallCaps: true, color: MUTED, size: small * 2 })], { spacing: c.next(small) })],
        (c) => [para([plain(ctx, g.items.join(", "))], { spacing: c.next(S) })],
      );
      col.flow.v(0.45 * S);
      return row;
    });
    out.push(legajoTable(ctx, rows, textWidth));
  }
  return [...out, ...cv.sections.flatMap((s) => legajoSection(ctx, col, s, textWidth))];
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
    const title = plain(ctx, `${g.title}: `, banda ? { bold: true, size: ctx.small } : { color: MUTED });
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
  // Typst ends a page where a line's baseline would not fit, its descent hanging over the margin; Word where its
  // whole line would not. Legajo's lines have their height in Word: the bottom margin gives up what is below the
  // baseline.
  const k = legajoLook(l);
  const hang = style === "legajo" ? (1 - baselineShare(l.font === "Noto Sans")) * (k.cap * k.S + k.lead) * 20 : 0;
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
              // Legajo's as Typst's list: the dash, then 0.5em.
              style: {
                paragraph: { indent: style === "legajo" ? { left: Math.round(l.fontSize * 20), hanging: Math.round(l.fontSize * 20) } : { left: 240, hanging: 200 } },
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
              top: Math.round(m.top * TWIP_PER_MM),
              bottom: Math.round(m.bottom * TWIP_PER_MM - hang),
              left: Math.round(m.left * TWIP_PER_MM),
              right: Math.round(m.right * TWIP_PER_MM),
            },
          },
        },
        children:
          style === "legajo"
            ? l.columns === 2
              ? twoColumns(ctx, textWidth)
              : legajoOneColumn(ctx, textWidth)
            : isAtsStyle(style)
              ? atsColumn(ctx, textWidth, style)
              : oneColumn(ctx, textWidth),
      },
    ],
  });
  return new Uint8Array(await Packer.toArrayBuffer(doc));
}
