import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { HYPHEN_LINE, LINE, Lines, resolveProfile, type MeasuredWord, type Project } from "../src/index.ts";
import { exportFiles, renderLatex } from "../src/export/index.ts";
import { docxParts } from "./docx-parts.ts";

const example: Project = JSON.parse(readFileSync(new URL("../../../examples/curriculum.project.json", import.meta.url), "utf8"));

/** A word of 10 pt text ending at `x`, `y` on page 1. */
const word = (text: string, x: number, y: number, width: number, more: Partial<MeasuredWord> = {}): MeasuredWord => ({
  text,
  end: [1, x, y],
  width,
  size: 10,
  space: 5,
  ...more,
});

describe("Typst's lines", () => {
  test("a line starts where a word's end is on another line, in place of the space before it", () => {
    // The last word's marker is at the paragraph's bottom left corner, on its line: not a line of its own.
    const lines = new Lines([word("uno", 20, 10, 20), word("dos", 45, 10, 20), word("tres", 25, 22, 25), word("cuatro", 0, 22, 30, { pitch: 12 })]);
    expect(lines.lay("uno dos tres cuatro")).toEqual({ text: `uno dos${LINE}tres cuatro`, over: [0, 0] });
  });

  test("the last word starts a line when the corner is a whole line below", () => {
    const lines = new Lines([word("uno", 20, 10, 20), word("dos", 0, 22, 20, { pitch: 12 })]);
    expect(lines.lay("uno dos")?.text).toBe(`uno${LINE}dos`);
  });

  test("a word cut in two: the line starts at the ending as wide as what is on the next line", () => {
    const lines = new Lines([
      word("abc", 30, 10, 30),
      word("defghij", 12, 22, 40, { start: 35, endings: [34, 28, 22, 12, 8, 4], hyphen: 3, pitch: 12 }),
      word("klm", 0, 22, 15, { pitch: 12 }),
    ]);
    const laid = lines.lay("abc defghij klm")!;
    expect(laid.text).toBe(`abc defg${HYPHEN_LINE}hij klm`);
    // The first line: 30 + 5 + (40 - 12) + 3 wide, to the hyphen's end at 35 + 31.
    expect(laid.over[0]).toBeCloseTo(0);
  });

  test("no hyphen is added after a hyphen", () => {
    const lines = new Lines([word("auto-hospedado", 45, 22, 70, { start: 0, endings: [60, 55, 50, 45, 40], hyphen: 3 })]);
    expect(lines.lay("x auto-hospedado")).toBeUndefined();
    const two = new Lines([word("un", 10, 10, 10), word("auto-hospedado", 40, 22, 70, { start: 15, endings: [60, 55, 50, 45, 40, 35, 30, 25, 20], hyphen: 3 })]);
    expect(two.lay("un auto-hospedado")?.text).toBe(`un auto-${LINE}hospedado`);
  });

  test("bold: the text keeps its `**`, and a line that starts in bold starts before them", () => {
    const lines = new Lines([word("Uno.", 22, 10, 22), word("dos", 47, 10, 20), word("tres", 25, 22, 25), word("uno", 20, 30, 20), word("dos", 20, 42, 20), word("tres", 0, 42, 25)]);
    expect(lines.lay("**Uno.** dos tres")?.text).toBe(`**Uno.** dos${LINE}tres`);
    expect(lines.lay("uno **dos tres**")?.text).toBe(`uno${LINE}**dos tres**`);
  });

  test("a text Typst does not have, or that starts inside a word, has no lines", () => {
    const lines = new Lines([word("uno", 20, 10, 20), word("dos", 45, 10, 20)]);
    expect(lines.lay("otra cosa")).toBeUndefined();
    expect(lines.lay("no do")).toBeUndefined();
    // Capitals and spaces do not count: styles write some titles in capitals.
    expect(lines.lay("UNO  DOS")?.text).toBe("UNO  DOS");
  });

  test("a text that comes twice gets the lines of each place in turn", () => {
    const lines = new Lines([word("uno", 20, 10, 20), word("dos", 20, 22, 20), word("uno", 20, 40, 20), word("dos", 45, 40, 20)]);
    expect(lines.lay("uno dos")?.text).toBe(`uno${LINE}dos`);
    expect(lines.lay("uno dos")?.text).toBe("uno dos");
  });

  /** The words of `text` on two lines, the second starting at word `at`. */
  function twoLines(text: string, at: number): MeasuredWord[] {
    return text.split(/\s+/).map((t, i) => (i < at ? word(t, 10 * i + 5, 10, 5) : word(t, 10 * (i - at) + 5, 22, 5)));
  }

  test("LaTeX and Word break where Typst does", async () => {
    const cv = resolveProfile(example, "programador");
    const words = cv.summary.split(/\s+/);
    const measured = twoLines(cv.summary, 5);
    const tex = renderLatex(cv, "claustro", measured);
    expect(tex).toContain(`${words.slice(0, 5).join("~")}\\linebreak{}${words[5]}~`);
    // TeX does not cut a word Typst did not cut.
    expect(tex).toContain("\\hyphenpenalty=10000");
    const parts = await docxParts((await exportFiles(example, "programador", "docx", { measured }))[0].data);
    expect(parts["word/document.xml"]).toMatch(new RegExp(`<w:br/><w:t xml:space="preserve">${words[5]}`));
  });
});
