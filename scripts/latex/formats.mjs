// Makes LaTeX's format with BusyTeX's engine and checks the set of files the editor's LaTeX worker gets
// (scripts/latex/collect.sh runs it):
//   node formats.mjs <engine folder> <pdftex|xetex> <stage> <pack> <documents> [fonts]
// With every file the format needs (<stage>), it makes pdflatex.fmt or xelatex.fmt into <pack>. Then, in a new engine
// with nothing but <pack>, it compiles each .tex of <documents> as the worker does (with the fonts of [fonts] among
// the document's files), and stops with LaTeX's log if one gives no PDF.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, join, relative } from "node:path";

const [engineDir, engine, stageDir, packDir, docsDir, fontsDir] = process.argv.slice(2);
const busytex = createRequire(import.meta.url)(join(engineDir, "busytex.js"));
const wasm = await WebAssembly.compile(readFileSync(join(engineDir, "busytex.wasm")));

// The same places and settings as public/latex/worker.js.
const ROOT = "/texlive";
const WORK = "/work";
const HEADER = 2 ** 26;
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
const FORMAT = { pdftex: "pdflatex", xetex: "xelatex" }[engine];
const INI = {
  pdftex: ["pdflatex", "-ini", "-jobname=pdflatex", "-translate-file=cp227.tcx", "*pdflatex.ini"],
  xetex: ["xelatex", "-ini", "-etex", "-jobname=xelatex", "xelatex.ini"],
}[engine];
// Without stopping at the first error: a template that names several fonts Foja lacks reports them all at once.
const RUN = ["--interaction=nonstopmode", "--no-shell-escape", "--fmt", `${ROOT}/${FORMAT}.fmt`];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

async function start(files) {
  let out = "";
  const config = {
    thisProgram: "/bin/busytex",
    noInitialRun: true,
    print: (text) => (out += text + "\n"),
    printErr: (text) => (out += text + "\n"),
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
  for (const path of walk(files)) {
    const at = `${ROOT}/${relative(files, path)}`;
    FS.mkdirTree(at.slice(0, at.lastIndexOf("/")));
    FS.writeFile(at, readFileSync(path));
  }
  FS.mkdirTree(WORK);
  FS.chdir(WORK);
  // The engines keep their state in memory and do not reset it: each run starts from the memory they had here.
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
}

const fail = (what, FS, log, out) => {
  const text = (log && FS.analyzePath(log).exists ? FS.readFile(log, { encoding: "utf8" }) + "\n" : "") + out;
  console.error(`${engine}: ${what} failed\n${text.split("\n").slice(-40).join("\n")}`);
  process.exit(1);
};

const stage = await start(stageDir);
const made = stage.run(INI);
if (!stage.FS.analyzePath(`${WORK}/${FORMAT}.fmt`).exists) fail("the format", stage.FS, `${WORK}/${FORMAT}.log`, made.out);
writeFileSync(join(packDir, `${FORMAT}.fmt`), stage.FS.readFile(`${WORK}/${FORMAT}.fmt`));

const pack = await start(packDir);
const { FS, run } = pack;
if (fontsDir) {
  FS.mkdirTree(`${WORK}/fonts`);
  for (const font of readdirSync(fontsDir).filter((f) => /\.(otf|ttf)$/i.test(f))) FS.writeFile(`${WORK}/fonts/${font}`, readFileSync(join(fontsDir, font)));
}
for (const doc of readdirSync(docsDir).filter((f) => f.endsWith(".tex"))) {
  const name = basename(doc, ".tex");
  FS.writeFile(`${WORK}/${doc}`, readFileSync(join(docsDir, doc)));
  const tex = run(engine === "pdftex" ? ["pdflatex", ...RUN, doc] : ["xelatex", ...RUN, "--no-pdf", doc]);
  if (engine === "xetex" && tex.code === 0) {
    const pdf = run(["xdvipdfmx", "-o", `${name}.pdf`, `${name}.xdv`]);
    if (!FS.analyzePath(`${WORK}/${name}.pdf`).exists) fail(`xdvipdfmx on ${doc}`, FS, "", pdf.out);
  }
  if (tex.code !== 0 || !FS.analyzePath(`${WORK}/${name}.pdf`).exists) fail(doc, FS, `${WORK}/${name}.log`, tex.out);
  console.log(`${engine}: ${doc} → ${FS.stat(`${WORK}/${name}.pdf`).size} bytes of PDF`);
}
