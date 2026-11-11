// Imported templates, compiled for real: the style made from a template lays out a CV of Foja's
// with the template's own macros, and the data made from it compiles in Foja's styles.

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { importData, importStyle, proposeMapping, readTemplate, resolveProfile, validate, type Project } from "@foja/core";
import { Typst } from "../src/typst.ts";
import { pdfText } from "./pdftext.ts";

const fixtures = new URL("../../core/test/fixtures/", import.meta.url).pathname;
const fictional: Project = JSON.parse(readFileSync(new URL("../../../examples/fictional.project.json", import.meta.url), "utf8"));

function folder(dir: string, base = dir): Record<string, Uint8Array> {
  return Object.fromEntries(
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? Object.entries(folder(path, base)) : [[path.slice(base.length + 1), new Uint8Array(readFileSync(path))]];
    }),
  );
}
const uploads: Record<string, Record<string, Uint8Array>> = {
  single: { "cv.typ": new Uint8Array(readFileSync(join(fixtures, "single.typ"))) },
  package: folder(join(fixtures, "package")),
};
const squash = (s: string) => s.replace(/\s+/g, "");

describe.each(Object.keys(uploads))("the %s template", (which) => {
  const t = readTemplate(uploads[which]);
  const mapping = proposeMapping(t);

  test("as a style, it lays out a Foja CV with its macros", () => {
    const p = structuredClone(fictional);
    p.templates = { importada: importStyle(t, mapping, "importada", "Importada") };
    for (const profile of Object.values(p.profiles)) profile.layout = { template: "importada" };
    expect(validate(p)).toEqual([]);
    const typst = new Typst(p);
    for (const id of Object.keys(p.profiles)) {
      const doc = typst.compile(id);
      const text = squash(pdfText(typst.pdf(doc)).map((r) => r.text).join(""));
      const cv = resolveProfile(p, id);
      expect(text).toContain(squash(cv.name));
      for (const s of cv.sections) for (const b of s.blocks) if (b.type === "entry") expect(text, `${id}: ${b.entry.title}`).toContain(squash(b.entry.title));
      // Click-to-edit still finds the sections.
      expect(new Set(typst.marks(doc).map((m) => m.path))).toContain("sections.0");
    }
  });

  test("as data, it compiles in Foja's own style", () => {
    const { project, profileId } = importData(t, mapping, { name: "Importada", language: "es" });
    expect(new Typst(project).compile(profileId).numOfPages).toBe(1);
  });
});

test("foja import writes a project with the template's data and look", () => {
  const out = join(mkdtempSync(join(tmpdir(), "foja-")), "imported.json");
  const main = new URL("../src/main.ts", import.meta.url).pathname;
  const run = spawnSync(process.execPath, [main, "import", join(fixtures, "single.typ"), out, "--lang", "en"], { encoding: "utf8" });
  expect(run.stderr).toBe("");
  expect(run.stdout).toContain('3 entries in profile "single", in the style "single"');
  const project: Project = JSON.parse(readFileSync(out, "utf8"));
  expect(validate(project)).toEqual([]);
  expect(project.profiles.single.layout).toEqual({ template: "single" });
  expect(new Typst(project).compile("single").numOfPages).toBe(1);
});
