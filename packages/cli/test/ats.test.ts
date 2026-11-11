// The styles made for applicant tracking systems read, in the PDF, in the order they are seen: the
// text the PDF carries comes top to bottom and left to right, and the parts of the CV come in the
// profile's order, the contacts right after the name.

import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { ATS_STYLES } from "@foja/core/export";
import { BUILTIN_STYLES, pickStyle, resolveProfile, type Project } from "@foja/core";
import { Typst } from "../src/typst.ts";
import { outOfOrder, pdfText } from "./pdftext.ts";

const read = (path: string): Project => JSON.parse(readFileSync(new URL(`../../../examples/${path}`, import.meta.url), "utf8"));
const projects: Record<string, Project> = { curriculum: read("curriculum.project.json"), fictional: read("fictional.project.json") };

/** Every profile in `style`, picked as the editor does (with the style's preset). */
function inStyle(project: Project, style: string): Project {
  const p = structuredClone(project);
  // At the full length: the fixtures mark nothing essential, and the reading order is checked on everything.
  for (const profile of Object.values(p.profiles)) profile.layout = { ...pickStyle(profile.layout, style), length: "full" };
  return p;
}

const squash = (s: string) => s.replace(/\s+/g, "").toLowerCase();

test("the styles with a preset are the ATS ones", () => {
  expect(BUILTIN_STYLES.filter((s) => s.preset).map((s) => s.id)).toEqual([...ATS_STYLES]);
});

describe.each(ATS_STYLES)("%s reads in the order it is seen", (style) => {
  test.each(Object.keys(projects))("%s", (name) => {
    const p = inStyle(projects[name], style);
    const typst = new Typst(p);
    for (const id of Object.keys(p.profiles)) {
      const runs = pdfText(typst.pdf(typst.compile(id)));
      expect(outOfOrder(runs), `${name}/${id}`).toEqual([]);
      const text = squash(runs.map((r) => r.text).join(""));
      const cv = resolveProfile(p, id);
      const expected = [
        cv.name,
        cv.subtitle,
        ...cv.contacts.map((c) => c.value),
        ...(cv.summary ? [cv.labels.profile] : []),
        ...(cv.skills.length ? [cv.labels.skills, ...cv.skills.flat().map((g) => g.title)] : []),
        ...cv.sections.flatMap((s) => [s.title, ...s.blocks.flatMap((b) => (b.type === "entry" ? [b.entry.title] : []))]),
      ].filter(Boolean);
      let at = 0;
      for (const piece of expected) {
        const found = text.indexOf(squash(piece), at);
        expect(found, `${name}/${id}: "${piece}"`).toBeGreaterThanOrEqual(0);
        at = found + squash(piece).length;
      }
    }
  });
});

test("the check catches a layout that is read out of order", () => {
  // Legajo in two columns: the sidebar is read whole before the main column beside it.
  const typst = new Typst(projects.fictional);
  const runs = pdfText(typst.pdf(typst.compile("desarrolladora")));
  expect(runs.length).toBeGreaterThan(50);
  expect(runs[0].text).toContain("Inés");
  expect(outOfOrder(runs).length).toBeGreaterThan(0);
});
