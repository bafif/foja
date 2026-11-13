// The same length in every format: for every profile of the example projects and every built-in style, the pages of
// the Typst PDF, of the LaTeX export compiled with pdflatex and of the Word export opened in LibreOffice. The PDF is
// the one of the style the exports reproduce (Legajo for Arco and Rótulo, Minimal for Portada). Fails when an export
// has a different number of pages. Runs in its own container (scripts/length.sh).
//
//   node tests/length/measure.ts [--only <project>/<profile>] [--style <id>] [--keep <dir>] [--lines]
//
// `--lines` gives the exports the lines Typst laid each paragraph out in (measure.typ), which they will copy once
// their spacing is Typst's too; `--keep` copies every PDF, .tex and .docx to <dir>.

import { execFile } from "node:child_process";
import { cpus } from "node:os";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs, promisify } from "node:util";
import { BUILTIN_STYLES, migrate, pickStyle, type Project } from "@foja/core";
import { exportedProject, exportFiles, latexBundle } from "@foja/core/export";
import { Typst, wordFonts } from "../../packages/cli/src/typst.ts";

const run = promisify(execFile);
const { values } = parseArgs({ options: { only: { type: "string" }, style: { type: "string" }, keep: { type: "string" }, lines: { type: "boolean" } } });
const work = mkdtempSync("/tmp/length-");
const fonts = wordFonts();

interface Case {
  name: string;
  dir: string;
  typst: number;
  latex?: number;
  word?: number;
}

const pages = async (pdf: string) => Number(/Pages:\s+(\d+)/.exec((await run("pdfinfo", [pdf])).stdout)?.[1]);

/** Runs `jobs` with at most `width` at a time. */
async function pool<T>(jobs: (() => Promise<T>)[], width = cpus().length): Promise<T[]> {
  const out: T[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: width }, async () => {
    while (next < jobs.length) {
      const i = next++;
      out[i] = await jobs[i]();
    }
  }));
  return out;
}

const cases: Case[] = [];
for (const file of readdirSync("examples").filter((f) => f.endsWith(".project.json")).sort()) {
  const original = migrate(JSON.parse(readFileSync(join("examples", file), "utf8"))) as Project;
  const stem = file.replace(".project.json", "");
  for (const profileId of Object.keys(original.profiles)) {
    if (values.only && values.only !== `${stem}/${profileId}`) continue;
    for (const { id: styleId } of BUILTIN_STYLES) {
      if (values.style && values.style !== styleId) continue;
      const profile = original.profiles[profileId];
      const project: Project = { ...original, profiles: { ...original.profiles, [profileId]: { ...profile, layout: pickStyle(profile.layout, styleId) } } };
      const name = `${stem}/${profileId}/${styleId}`;
      const dir = join(work, name.replaceAll("/", "-"));
      mkdirSync(dir);
      const reference = exportedProject(project, profileId);
      const typst = new Typst(reference);
      writeFileSync(join(dir, "typst.pdf"), typst.pdf(typst.compile(profileId)));
      const measured = values.lines ? typst.words(typst.compile(profileId, true)) : undefined;
      for (const [path, data] of Object.entries(latexBundle(project, profileId, measured))) writeFileSync(join(dir, path), data);
      writeFileSync(join(dir, "word.docx"), (await exportFiles(project, profileId, "docx", { wordFonts: fonts, measured }))[0].data);
      cases.push({ name, dir, typst: await pages(join(dir, "typst.pdf")) });
    }
  }
}

await pool(
  cases.map((c) => async () => {
    try {
      await run("pdflatex", ["-interaction=nonstopmode", "-halt-on-error", "cv.tex"], { cwd: c.dir });
      c.latex = await pages(join(c.dir, "cv.pdf"));
    } catch {
      c.latex = undefined;
    }
  }),
);

// LibreOffice converts one file per process start at best: every Word export in one call, each in its own directory.
await pool(
  [...Array(Math.min(4, cases.length)).keys()].map((k) => async () => {
    const mine = cases.filter((_, i) => i % 4 === k);
    const profile = `file://${work}/lo-${k}`;
    for (const c of mine) {
      await run("soffice", [`-env:UserInstallation=${profile}`, "--headless", "--convert-to", "pdf", "--outdir", c.dir, join(c.dir, "word.docx")]);
      c.word = await pages(join(c.dir, "word.pdf")).catch(() => undefined);
    }
  }),
  4,
);

if (values.keep) {
  for (const c of cases) {
    const into = join(values.keep, c.name.replaceAll("/", "-"));
    mkdirSync(into, { recursive: true });
    for (const f of ["typst.pdf", "cv.pdf", "cv.tex", "cv.log", "word.pdf", "word.docx"]) {
      try {
        copyFileSync(join(c.dir, f), join(into, f));
      } catch {}
    }
  }
}

const show = (n: number | undefined, ref: number) => (n === undefined ? "fails" : n === ref ? String(n) : `${n} ✗`);
const width = Math.max(...cases.map((c) => c.name.length));
console.log(`${"profile/style".padEnd(width)}  Typst  LaTeX  Word`);
for (const c of cases) console.log(`${c.name.padEnd(width)}  ${String(c.typst).padStart(5)}  ${show(c.latex, c.typst).padStart(5)}  ${show(c.word, c.typst).padStart(4)}`);
const wrong = cases.filter((c) => c.latex !== c.typst || c.word !== c.typst);
console.log(`\n${cases.length - wrong.length} of ${cases.length} with the same length in the three formats.`);
process.exit(wrong.length ? 1 : 0);
