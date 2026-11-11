// Foja's LaTeX worker, for styles imported from LaTeX templates. It runs BusyTeX's engines (TeX Live 2026's programs
// in one WebAssembly module, AGPL-3.0, https://github.com/TeXlyre/texlyre-busytex, unchanged), one engine per worker,
// picked with ?engine=: pdftex for pdfLaTeX, xetex for XeLaTeX, whose .xdv xdvipdfmx turns into a PDF in the same
// worker. The engine and the TeX Live files it may read (pdftex.tar.gz, xetex.tar.gz, with LaTeX's format already
// made) come from this site, next to this file, and stay in Cache Storage after the first time. While compiling,
// the engine reaches no network: every file it may ask for was put in its memory file system first, its lookups on a
// TeX Live server are off, and a file that is not there is not found. There is no shell either: \write18 is refused
// and has nothing to run in WebAssembly.
// scripts/latex-assets.sh fetches the engine, makes the .tar.gz files and writes version.txt.
"use strict";

const BASE = new URL("./", self.location.href).href;
const ENGINE = new URL(self.location.href).searchParams.get("engine") === "xetex" ? "xetex" : "pdftex";
const FILES = BASE + ENGINE + ".tar.gz";
const SCRIPT = BASE + "busytex.js";
const WASM = BASE + "busytex.wasm";

// The same places and settings as scripts/latex/formats.mjs, which made the format and checked these files.
const ROOT = "/texlive";
const WORK = "/work";
const ENV = {
  TEXMFDIST: `${ROOT}/texmf-dist`,
  TEXMFCNF: `${ROOT}/texmf-dist/web2c`,
  TEXMFVAR: "/tmp/texmf-var",
  TEXMFCACHE: "/tmp/texmf-var",
  FONTCONFIG_PATH: ROOT,
  FONTCONFIG_FILE: `${ROOT}/fonts.conf`,
  ICU_DATA: `${ROOT}/`,
  TEXLIVE_REMOTE_ENDPOINT: "",
};
const FORMAT = { pdftex: "pdflatex", xetex: "xelatex" }[ENGINE];
// Without stopping at the first error: a template that names several fonts Foja lacks reports them all at once.
const RUN = ["--interaction=nonstopmode", "--no-shell-escape", "--fmt", `${ROOT}/${FORMAT}.fmt`];
// The engines keep their state in memory and do not reset it: each run starts from the memory they had after loading.
const HEADER = 2 ** 26;

// The engine would ask a TeX Live server for a file it lacks only with a server set (it is not); were it to try, the
// request finds nothing, at once.
self.XMLHttpRequest = class {
  open() {}
  send() {
    this.status = 404;
    this.response = null;
  }
  getResponseHeader() {
    return null;
  }
};

async function cached(cache, url) {
  let response = await cache.match(url);
  if (!response) {
    response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    await cache.put(url, response.clone());
  }
  return response;
}
const bytes = async (response) => new Uint8Array(await response.arrayBuffer());
// A server may already have taken the gzip off (Content-Encoding): only gzip data is unpacked.
async function gunzip(response) {
  const data = await bytes(response);
  if (data[0] !== 0x1f || data[1] !== 0x8b) return data;
  return bytes(new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("gzip"))));
}

// The files of a tar: plain ones, with long names in GNU's or in POSIX's way.
function* untar(data) {
  const text = new TextDecoder();
  const field = (h, from, to) => text.decode(h.subarray(from, to)).replace(/\0[\s\S]*$/, "");
  let long = null;
  for (let at = 0; at + 512 <= data.length; ) {
    const header = data.subarray(at, at + 512);
    if (header.every((b) => b === 0)) return;
    const size = parseInt(field(header, 124, 136).trim() || "0", 8);
    const type = header[156];
    at += 512;
    const body = data.subarray(at, at + size);
    at += Math.ceil(size / 512) * 512;
    if (type === 76) {
      long = text.decode(body).replace(/\0[\s\S]*$/, "");
      continue;
    }
    const prefix = field(header, 257, 262) === "ustar" ? field(header, 345, 500) : "";
    const name = long ?? (prefix ? prefix + "/" : "") + field(header, 0, 100);
    long = null;
    if (type === 48 || type === 0) yield [name.replace(/^\.\//, ""), body.slice()];
  }
}

/** The name of the files on the site now (a hash of them), or offline the newest ones kept. */
async function version() {
  try {
    const response = await fetch(BASE + "version.txt", { cache: "no-cache" });
    if (response.ok) return (await response.text()).trim();
  } catch {}
  const kept = (await caches.keys()).filter((key) => key.startsWith("foja-latex-"));
  if (kept.length) return kept[kept.length - 1].slice("foja-latex-".length);
  throw new Error("LaTeX has to be downloaded once, online");
}

let ready;
function prepare() {
  ready ??= (async () => {
    const name = "foja-latex-" + (await version());
    for (const key of await caches.keys()) if (key.startsWith("foja-latex-") && key !== name) await caches.delete(key);
    const cache = await caches.open(name);
    // In the cache, importScripts finds the engine's script offline too (through the service worker).
    const [wasm] = await Promise.all([cached(cache, WASM).then(bytes).then((data) => WebAssembly.compile(data)), cached(cache, SCRIPT)]);
    const files = await gunzip(await cached(cache, FILES));
    if (typeof busytex === "undefined") importScripts(SCRIPT);
    let out = "";
    const config = {
      thisProgram: "/bin/busytex",
      noInitialRun: true,
      print: (line) => (out += line + "\n"),
      printErr: (line) => (out += line + "\n"),
      instantiateWasm(imports, done) {
        WebAssembly.instantiate(wasm, imports).then(done);
        return {};
      },
      preRun: [() => Object.assign(config.ENV, ENV)],
    };
    const Module = await busytex(config);
    const { FS } = Module;
    // kpathsea finds its trees from where the program is.
    FS.mkdirTree("/bin");
    FS.writeFile("/bin/busytex", "");
    for (const [path, data] of untar(files)) {
      const at = `${ROOT}/${path}`;
      FS.mkdirTree(at.slice(0, at.lastIndexOf("/")));
      FS.writeFile(at, data);
    }
    FS.mkdirTree(WORK);
    const header = Module.HEAPU8.slice(0, HEADER);
    const run = (args) => {
      out = "";
      const open = new Set(FS.streams.filter(Boolean).map((stream) => stream.fd));
      let code;
      try {
        code = Module.callMain(args);
      } finally {
        for (const stream of FS.streams) if (stream && !open.has(stream.fd)) FS.close(stream);
        Module.HEAPU8.fill(0);
        Module.HEAPU8.set(header);
      }
      return { code, out };
    };
    return { FS, run };
  })();
  ready.catch(() => (ready = undefined));
  return ready;
}

function clear(FS, dir) {
  for (const entry of FS.readdir(dir)) {
    if (entry === "." || entry === "..") continue;
    const path = dir + "/" + entry;
    if (FS.isDir(FS.stat(path).mode)) {
      clear(FS, path);
      FS.rmdir(path);
    } else FS.unlink(path);
  }
}

const read = (FS, path, encoding) => (FS.analyzePath(path).exists ? FS.readFile(path, encoding ? { encoding } : undefined) : undefined);

async function compile({ files, main }) {
  const { FS, run } = await prepare();
  FS.chdir("/");
  clear(FS, WORK);
  for (const [path, content] of Object.entries(files)) {
    const at = `${WORK}/${path}`;
    FS.mkdirTree(at.slice(0, at.lastIndexOf("/")));
    FS.writeFile(at, content);
  }
  FS.chdir(WORK);
  const name = main.replace(/\.tex$/, "");
  let tex;
  try {
    tex = run(ENGINE === "pdftex" ? ["pdflatex", ...RUN, main] : ["xelatex", ...RUN, "--no-pdf", main]);
  } catch (e) {
    // A run that broke the engine (out of memory, say) leaves it unusable: the next job loads a new one.
    ready = undefined;
    throw e;
  }
  const log = read(FS, `${WORK}/${name}.log`, "utf8") ?? tex.out;
  const xdv = ENGINE === "xetex" ? read(FS, `${WORK}/${name}.xdv`) : undefined;
  let extra = "";
  if (xdv && tex.code === 0) {
    const pdf = run(["xdvipdfmx", "-o", `${name}.pdf`, `${name}.xdv`]);
    if (pdf.code !== 0) extra = "\n" + pdf.out;
  }
  const pdf = tex.code === 0 ? read(FS, `${WORK}/${name}.pdf`) : undefined;
  return { status: pdf ? 0 : tex.code || 1, log: log + extra, pdf, xdv };
}

async function handle(data) {
  try {
    if (data.cmd === "warm") {
      await prepare();
      self.postMessage({ id: data.id, status: 0, log: "" });
    } else if (data.cmd === "compile") {
      const made = await compile(data);
      self.postMessage({ id: data.id, ...made }, [made.pdf, made.xdv].filter(Boolean).map((b) => b.buffer));
    }
  } catch (e) {
    self.postMessage({ id: data.id, status: -1, log: String((e && (e.stack || e.message)) || e) });
  }
}

// One job at a time: the engine has one memory and one file system.
let queue = Promise.resolve();
self.onmessage = ({ data }) => {
  queue = queue.then(() => handle(data));
};
