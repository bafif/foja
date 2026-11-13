// Typst's vertical spacing, which the LaTeX and Word exports reproduce to come out as long as the PDF.
//
// In Typst every block has weak spacing above and below it (`block(above:, below:)`) and every paragraph
// `par.spacing` on both sides. Adjacent weak spacings collapse into one, even across a `v()` between them: a
// block's wins over a paragraph's whatever their sizes, and between two of the same kind the larger stays. A `v()`
// adds to what is left. Weak spacing at the top of a column or a cell is dropped. A line's top is the cap height of
// its font and its bottom the baseline, so from one baseline to the next there is the spacing plus the cap height
// of the next line; within a paragraph, `par.leading` plus that cap height.

/** The weakness of a block's spacing: it wins over a paragraph's. */
export const BLOCK = 1;
/** The weakness of a paragraph's spacing. */
export const PAR = 4;

/** The cap height of the fonts Typst uses, in em: XCharter and Noto Sans. */
export const capHeight = (sans: boolean) => (sans ? 0.714 : 0.671);

/** The spacing between the blocks of one column or cell, block by block. */
export class Flow {
  private weak?: { amount: number; weakness: number };
  private strong = 0;
  private started = false;

  /** Weak spacing of `weakness` (BLOCK or PAR), in bp. */
  space(amount: number, weakness: number): this {
    const w = this.weak;
    if (!w || weakness < w.weakness || (weakness === w.weakness && amount > w.amount)) this.weak = { amount, weakness };
    return this;
  }

  /** `v(amount)`, in bp. */
  v(amount: number): this {
    this.strong += amount;
    return this;
  }

  /** The spacing before the next line or block, in bp. */
  take(): number {
    const out = (this.started ? (this.weak?.amount ?? 0) : 0) + this.strong;
    this.weak = undefined;
    this.strong = 0;
    this.started = true;
    return out;
  }
}

export const DENSITY = { compact: 0.7, normal: 1, relaxed: 1.3 } as const;

/** Legajo's measures (legajo.typ), in pt: the text size, the density factor, the cap height of the font in em, the
 * leading and the small size. */
export function legajoLook(l: { fontSize: number; density: keyof typeof DENSITY; font?: string }) {
  const S = l.fontSize;
  return { S, d: DENSITY[l.density], cap: capHeight(l.font === "Noto Sans"), lead: 0.55 * S, small: 0.88 * S };
}
export type LegajoLook = ReturnType<typeof legajoLook>;

/** Where Legajo's columns start below the top margin, in pt: the name, its paragraph spacing less 0.35em down to the
 * middle of the rule, 0.1em and the subtitle's paragraph spacing down to the subtitle, which keeps its spacing below,
 * and 1em. Measured on Typst's PDF. */
export function legajoTop(k: LegajoLook): number {
  const { S, d, cap } = k;
  return cap * 2.1 * S + legajoRule(k) + 0.1 * S + 0.55 * d * 1.25 * S + cap * 1.25 * S + 0.55 * d * 1.25 * S + d * S;
}

/** From the baseline of Legajo's name down to the middle of its rule, in pt. */
export const legajoRule = (k: LegajoLook) => 0.55 * k.d * 2.1 * k.S - 0.35 * k.S;

// A grid, and a block that sets no spacing of its own, take the paragraph spacing around them, as weak as a
// paragraph's. A text set in a size of its own alone in the flow is a paragraph whose `em` is that size; inside
// `par()`, the size around it.

/** What the one-column styles set (styles/*.typ): the text size and the small one, in em of the profile's; in em of the
 * text size, the leading, the spacing of paragraphs and of list items, a section title's spacing above and below, an
 * entry's and a loose item's above, and the list's indent before its marker and after it; and whether the marker is a
 * bullet (or a dash). */
const ONE_COLUMN = {
  banda: { size: 0.95, small: 0.9, lead: 0.6, par: 0.6, list: 0.4, above: 1.35, below: 0.6, entry: 0.8, item: 0.45, indent: 0.2, body: 0.5, bullet: true },
  minimal: { size: 0.95, small: 0.88, lead: 0.65, par: 0.65, list: 0.45, above: 1.5, below: 0.6, entry: 1, item: 0.5, indent: 0, body: 0.6, bullet: false },
  claustro: { size: 1, small: 0.9, lead: 0.55, par: 0.55, list: 0.35, above: 1.15, below: 0.5, entry: 0.8, item: 0.45, indent: 0.5, body: 0.5, bullet: true },
  recto: { size: 0.95, small: 0.9, lead: 0.6, par: 0.6, list: 0.4, above: 1.3, below: 0.55, entry: 0.85, item: 0.45, indent: 0.2, body: 0.5, bullet: true },
  llano: { size: 0.95, small: 0.9, lead: 0.55, par: 0.55, list: 0.35, above: 1.2, below: 0.45, entry: 0.7, item: 0.4, indent: 0, body: 0.55, bullet: false },
} as const;
export type OneColumnStyle = keyof typeof ONE_COLUMN;

/** A one-column style's measures, in pt: `B` the profile's size, `S` the text size; `lead` and `par` the leading and the
 * paragraph spacing of a paragraph of the text size, `leadEm` and `parEm` the same in em of a paragraph's own size. */
export function look(style: OneColumnStyle, l: { fontSize: number; density: keyof typeof DENSITY; font?: string }) {
  const s = ONE_COLUMN[style];
  const sans = l.font === "Noto Sans";
  const B = l.fontSize;
  const S = s.size * B;
  const d = DENSITY[l.density];
  return {
    B,
    S,
    d,
    cap: capHeight(sans),
    lead: s.lead * S,
    leadEm: s.lead,
    par: s.par * d * S,
    parEm: s.par * d,
    list: s.list * d * S,
    small: s.small * B,
    above: s.above * d * S,
    below: s.below * d * S,
    entry: s.entry * d * S,
    item: s.item * d * S,
    indent: s.indent * S,
    /** The marker's width: a bullet in Noto Sans or XCharter, or a dash. */
    marker: (s.bullet ? (sans ? 0.376 : 0.59) : 0.5) * S,
    body: s.body * S,
  };
}
export type Look = ReturnType<typeof look>;

/** A one-column style's section title: its size, how far its line reaches above the baseline (the cap height, or
 * Banda's block of colour, 0.83em) and how much of the title's block is below the baseline (an inset, or that block's
 * 0.12em), in pt. */
export function titleLook(style: OneColumnStyle, k: Look) {
  const line = (size: number, under = 0) => ({ size, top: k.cap * size, under });
  if (style === "banda") return { size: 1.15 * k.B, top: Math.max(k.cap * 1.15 * k.B, 0.83 * k.S), under: 0.12 * k.S };
  if (style === "minimal") return line(0.95 * k.small);
  if (style === "claustro") return line(k.S, 2.5);
  if (style === "recto") return line(k.small, 3);
  return line(1.1 * k.B);
}

/** How tall a photo `width` pt wide is in Typst (lib.typ's `photo`): a circle as tall as wide, the rest in proportion. */
export const photoHeight = (width: number, shape: string, size?: { width: number; height: number }) =>
  shape === "circle" || !size ? width : (width * size.height) / size.width;
