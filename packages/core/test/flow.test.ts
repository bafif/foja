import { describe, expect, test } from "vitest";
import { BLOCK, Flow, legajoLook, legajoTop, PAR } from "../src/export/flow.ts";

describe("Typst's spacing between blocks", () => {
  test("weak spacing at the top of a column is dropped, `v()` is not", () => {
    expect(new Flow().space(10, BLOCK).take()).toBe(0);
    expect(new Flow().space(10, BLOCK).v(4).take()).toBe(4);
  });

  test("a block's spacing wins over a paragraph's, even when smaller", () => {
    const flow = new Flow();
    flow.take();
    // A paragraph (5.5 below) and then a list (4 above): 4, as Typst measures between a title and its items.
    expect(flow.space(5.5, PAR).space(4, BLOCK).take()).toBe(4);
    expect(flow.space(4, BLOCK).space(5.5, PAR).take()).toBe(4);
  });

  test("between two of the same kind the larger stays, and `v()` adds to it", () => {
    const flow = new Flow();
    flow.take();
    expect(flow.space(6, BLOCK).space(7.5, BLOCK).take()).toBe(7.5);
    expect(flow.space(6.875, PAR).v(10).space(5.5, PAR).take()).toBe(16.875);
  });

  test("Legajo's columns start where Typst puts them", () => {
    // Measured on Typst's PDF: the first baseline of the main column, less the top margin and the cap height.
    expect(legajoTop(legajoLook({ fontSize: 10, density: "normal" }))).toBeCloseTo(55.27, 1);
    expect(legajoTop(legajoLook({ fontSize: 11, density: "compact", font: "Noto Sans" }))).toBeCloseTo(86.94 - 28.35 - 0.714 * 11, 1);
  });
});
