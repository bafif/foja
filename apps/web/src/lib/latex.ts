// LaTeX in the browser, for styles imported from LaTeX templates: the worker in public/latex/
// (BusyTeX's engines in WebAssembly), one per engine, started the first time one is needed.
// pdfLaTeX compiles the template filled with the profile to a PDF; XeLaTeX compiles it to an .xdv
// that xdvipdfmx, in the same worker, turns into one. The PDF goes to the Typst worker, whose style
// for the template shows its pages, so the preview, the page count and the exports work as with any
// other style.

import { customFilePath, LATEX_INFO, LATEX_PDF, type Project } from "@foja/core";
import { latexStyleOf, latexTemplateFiles } from "@foja/core/export/latex-template";
import { t } from "../editor/i18n";

export type LatexEngine = "pdftex" | "xetex";

export interface LatexResult {
  pdf?: Uint8Array;
  /** LaTeX's errors (its `!` lines), when there is no PDF. */
  errors: string[];
  pages: number;
  /** The first page's size, in points. */
  width: number;
  height: number;
}

type Worker_ = LatexEngine;
type Reply = { id: number; status: number; log: string; pdf?: Uint8Array; xdv?: Uint8Array };

// The first job downloads the engine and the TeX files: it can take a while on a slow connection.
// After that a CV compiles in a second or two.
const FIRST_MS = 180_000;
const NEXT_MS = 30_000;
const A4 = { width: 595.28, height: 841.89 };

const workers = new Map<Worker_, Worker>();
const warmed = new Set<Worker_>();
let nextId = 1;
const waiting = new Map<number, { engine: Worker_; reply: (reply: Reply) => void }>();

function start(engine: Worker_): Worker {
  let worker = workers.get(engine);
  if (worker) return worker;
  worker = new Worker(`${import.meta.env.BASE_URL.replace(/\/?$/, "/")}latex/worker.js?engine=${engine}`);
  worker.onmessage = ({ data }: MessageEvent<Reply>) => {
    waiting.get(data.id)?.reply(data);
    waiting.delete(data.id);
  };
  worker.onerror = (event) => stop(engine, event.message || "LaTeX did not load");
  workers.set(engine, worker);
  return worker;
}

function stop(engine: Worker_, error: string) {
  workers.get(engine)?.terminate();
  workers.delete(engine);
  warmed.delete(engine);
  for (const [id, job] of waiting) {
    if (job.engine !== engine) continue;
    job.reply({ id, status: -1, log: error });
    waiting.delete(id);
  }
}

function request(engine: Worker_, message: object, transfer: Transferable[] = []): Promise<Reply> {
  const id = nextId++;
  return new Promise((resolve) => {
    // A template can loop for ever (\def\x{\x}\x): past the time limit the worker is replaced.
    const timer = setTimeout(() => stop(engine, "LaTeX took too long and was stopped"), warmed.has(engine) ? NEXT_MS : FIRST_MS);
    waiting.set(id, {
      engine,
      reply: (reply) => {
        clearTimeout(timer);
        if (reply.status !== -1) warmed.add(engine);
        resolve(reply);
      },
    });
    start(engine).postMessage({ ...message, id }, transfer);
  });
}

/** Starts loading LaTeX before it is needed (when a LaTeX template is being imported). */
export function warmLatex(engine: LatexEngine = "pdftex"): void {
  void request(engine, { cmd: "warm" });
}

const latin1 = new TextDecoder("latin1");
const UNIT: Record<string, number> = { pt: 72 / 72.27, bp: 1, mm: 72 / 25.4, cm: 720 / 25.4, in: 72 };

/** The pages LaTeX's log reports, and the first page's size: from the PDF when its objects can be
 * read (pdfLaTeX's, written with \pdfobjcompresslevel=0), else from the paper the template asked
 * for in the .xdv (`papersize=` specials), else A4. */
export function pdfPages(pdf: Uint8Array, log = "", xdv?: Uint8Array): { pages: number; width: number; height: number } {
  const text = latin1.decode(pdf);
  const logged = /Output written on .*?\((\d+) pages?/.exec(log);
  const pages = logged ? +logged[1] : (text.match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length;
  const box = /\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/.exec(text);
  if (box) return { pages, width: +box[3] - +box[1], height: +box[4] - +box[2] };
  const paper = xdv && /papersize=([\d.]+)(pt|bp|mm|cm|in),\s*([\d.]+)(pt|bp|mm|cm|in)/.exec(latin1.decode(xdv));
  return paper ? { pages, width: +paper[1] * UNIT[paper[2]], height: +paper[3] * UNIT[paper[4]] } : { pages, ...A4 };
}

/** The fonts LaTeX's errors say it could not find by name. */
export function missingFonts(errors: string[]): string[] {
  return [...new Set(errors.flatMap((e) => [...e.matchAll(/The font "([^"]+)" cannot be found/g)].map((m) => m[1])))];
}

/** LaTeX's errors, each once: each `!` line, with the lines a package's error goes on in (they start
 * with its name in parentheses), and the line of the source it points at. */
export function latexErrors(log: string): string[] {
  const lines = log.split("\n");
  const errors = lines.flatMap((line, i) => {
    if (!line.startsWith("!")) return [];
    let text = line.slice(1).trim();
    for (const next of lines.slice(i + 1)) {
      const more = /^\([\w@.-]+\)\s+(.*)$/.exec(next);
      if (!more) break;
      text += " " + more[1].trim();
    }
    const at = lines.slice(i + 1, i + 12).find((l) => /^l\.\d+/.test(l));
    return [`${text}${at ? ` (${at.trim()})` : ""}`];
  });
  return errors.length ? [...new Set(errors)].slice(0, 5) : [log.trim().split("\n").slice(-3).join(" ") || "LaTeX failed"];
}

async function run(files: Record<string, string | Uint8Array>, main: string, engine: LatexEngine): Promise<LatexResult> {
  const failed = (log: string): LatexResult => ({ errors: latexErrors(log), pages: 0, ...A4 });
  if (engine === "pdftex") {
    // Plain PDF objects, so that the page size can be read without a PDF library.
    const reply = await request("pdftex", { cmd: "compile", files: { ...files, [main]: `\\pdfobjcompresslevel=0\n${files[main]}` }, main });
    return reply.pdf && reply.status === 0 ? { pdf: reply.pdf, errors: [], ...pdfPages(reply.pdf, reply.log) } : failed(reply.log);
  }
  // The template's own fonts (uploaded, or in its files) are among its files: XeTeX finds them by
  // name there, as it finds Foja's.
  const reply = await request("xetex", { cmd: "compile", files, main });
  return reply.pdf && reply.status === 0 ? { pdf: reply.pdf, errors: [], ...pdfPages(reply.pdf, reply.log, reply.xdv) } : failed(reply.log);
}

const results = new Map<string, Promise<LatexResult>>();

/** Compiles `main` among `files` (paths from the main file's folder); the same files compile once. */
export function compileLatex(files: Record<string, string | Uint8Array>, main: string, engine: LatexEngine = "pdftex"): Promise<LatexResult> {
  const key = JSON.stringify([engine, ...Object.entries(files).map(([p, c]) => [p, typeof c === "string" ? c : c.length])]);
  let result = results.get(key);
  if (!result) {
    result = run(files, main, engine);
    results.set(key, result);
    if (results.size > 12) results.delete(results.keys().next().value!);
  }
  return result;
}

/** The profile's LaTeX template compiled, when its style is one. */
export function compileProfileLatex(project: Project, profileId: string): Promise<LatexResult> | undefined {
  const style = latexStyleOf(project, profileId);
  if (!style) return undefined;
  const main = style.fill.main.split("/").pop()!;
  return compileLatex(latexTemplateFiles(project, profileId), main, style.fill.engine ?? "pdftex");
}

const encoder = new TextEncoder();

/** The files the Typst worker needs to show the profile's LaTeX template: its PDF and its pages
 * (or, when LaTeX failed, its errors in their place). Undefined for other styles. */
export async function latexExtra(project: Project, profileId: string): Promise<Record<string, Uint8Array> | undefined> {
  const style = latexStyleOf(project, profileId);
  const compiled = compileProfileLatex(project, profileId);
  if (!style || !compiled) return undefined;
  const r = await compiled;
  const missing = missingFonts(r.errors);
  const message = missing.length ? t.latexFonts.missing(missing) : `LaTeX: ${r.errors.join("\n")}`;
  const info = r.pdf ? { pages: r.pages, width: r.width, height: r.height, message: "" } : { pages: 0, width: r.width, height: r.height, message };
  return {
    [customFilePath(style.id, LATEX_INFO)]: encoder.encode(JSON.stringify(info)),
    ...(r.pdf ? { [customFilePath(style.id, LATEX_PDF)]: r.pdf } : {}),
  };
}

/** The project as if the profile used `style`, for thumbnails in the style picker. */
export function withStyle(project: Project, profileId: string, style: string): Project {
  const profile = project.profiles[profileId];
  return { ...project, profiles: { ...project.profiles, [profileId]: { ...profile, layout: { ...profile.layout, template: style } } } };
}
