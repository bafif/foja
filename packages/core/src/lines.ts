// The lines Typst lays a profile out in, read from a compilation of measure.typ (packages/template), for the LaTeX and
// Word exports to break their lines in the same places: then each paragraph takes in them as many lines as in the
// PDF, whatever the program would have done on its own.

/** A word as measure.typ reports it, in pt from the page's top left corner: where it ends (page, x, y; after a
 * paragraph's last word, the paragraph's bottom left corner), its width, its size, the width of a space there and,
 * when its start is on another line (it starts a line, ends a paragraph or is cut in two), where it starts if on the
 * line it is, the distance between two lines, the width of a hyphen and the width of each of its endings (from the
 * second grapheme on, from the third...). */
export interface MeasuredWord {
  text: string;
  end: [number, number, number];
  width: number;
  size: number;
  space: number;
  start?: number;
  pitch?: number;
  hyphen?: number;
  endings?: number[];
}

/** Put in a paragraph's text where a line starts: in place of the spaces before it, or inside a word, where the line
 * before ends with a hyphen. */
export const LINE = "";
export const HYPHEN_LINE = "";

/** A paragraph's text with its line starts marked, and for each line how much wider than its place in Typst its
 * words and plain spaces are, in pt: more than 0 when Typst narrowed its spaces to fit them, which Word cannot do. */
export interface Laid {
  text: string;
  over: number[];
}

const graphemes = (text: string) => [...new Intl.Segmenter().segment(text)].map((s) => s.segment);
/** What two texts are compared by: no spaces, no `**`, small letters (styles write some titles in capitals). */
const comparable = (c: string) => c.normalize("NFC").toLowerCase();
const NEAR = 0.5;

export class Lines {
  private words: MeasuredWord[];
  /** Every word's comparable text, one after the other. */
  private stream = "";
  /** For each character of `stream`, its word. */
  private wordAt: number[] = [];
  private starts: number[] = [];
  private cursor = 0;

  constructor(words: MeasuredWord[]) {
    this.words = words;
    words.forEach((w, i) => {
      this.starts.push(this.stream.length);
      const c = comparable(w.text);
      this.stream += c;
      for (let n = 0; n < c.length; n++) this.wordAt.push(i);
    });
  }

  /** `text` (with `**` for bold) with the lines Typst gave it marked, or undefined when Typst has no such text.
   * Paragraphs are looked for from where the last one was found on, so that one text that comes twice gets the
   * lines of each place in turn. */
  lay(text: string): Laid | undefined {
    // The comparable characters of `text`, and where each one is in it.
    let wanted = "";
    const from: number[] = [];
    for (let i = 0; i < text.length; ) {
      if (text.startsWith("**", i)) {
        i += 2;
        continue;
      }
      const ch = String.fromCodePoint(text.codePointAt(i)!);
      if (!/\s/.test(ch)) {
        const c = comparable(ch);
        wanted += c;
        for (let n = 0; n < c.length; n++) from.push(i);
      }
      i += ch.length;
    }
    if (!wanted) return undefined;
    let found = this.stream.indexOf(wanted, this.cursor);
    if (found < 0) found = this.stream.indexOf(wanted);
    if (found < 0) return undefined;
    // Only whole words: a match that starts or ends inside a word is another text.
    const first = this.wordAt[found];
    const last = this.wordAt[found + wanted.length - 1];
    if (this.starts[first] !== found || (this.starts[last + 1] ?? this.stream.length) !== found + wanted.length) return undefined;
    this.cursor = found + wanted.length;
    const words = this.words.slice(first, last + 1);
    const inText = (s: number) => from[s - found];

    // The first word starts a line, at the paragraph's left edge.
    const left = words[0].end[1] - words[0].width;
    const marks: { at: number; hyphen: boolean }[] = [];
    const lines: { widths: number[]; spaces: number; space: number; end: number }[] = [];
    let page = words[0].end[0];
    let y = words[0].end[2];
    words.forEach((w, j) => {
      const [p, x, wy] = w.end;
      // After a paragraph's last word the marker is at the paragraph's bottom left corner: the word starts a line
      // when that corner is a whole line below the line before.
      const corner = j > 0 && Math.abs(x - left) < NEAR && w.width > NEAR;
      const cut = !corner && x - w.width < left - NEAR;
      const pitch = w.pitch ?? 1.2 * w.size;
      const opens = j === 0 || (!cut && (p !== page || (corner ? wy - y > pitch - NEAR : Math.abs(wy - y) > NEAR)));
      if (opens) {
        if (j > 0) marks.push({ at: inText(this.starts[first + j]), hyphen: false });
        lines.push({ widths: [], spaces: 0, space: w.space, end: left });
      } else lines[lines.length - 1].spaces++;
      const line = lines[lines.length - 1];
      [page, y] = [p, wy];
      if (!cut || !w.endings?.length) {
        line.widths.push(w.width);
        line.end = corner ? left + line.widths.reduce((a, b) => a + b, 0) + line.spaces * line.space : x;
        return;
      }
      // Cut in two: the ending on the next line is the one as wide as the space from the line's start to the
      // word's end.
      const tail = x - left;
      const k = w.endings.reduce((best, width, e) => (Math.abs(width - tail) < Math.abs(w.endings![best] - tail) ? e : best), 0);
      const head = graphemes(w.text).slice(0, k + 1).join("");
      // After a hyphen or a slash Typst breaks without adding one.
      const hyphen = !/[-‐–—/]$/.test(head);
      marks.push({ at: inText(this.starts[first + j] + comparable(head).length), hyphen });
      const before = w.width - w.endings[k] + (hyphen ? (w.hyphen ?? w.size / 3) : 0);
      line.widths.push(before);
      // Where the word starts is known when it is not the first on its line.
      line.end = line.widths.length > 1 && w.start !== undefined ? w.start + before : Number.NaN;
      lines.push({ widths: [w.endings[k]], spaces: 0, space: w.space, end: x });
    });
    // A line that ends in a hyphen reaches the paragraph's right edge, where the widest of the others ends.
    const right = Math.max(...lines.map((l) => l.end).filter((e) => !Number.isNaN(e)));
    const over = lines.map((l) => l.widths.reduce((a, b) => a + b, 0) + l.spaces * l.space - ((Number.isNaN(l.end) ? right : l.end) - left));

    let out = "";
    let i = 0;
    for (const m of marks) {
      let at = m.at;
      // Before the `**` that opens a bold line start, not inside it.
      if (!m.hyphen && text.startsWith("**", at - 2)) at -= 2;
      // A line that starts at a space starts after it: the spaces before it go.
      let cut = at;
      if (!m.hyphen) while (cut > i && /\s/.test(text[cut - 1])) cut--;
      out += text.slice(i, cut) + (m.hyphen ? HYPHEN_LINE : LINE);
      i = at;
    }
    return { text: out + text.slice(i), over };
  }
}
