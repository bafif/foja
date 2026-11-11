// Foja's LaTeX worker, for styles imported from LaTeX templates. It runs the pdfTeX engine of
// SwiftLaTeX (WebAssembly, AGPL-3.0, https://github.com/SwiftLaTeX/SwiftLaTeX, release 20-02-2022,
// unchanged) on the TeX Live files of texlive.tar.gz. Both come from this site, next to this file,
// and stay in Cache Storage after the first time; the format LaTeX starts from is made here the
// first time and kept there too. While compiling, the engine reaches no network: every file it may
// ask for was put in its memory file system first, and a file that is not there is not found.
// There is no shell either: \write18 and the like have nothing to run in WebAssembly.
// scripts/latex-assets.sh makes texlive.tar.gz, fetches the engine and writes version.txt.
"use strict";

const BASE = new URL("./", self.location.href).href;
const FMT = BASE + "swiftlatexpdftex.fmt.gz";

// The engine answers through postMessage: its answer to the call in progress is caught here.
const post = self.postMessage.bind(self);
let answer = null;
let engineLoaded;
const loaded = new Promise((resolve) => (engineLoaded = resolve));
self.postMessage = (message, transfer) => {
  if (answer) {
    const resolve = answer;
    answer = null;
    resolve(message);
  } else if (message && message.result === "ok" && !message.cmd) engineLoaded();
  else post(message, transfer);
};
// The engine looks up a file it lacks with a request to a TeX Live server. Here every such lookup
// answers "not found" (the 301 the engine takes for it) at once, without the network.
self.XMLHttpRequest = class {
  open() {}
  send() {
    this.status = 301;
    this.response = null;
  }
  getResponseHeader() {
    return null;
  }
};

const engine = (routine) => new Promise((resolve) => {
  answer = resolve;
  routine();
});

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

function* untar(data) {
  const text = new TextDecoder();
  const field = (h, from, to) => text.decode(h.subarray(from, to)).replace(/\0[\s\S]*$/, "");
  for (let at = 0; at + 512 <= data.length; ) {
    const header = data.subarray(at, at + 512);
    if (header.every((b) => b === 0)) return;
    const size = parseInt(field(header, 124, 136).trim() || "0", 8);
    const type = header[156];
    at += 512;
    if (type === 48 || type === 0) yield [field(header, 0, 100).replace(/^\.\//, ""), data.slice(at, at + size)];
    at += Math.ceil(size / 512) * 512;
  }
}

// What the engine asks for: kpathsea's format number and the name, sometimes without its extension.
const FORMATS = { tfm: [3], pfb: [32], enc: [44], map: [11], vf: [33], fmt: [10] };
function register(name) {
  const path = "/tex/" + name;
  const ext = name.split(".").pop();
  for (const format of FORMATS[ext] || [26]) texlive200_cache[`${format}/${name}`] = path;
  if (ext === "tfm") texlive200_cache["3/" + name.slice(0, -4)] = path;
  if (ext === "tex") texlive200_cache["26/" + name.slice(0, -4)] = path;
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
    // In the cache, the engine's own requests find them offline (through the service worker).
    await cached(cache, BASE + "swiftlatexpdftex.wasm");
    await cached(cache, BASE + "swiftlatexpdftex.js");
    importScripts(BASE + "swiftlatexpdftex.js");
    self.onmessage = receive;
    await loaded;
    for (const [name, data] of untar(await gunzip(await cached(cache, BASE + "texlive.tar.gz")))) {
      if (name.includes("/")) continue;
      FS.writeFile("/tex/" + name, data);
      register(name);
    }
    let format = await cache.match(FMT);
    if (format) format = await gunzip(format);
    else {
      const made = await engine(compileFormatRoutine);
      if (made.status !== 0) throw new Error("the LaTeX format: " + made.log.slice(-800));
      format = new Uint8Array(made.pdf);
      await cache.put(FMT, new Response(new Blob([format]).stream().pipeThrough(new CompressionStream("gzip"))));
    }
    FS.writeFile("/tex/swiftlatexpdftex.fmt", format);
    register("swiftlatexpdftex.fmt");
  })();
  ready.catch(() => (ready = undefined));
  return ready;
}

async function compile({ files, main }) {
  await prepare();
  cleanDir(WORKROOT);
  for (const [path, content] of Object.entries(files)) {
    let dir = WORKROOT;
    for (const part of path.split("/").slice(0, -1)) {
      dir += "/" + part;
      try {
        FS.mkdir(dir);
      } catch {}
    }
    FS.writeFile(WORKROOT + "/" + path, content);
  }
  self.mainfile = main;
  const made = await engine(compileLaTeXRoutine);
  return { status: made.status, log: made.log, pdf: made.pdf ? new Uint8Array(made.pdf) : undefined };
}

async function handle(data) {
  try {
    if (data.cmd === "warm") {
      await prepare();
      post({ id: data.id, status: 0, log: "" });
    } else if (data.cmd === "compile") {
      const made = await compile(data);
      post({ id: data.id, ...made }, made.pdf ? [made.pdf.buffer] : []);
    }
  } catch (e) {
    post({ id: data.id, status: -1, log: String((e && (e.stack || e.message)) || e) });
  }
}

// One job at a time: the engine has one memory and one file system.
let queue = Promise.resolve();
function receive({ data }) {
  queue = queue.then(() => handle(data));
}
self.onmessage = receive;
