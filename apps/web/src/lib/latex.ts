// LaTeX in the browser, for styles imported from LaTeX templates: the worker in public/latex/
// (SwiftLaTeX's pdfTeX in WebAssembly), started the first time one is needed. It compiles the
// template filled with the profile; the PDF goes to the Typst worker, whose style for the template
// shows its pages, so the preview, the page count and the exports work as with any other style.

import { customFilePath, LATEX_INFO, LATEX_PDF, type Project } from "@foja/core";
import { latexStyleOf, latexTemplateFiles } from "@foja/core/export/latex-template";

export interface LatexResult {
  pdf?: Uint8Array;
  /** LaTeX's errors (its `!` lines), when there is no PDF. */
  errors: string[];
  pages: number;
  /** The first page's size, in points. */
  width: number;
  height: number;
}

type Reply = { id: number; status: number; log: string; pdf?: Uint8Array };

// The first job downloads the engine and the TeX files and makes LaTeX's format: it can take a
// while on a slow connection. After that a CV compiles in well under a second.
const FIRST_MS = 180_000;
const NEXT_MS = 30_000;

let worker: Worker | undefined;
let warmed = false;
let nextId = 1;
const waiting = new Map<number, (reply: Reply) => void>();

function start(): Worker {
  if (worker) return worker;
  worker = new Worker(`${import.meta.env.BASE_URL.replace(/\/?$/, "/")}latex/worker.js`);
  worker.onmessage = ({ data }: MessageEvent<Reply>) => {
    waiting.get(data.id)?.(data);
    waiting.delete(data.id);
  };
  worker.onerror = (event) => stop(event.message || "LaTeX did not load");
  return worker;
}

function stop(error: string) {
  worker?.terminate();
  worker = undefined;
  warmed = false;
  for (const [id, reply] of waiting) reply({ id, status: -1, log: error });
  waiting.clear();
}

function request(message: object, transfer: Transferable[] = []): Promise<Reply> {
  const id = nextId++;
  return new Promise((resolve) => {
    // A template can loop for ever (\def\x{\x}\x): past the time limit the worker is replaced.
    const timer = setTimeout(() => stop("LaTeX took too long and was stopped"), warmed ? NEXT_MS : FIRST_MS);
    waiting.set(id, (reply) => {
      clearTimeout(timer);
      if (reply.status !== -1) warmed = true;
      resolve(reply);
    });
    start().postMessage({ ...message, id }, transfer);
  });
}

/** Starts loading LaTeX before it is needed (when a LaTeX template is being imported). */
export function warmLatex(): void {
  void request({ cmd: "warm" });
}

const latin1 = new TextDecoder("latin1");

/** Pages and first page size of a PDF written with uncompressed objects (\pdfobjcompresslevel=0). */
export function pdfPages(pdf: Uint8Array): { pages: number; width: number; height: number } {
  const text = latin1.decode(pdf);
  const pages = (text.match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length;
  const box = /\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/.exec(text);
  return { pages, width: box ? +box[3] - +box[1] : 595.28, height: box ? +box[4] - +box[2] : 841.89 };
}

/** LaTeX's errors: each `!` line with the line of the source it points at. */
export function latexErrors(log: string): string[] {
  const lines = log.split("\n");
  const errors = lines.flatMap((line, i) => {
    if (!line.startsWith("!")) return [];
    const at = lines.slice(i + 1, i + 8).find((l) => /^l\.\d+/.test(l));
    return [`${line.slice(1).trim()}${at ? ` (${at.trim()})` : ""}`];
  });
  return errors.length ? errors.slice(0, 5) : [log.trim().split("\n").slice(-3).join(" ") || "LaTeX failed"];
}

const results = new Map<string, Promise<LatexResult>>();

/** Compiles `main` among `files` (paths from the main file's folder); the same files compile once. */
export function compileLatex(files: Record<string, string | Uint8Array>, main: string): Promise<LatexResult> {
  const key = JSON.stringify(Object.entries(files).map(([p, c]) => [p, typeof c === "string" ? c : c.length]));
  let result = results.get(key);
  if (!result) {
    // Plain PDF objects, so that the pages and their size can be read without a PDF library.
    const sent = { ...files, [main]: `\\pdfobjcompresslevel=0\n${files[main]}` };
    result = request({ cmd: "compile", files: sent, main }).then((reply) => {
      if (!reply.pdf || reply.status !== 0) return { errors: latexErrors(reply.log), pages: 0, width: 595.28, height: 841.89 };
      return { pdf: reply.pdf, errors: [], ...pdfPages(reply.pdf) };
    });
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
  return compileLatex(latexTemplateFiles(project, profileId), main);
}

const encoder = new TextEncoder();

/** The files the Typst worker needs to show the profile's LaTeX template: its PDF and its pages
 * (or, when LaTeX failed, its errors in their place). Undefined for other styles. */
export async function latexExtra(project: Project, profileId: string): Promise<Record<string, Uint8Array> | undefined> {
  const style = latexStyleOf(project, profileId);
  const compiled = compileProfileLatex(project, profileId);
  if (!style || !compiled) return undefined;
  const r = await compiled;
  const info = r.pdf ? { pages: r.pages, width: r.width, height: r.height, message: "" } : { pages: 0, width: r.width, height: r.height, message: `LaTeX: ${r.errors.join("\n")}` };
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
