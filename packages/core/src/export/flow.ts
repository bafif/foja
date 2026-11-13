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
