// The live preview: one compiler worker for the whole page, fed with the current project and
// profile (debounced), plus PDF exports through the same worker.

import { create } from "zustand";
import { styleOf, type Mark, type Project, type StyleGeometry } from "@foja/core";
import { pageBoxes } from "../lib/jpg";
import { compileProfileLatex, latexExtra, withStyle } from "../lib/latex";
import type { WorkerReply, WorkerRequest } from "../lib/typst.worker";
import { t } from "./i18n";
import { useEditor } from "./store";

export interface PreviewState {
  ready: boolean;
  failed?: string;
  svg?: string;
  pages: number;
  marks: Mark[];
  geometry?: StyleGeometry;
  errors?: string[];
  warnings?: string[];
  compileMs?: number;
  renderMs?: number;
  /** The project the shown render came from (it can lag behind while typing). */
  renderedId: number;
}

export const usePreview = create<PreviewState>()(() => ({ ready: false, pages: 0, marks: [], renderedId: 0 }));

// Development builds expose the preview state to the end-to-end tests and the console.
if (import.meta.env.DEV) (globalThis as { __fojaPreview?: typeof usePreview }).__fojaPreview = usePreview;

let worker: Worker | undefined;
let nextId = 1;
const pdfWaiting = new Map<number, (reply: Extract<WorkerReply, { type: "pdf" }>) => void>();
const thumbWaiting = new Map<number, (svg: string | undefined) => void>();

// A style is code and can be slow (or loop for ever): a job that has not answered in this long
// gets the worker replaced, with an error shown, instead of a preview and exports stuck for good.
const WATCHDOG_MS = 20_000;
let watchdog: ReturnType<typeof setTimeout> | undefined;

function restart() {
  worker?.terminate();
  worker = undefined;
  for (const [, reply] of pdfWaiting) reply({ type: "pdf", id: 0, errors: [t.workerTimeout] });
  pdfWaiting.clear();
  for (const [, resolve] of thumbWaiting) resolve(undefined);
  thumbWaiting.clear();
  usePreview.setState({ ready: false, errors: [t.workerTimeout] });
  start();
}

function start(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("../lib/typst.worker.ts", import.meta.url), { type: "module" });
  worker.onerror = (event) => usePreview.setState({ failed: event.message || "the compiler did not load" });
  worker.onmessage = ({ data }: MessageEvent<WorkerReply>) => {
    clearTimeout(watchdog);
    if (data.type === "working") {
      watchdog = setTimeout(restart, WATCHDOG_MS);
      return;
    }
    if (data.type === "ready") usePreview.setState({ ready: true });
    else if (data.type === "failed") usePreview.setState({ failed: data.error });
    else if (data.type === "thumb") {
      thumbWaiting.get(data.id)?.(data.svg);
      thumbWaiting.delete(data.id);
    } else if (data.type === "pdf") {
      pdfWaiting.get(data.id)?.(data);
      pdfWaiting.delete(data.id);
    } else {
      // The last good render stays on screen when there is an error.
      usePreview.setState(
        data.svg
          ? { svg: data.svg, pages: data.pages ?? 1, marks: data.marks ?? [], geometry: data.geometry, errors: undefined, warnings: data.warnings, compileMs: data.compileMs, renderMs: data.renderMs, renderedId: data.id }
          : { errors: data.errors, compileMs: data.compileMs },
      );
    }
  };
  return worker;
}

function post(request: WorkerRequest) {
  start().postMessage(request);
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Starts the worker and re-renders whenever the project or the profile changes. */
export function connectPreview() {
  start();
  let latest = 0;
  const render = () => {
    const { project, profileId } = useEditor.getState();
    if (!project || !project.profiles[profileId]) return;
    const id = (latest = nextId++);
    // A LaTeX template compiles first; only the newest compile goes on to the preview.
    const extra = latexExtra(project, profileId);
    if (!extra) post({ type: "render", id, project, profile: profileId });
    else void extra.then((files) => id === latest && post({ type: "render", id, project, profile: profileId, extra: files }));
  };
  render();
  return useEditor.subscribe((state, prev) => {
    if (state.project === prev.project && state.profileId === prev.profileId) return;
    clearTimeout(timer);
    timer = setTimeout(render, 80);
  });
}

export async function compilePdf(project: Project, profile: string): Promise<Uint8Array> {
  // A LaTeX template's PDF is LaTeX's own, as the template makes it.
  const latex = compileProfileLatex(project, profile);
  if (latex) {
    const r = await latex;
    if (!r.pdf) throw new Error(r.errors.join("\n"));
    return r.pdf;
  }
  const id = nextId++;
  post({ type: "pdf", id, project, profile });
  return new Promise((resolve, reject) =>
    pdfWaiting.set(id, (reply) => (reply.pdf ? resolve(reply.pdf) : reject(new Error((reply.errors ?? [t.pdfFailed]).join("\n"))))),
  );
}

// Thumbnails by project version, profile and style: the picker asks again on every render.
const thumbCache = new WeakMap<Project, Map<string, Promise<string | undefined>>>();

/** The first page of the profile laid out in `style`, as SVG. */
export function renderThumb(project: Project, profile: string, style: string): Promise<string | undefined> {
  let byKey = thumbCache.get(project);
  if (!byKey) thumbCache.set(project, (byKey = new Map()));
  const key = `${profile}\u0000${style}`;
  let promise = byKey.get(key);
  if (!promise) {
    const id = nextId++;
    promise = new Promise((resolve) => thumbWaiting.set(id, resolve));
    const extra = latexExtra(withStyle(project, profile, style), profile);
    if (!extra) post({ type: "thumb", id, project, profile, style });
    else void extra.then((files) => post({ type: "thumb", id, project, profile, style, extra: files }));
    byKey.set(key, promise);
  }
  return promise;
}

/** The pages of the profile in its own style, compiled apart from the preview; undefined when it
 * does not compile. */
export async function countPages(project: Project, profile: string): Promise<number | undefined> {
  const svg = await renderThumb(project, profile, styleOf(project, profile).id);
  return svg ? pageBoxes(svg).length : undefined;
}
