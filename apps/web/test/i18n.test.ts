import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { detectLanguage, en, es } from "../src/editor/i18n";
import { landing } from "../src/landing";

/** Every key of `a` is in `b` with the same kind of value, and no text is empty. */
function sameShape(a: unknown, b: unknown, path: string): string[] {
  if (typeof a === "string") return typeof b === "string" && b.trim() ? [] : [`${path}: missing or empty`];
  if (typeof a === "function") return typeof b === "function" ? [] : [`${path}: should be a function`];
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return [`${path}: should have ${a.length} items`];
    return a.flatMap((v, i) => sameShape(v, b[i], `${path}[${i}]`));
  }
  if (a && typeof a === "object") {
    if (!b || typeof b !== "object") return [`${path}: missing`];
    return Object.keys(a).flatMap((k) => sameShape((a as any)[k], (b as any)[k], path ? `${path}.${k}` : k));
  }
  return [];
}

describe("every interface text exists in both languages", () => {
  test.each([
    ["the editor", es, en],
    ["the landing page", landing.es, landing.en],
  ])("%s", (_, spanish, english) => {
    expect(sameShape(spanish, english, "").map((p) => `English ${p}`)).toEqual([]);
    expect(sameShape(english, spanish, "").map((p) => `Spanish ${p}`)).toEqual([]);
  });
});

test("Spanish when any preferred language is Spanish, English otherwise", () => {
  expect(detectLanguage(["es-AR"])).toBe("es");
  expect(detectLanguage(["en-US", "es-419"])).toBe("es");
  expect(detectLanguage(["ES"])).toBe("es");
  expect(detectLanguage(["en-GB", "fr"])).toBe("en");
  expect(detectLanguage(["esu"])).toBe("en");
  expect(detectLanguage([])).toBe("en");
});

// Text a person reads goes through the catalog (`t.…`); what is left written by hand in the components is caught
// here. Keyboard shortcuts and symbols are fine.
test("the editor's components write no interface text by hand", () => {
  const dir = join(import.meta.dirname, "../src/editor");
  const files = readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".tsx"));
  const allowed = /^(Ctrl\+\S+|Typst · SVG|Foja)$/;
  const found: string[] = [];
  for (const file of files) {
    readFileSync(join(dir, file), "utf8")
      .split("\n")
      .forEach((line, i) => {
        const texts = [
          ...[...line.matchAll(/(?<![=\-<>])>(?!=)([^<>{}]*\p{L}[^<>{}]*)</gu)].map((m) => m[1].trim()),
          ...[...line.matchAll(/\b(?:aria-label|title|placeholder|alt|label)="([^"]*\p{L}[^"]*)"/gu)].map((m) => m[1]),
        ];
        for (const text of texts) if (!allowed.test(text)) found.push(`${file}:${i + 1}: ${text}`);
      });
  }
  expect(found).toEqual([]);
});
