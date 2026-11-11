// An imported LaTeX template filled with a profile: the template's own preamble (its packages,
// its look, its macros) and a body that calls its macros with the CV's data, the way its sample
// content called them. The editor compiles this .tex in the browser; the LaTeX export hands it out.

import { formatMonth } from "../project.ts";
import { resolveProfile } from "../resolve.ts";
import { styleOf } from "../templates.ts";
import { fromBase64 } from "../typst.ts";
import type { CustomTemplate, Item, LatexArg, LatexFill, Project } from "../types.ts";
import type { ZipInput } from "../zip.ts";
import { escapeLatex, inlineLatex } from "./latex.ts";

/** The LaTeX template a profile's style is, if it is one. */
export function latexStyleOf(project: Project, profileId: string): { id: string; template: CustomTemplate; fill: LatexFill } | undefined {
  const { id, custom } = styleOf(project, profileId);
  const template = custom ? project.templates?.[id] : undefined;
  return template?.latex ? { id, template, fill: template.latex } : undefined;
}

const dirOf = (path: string) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : "");
const itemText = (it: Item) => (it.heading ? `**${it.heading}** ${it.text}` : it.text);

/** The filled main file of the profile's LaTeX template. */
export function fillLatex(project: Project, profileId: string): string {
  const style = latexStyleOf(project, profileId);
  if (!style) throw new Error(`the style of profile "${profileId}" is not a LaTeX template`);
  const { template, fill } = style;
  const cv = resolveProfile(project, profileId);
  const main = template.files?.[fill.main] ?? "";
  const start = main.search(/\\begin\s*\{document\}/);
  const preamble = (start < 0 ? main : main.slice(0, start)).trimEnd();

  const call = (macro: string, args: LatexArg[], value: (field: string) => string) =>
    `\\${macro}` +
    args
      .map((a) => {
        const v = a.raw ?? (a.field ? value(a.field) : "");
        return a.optional ? (v ? `[${v}]` : "") : `{${v}}`;
      })
      .join("");
  const list = fill.itemList ?? { begin: "\\begin{itemize}", end: "\\end{itemize}", item: "\\item #" };
  const items = (texts: string[]) => (texts.length ? [list.begin, ...texts.map((t) => "  " + list.item.replace("#", () => inlineLatex(t))), list.end] : []);
  const contact = (kind: string) => cv.contacts.find((c) => c.kind === kind)?.value ?? "";
  const month = (value: string | null | undefined) => (value === null ? cv.labels.present : value ? formatMonth(value, cv.layout, cv.labels) : "");

  const out = [preamble, "", "\\begin{document}"];
  if (fill.header) out.push(call(fill.header.macro, fill.header.args, (f) => escapeLatex(f === "name" ? cv.name : f === "subtitle" ? cv.subtitle : contact(f))));
  else
    out.push(
      "\\begin{center}",
      `  {\\LARGE\\bfseries ${escapeLatex(cv.name)}}\\\\`,
      ...(cv.subtitle ? [`  ${escapeLatex(cv.subtitle)}\\\\`] : []),
      `  ${cv.contacts.map((c) => escapeLatex(c.value)).join(" \\textbar{} ")}`,
      "\\end{center}",
    );
  if (cv.summary) out.push("", `${fill.section}{${escapeLatex(fill.summaryTitle ?? cv.labels.profile)}}`, inlineLatex(cv.summary));

  for (const s of cv.sections) {
    out.push("", `${fill.section}{${escapeLatex(s.title)}}`);
    const macro = fill.sections[s.id] ?? fill.entry;
    let open = false;
    for (const b of s.blocks) {
      if (b.type !== "entry") {
        if (open) out.push(fill.entryList!.end);
        open = false;
        out.push(...(b.type === "item" ? items([b.heading ? `**${b.heading}** ${b.text}` : b.text]) : [inlineLatex(b.text) + "\\par"]));
        continue;
      }
      if (fill.entryList && !open) out.push(fill.entryList.begin);
      open = !!fill.entryList;
      const e = b.entry;
      const source = project.entries[e.id];
      const texts = e.items.map(itemText);
      const value = (f: string) =>
        f === "title" ? inlineLatex(e.title)
        : f === "place" ? inlineLatex(e.place)
        : f === "period" ? escapeLatex(e.period)
        : f === "start" ? escapeLatex(month(source?.start))
        : f === "end" ? escapeLatex(source && "end" in source ? month(source.end) : "")
        : f === "note" ? inlineLatex(e.note ?? "")
        : f === "items" ? items(texts).join("\n")
        : "";
      const args = macro ? fill.entries[macro] : undefined;
      if (macro && args) {
        out.push(call(macro, args, value));
        if (!args.some((a) => a.field === "items")) out.push(...items(texts));
      } else out.push(`\\textbf{${inlineLatex(e.title)}} \\hfill ${escapeLatex(e.period)}\\\\`, `${inlineLatex(e.place)}\\par`, ...items(texts));
    }
    if (open) out.push(fill.entryList!.end);
  }
  out.push("\\end{document}", "");
  return out.join("\n");
}

/** The files LaTeX needs, by path: the template's files (the main one filled) laid out from the
 * main file's folder, which is where LaTeX runs. */
export function latexTemplateFiles(project: Project, profileId: string): Record<string, string | Uint8Array> {
  const { template, fill } = latexStyleOf(project, profileId)!;
  const dir = dirOf(fill.main);
  const at = (path: string) => (dir && path.startsWith(dir) ? path.slice(dir.length) : path);
  const files: Record<string, string | Uint8Array> = {};
  for (const [path, text] of Object.entries(template.files ?? {})) if (!path.startsWith("foja-latex.")) files[at(path)] = text;
  for (const [path, data] of Object.entries(template.binaries ?? {})) files[at(path)] = fromBase64(data);
  files[at(fill.main)] = fillLatex(project, profileId);
  return files;
}

/** The LaTeX export of a profile whose style is a LaTeX template. */
export function latexTemplateBundle(project: Project, profileId: string): ZipInput {
  const { template, fill } = latexStyleOf(project, profileId)!;
  return {
    ...latexTemplateFiles(project, profileId),
    "README-foja.txt": [
      "CV made with Foja (https://github.com/bafif/foja).",
      "",
      `${fill.main.slice(dirOf(fill.main).length)} is the LaTeX template "${template.name}" with its sample content replaced by`,
      "the CV, through the template's own macros. Compile it with pdflatex, as the template says.",
      ...(template.license ? ["", `The template's licence: ${template.license.slice(dirOf(fill.main).length)}.`] : []),
      "",
    ].join("\n"),
  };
}
