// Compiles the CV template with typst.ts off the main thread: SVG pages and the template's marks
// for the preview, PDF for exports.

import { createTypstCompiler, type TypstWorld } from "@myriaddreamin/typst.ts/compiler";
import { createTypstRenderer } from "@myriaddreamin/typst.ts/renderer";
import { disableDefaultFontAssets, loadFonts } from "@myriaddreamin/typst.ts/options.init";
import compilerWasm from "@myriaddreamin/typst-ts-web-compiler/wasm?url";
import rendererWasm from "@myriaddreamin/typst-ts-renderer/wasm?url";
import {
  LABELS_PATH,
  LIB_PATH,
  MEASURE_PATH,
  PROJECT_PATH,
  builtinStylePath,
  customStyleBinaries,
  customStyleSources,
  fromBase64,
  projectForTypst,
  styleOf,
  stylePath,
  typstInputs,
  type Mark,
  type MeasuredWord,
  type Project,
  type StyleGeometry,
} from "@foja/core";
import { exportedProject } from "@foja/core/export/style";
import lib from "@foja/template/lib.typ?raw";
import measure from "@foja/template/measure.typ?raw";
import labels from "@foja/template/labels.json?raw";

const fontUrls = Object.values(
  import.meta.glob<string>("../../../../packages/template/fonts/*.{otf,ttf}", { query: "?url", import: "default", eager: true }),
);
const styleSources = import.meta.glob<string>("../../../../packages/template/styles/*.typ", { query: "?raw", import: "default", eager: true });

/** Files made outside Typst for this request, by path (the PDF LaTeX made of an imported LaTeX
 * template): they take the place of the style's own file at that path. */
type Extra = { extra?: Record<string, Uint8Array> };

export type WorkerRequest =
  | ({ type: "render"; id: number; project: Project; profile: string } & Extra)
  | ({ type: "pdf"; id: number; project: Project; profile: string } & Extra)
  /** The first page in another style, for the style picker. */
  | ({ type: "thumb"; id: number; project: Project; profile: string; style: string } & Extra)
  | ({ type: "lines"; id: number; project: Project; profile: string } & Extra);

export type WorkerReply =
  | { type: "ready"; initMs: number }
  /** A job started: the page restarts the worker if no reply follows in time. */
  | { type: "working" }
  | { type: "failed"; error: string }
  | {
      type: "render";
      id: number;
      svg?: string;
      pages?: number;
      marks?: Mark[];
      geometry?: StyleGeometry;
      errors?: string[];
      warnings?: string[];
      compileMs: number;
      renderMs: number;
    }
  | { type: "pdf"; id: number; pdf?: Uint8Array; errors?: string[] }
  | { type: "thumb"; id: number; svg?: string }
  | { type: "lines"; id: number; words?: MeasuredWord[] };

const compiler = createTypstCompiler();
const renderer = createTypstRenderer();
const encoder = new TextEncoder();

async function init() {
  const start = performance.now();
  const fonts = await Promise.all(fontUrls.map(async (url) => new Uint8Array(await (await fetch(url)).arrayBuffer())));
  await Promise.all([
    compiler.init({
      getModule: () => compilerWasm,
      beforeBuild: [disableDefaultFontAssets(), loadFonts(fonts)],
    }),
    renderer.init({ getModule: () => rendererWasm }),
  ]);
  compiler.addSource(LIB_PATH, lib);
  compiler.addSource(MEASURE_PATH, measure);
  for (const [path, source] of Object.entries(styleSources)) compiler.addSource(builtinStylePath(path.split("/").pop()!.replace(/\.typ$/, "")), source);
  compiler.mapShadow(LABELS_PATH, encoder.encode(labels));
  postMessage({ type: "ready", initMs: performance.now() - start } satisfies WorkerReply);
}

const ready = init().catch((error) => {
  postMessage({ type: "failed", error: String(error?.stack ?? error) } satisfies WorkerReply);
  throw error;
});

// Assets are mapped again only when they change: decoding a photo on every keystroke is waste.
const mappedAssets = new Map<string, string>();
const customSources = new Map<string, string>();

function load(project: Project, extra: Record<string, Uint8Array> = {}) {
  compiler.mapShadow(PROJECT_PATH, projectForTypst(project));
  for (const [path, bytes] of Object.entries(extra)) {
    compiler.mapShadow(path, bytes);
    customSources.delete(path);
  }
  for (const [path, source] of customStyleSources(project)) {
    if (extra[path]) continue;
    if (customSources.get(path) !== source) {
      compiler.addSource(path, source);
      customSources.set(path, source);
    }
  }
  // The pictures of imported templates, by their path under /custom/.
  for (const [path, data] of customStyleBinaries(project)) {
    if (mappedAssets.get(path) !== data) {
      compiler.mapShadow(path, fromBase64(data));
      mappedAssets.set(path, data);
    }
  }
  const assets = project.assets ?? {};
  for (const [name, data] of mappedAssets) {
    if (name.startsWith("/custom/")) continue;
    if (assets[name]?.data !== data) {
      compiler.unmapShadow(`/assets/${name}`);
      mappedAssets.delete(name);
    }
  }
  for (const [name, asset] of Object.entries(assets)) {
    if (!mappedAssets.has(name)) {
      compiler.mapShadow(`/assets/${name}`, fromBase64(asset.data));
      mappedAssets.set(name, asset.data);
    }
  }
}

const errorText = (e: unknown) => String((e as Error)?.stack ?? e);
const asStrings = (d: unknown) => (d as string[] | undefined)?.length ? (d as string[]) : undefined;

// One snapshot per request: compile once, then take the vector artifact, the marks or the PDF
// from the same world.
function withWorld<T>(
  project: Project,
  profile: string,
  fn: (world: TypstWorld) => Promise<T>,
  mainFilePath = styleOf(project, profile).path,
  extra?: Record<string, Uint8Array>,
  inputs: Record<string, string> = {},
): Promise<T> {
  load(project, extra);
  return compiler.runWithWorld({ mainFilePath, inputs: { ...typstInputs(profile), ...inputs } }, fn);
}

async function thumb(req: Extract<WorkerRequest, { type: "thumb" }>): Promise<WorkerReply> {
  return withWorld(
    req.project,
    req.profile,
    async (world) => {
      const compiled = await world.compile({ diagnostics: "unix" });
      if (compiled.hasError) return { type: "thumb", id: req.id };
      const { result } = await world.vector({ diagnostics: "unix" });
      return { type: "thumb", id: req.id, svg: result ? await renderer.renderSvg({ artifactContent: result }) : undefined };
    },
    stylePath(req.project, req.style),
    req.extra,
  );
}

async function render(req: Extract<WorkerRequest, { type: "render" }>): Promise<WorkerReply> {
  return withWorld(req.project, req.profile, async (world) => {
    const t0 = performance.now();
    const compiled = await world.compile({ diagnostics: "unix" });
    if (compiled.hasError) {
      return { type: "render", id: req.id, errors: asStrings(compiled.diagnostics) ?? ["compile failed"], compileMs: performance.now() - t0, renderMs: 0 };
    }
    const { result: vector } = await world.vector({ diagnostics: "unix" });
    const marks = await world.query<Mark[]>({ selector: "<foja>", field: "value" });
    const geometry = (await world.query<StyleGeometry[]>({ selector: "<foja-geometry>", field: "value" }))[0];
    const t1 = performance.now();
    const svg = await renderer.renderSvg({ artifactContent: vector! });
    const pages = svg.match(/class="typst-page"/g)?.length ?? Math.max(1, ...marks.map((m) => m.page));
    return {
      type: "render",
      id: req.id,
      svg,
      pages,
      marks,
      geometry,
      warnings: asStrings(compiled.diagnostics),
      compileMs: t1 - t0,
      renderMs: performance.now() - t1,
    };
  }, undefined, req.extra);
}

async function pdf(req: Extract<WorkerRequest, { type: "pdf" }>): Promise<WorkerReply> {
  return withWorld(req.project, req.profile, async (world) => {
    const { result, diagnostics } = await world.pdf({ diagnostics: "unix" });
    return result ? { type: "pdf", id: req.id, pdf: result } : { type: "pdf", id: req.id, errors: asStrings(diagnostics) ?? ["compile failed"] };
  }, undefined, req.extra);
}

// Where each word is in the style the LaTeX and Word exports reproduce (measure.typ), which they copy.
async function lines(req: Extract<WorkerRequest, { type: "lines" }>): Promise<WorkerReply> {
  const project = exportedProject(req.project, req.profile);
  const style = styleOf(project, req.profile).path;
  return withWorld(
    project,
    req.profile,
    async (world) => {
      const compiled = await world.compile({ diagnostics: "unix" });
      if (compiled.hasError) return { type: "lines", id: req.id };
      return { type: "lines", id: req.id, words: await world.query<MeasuredWord[]>({ selector: "<foja-word>", field: "value" }) };
    },
    MEASURE_PATH,
    req.extra,
    { style },
  );
}

// Renders: only the newest request matters, anything queued behind a running one is dropped.
// Exports always run, in order.
let pendingRender: Extract<WorkerRequest, { type: "render" }> | undefined;
const exports: Extract<WorkerRequest, { type: "pdf" | "lines" }>[] = [];
// Thumbnails wait for everything else; a newer request for the same style replaces an older one.
const thumbs = new Map<string, Extract<WorkerRequest, { type: "thumb" }>>();
let busy = false;

async function drain() {
  if (busy) return;
  busy = true;
  await ready;
  while (pendingRender || exports.length || thumbs.size) {
    postMessage({ type: "working" } satisfies WorkerReply);
    const next = exports.shift();
    if (next?.type === "lines") {
      postMessage(await lines(next).catch((): WorkerReply => ({ type: "lines", id: next.id })));
      continue;
    }
    if (next) {
      const reply = await pdf(next).catch((e): WorkerReply => ({ type: "pdf", id: next.id, errors: [errorText(e)] }));
      postMessage(reply, reply.type === "pdf" && reply.pdf ? [reply.pdf.buffer] : []);
      continue;
    }
    if (!pendingRender) {
      const [key, t] = thumbs.entries().next().value!;
      thumbs.delete(key);
      postMessage(
        await thumb(t).catch((e): WorkerReply => {
          console.error("foja: thumbnail failed", e);
          return { type: "thumb", id: t.id };
        }),
      );
      continue;
    }
    const req = pendingRender;
    pendingRender = undefined;
    postMessage(
      await render(req).catch((e): WorkerReply => ({ type: "render", id: req.id, errors: [errorText(e)], compileMs: 0, renderMs: 0 })),
    );
  }
  busy = false;
}

onmessage = (event: MessageEvent<WorkerRequest>) => {
  if (event.data.type === "render") pendingRender = event.data;
  else if (event.data.type === "thumb") thumbs.set(event.data.style, event.data);
  else exports.push(event.data);
  void drain();
};
