#!/usr/bin/env node
// foja: build CVs from a Foja project.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import { migrate, validate, type Project } from "@foja/core";
import { detectLanguage, MESSAGES, systemLanguages, takeLanguage, type Language } from "./messages.ts";
import cli from "../package.json" with { type: "json" };

const { lang, rest: argv } = takeLanguage(process.argv.slice(2));
const m = MESSAGES[lang && lang in MESSAGES ? (lang as Language) : detectLanguage(systemLanguages())];
const USAGE = m.usage;

function fail(message: string, code = 1): never {
  console.error(message);
  process.exit(code);
}

function loadProject(path: string): Project {
  let value: unknown;
  try {
    value = migrate(JSON.parse(readFileSync(path, "utf8")));
  } catch (e) {
    fail(`${path}: ${(e as Error).message}`);
  }
  const problems = validate(value);
  for (const p of problems) console.error(`${path}${p.path}: ${p.message}`);
  if (problems.some((p) => p.severity === "error")) fail(`${path}: ${m.invalidProject}`);
  return value as Project;
}

const FORMATS = ["pdf", "svg", "typ", "tex", "md", "json", "jsonresume", "docx", "all"] as const;
type Format = (typeof FORMATS)[number];

async function build(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      profile: { type: "string", multiple: true },
      format: { type: "string", multiple: true },
      out: { type: "string", default: "." },
    },
  });
  if (positionals.length !== 1) fail(USAGE, 2);
  const project = loadProject(positionals[0]);
  const formats = (values.format ?? ["pdf"]) as Format[];
  for (const f of formats) if (!FORMATS.includes(f)) fail(`${m.unknownFormat(f)}\n${USAGE}`, 2);
  const profiles = values.profile ?? Object.keys(project.profiles);
  for (const id of profiles) if (!(id in project.profiles)) fail(m.noProfile(id));

  const { Typst, templateFiles, wordFonts } = await import("./typst.ts");
  const { bundleExports, exportFiles, exportStem, latexStyleOf } = await import("@foja/core/export");
  const typst = new Typst(project);
  const inputs = { template: templateFiles(), wordFonts: wordFonts() };
  mkdirSync(values.out, { recursive: true });
  const write = (name: string, data: Uint8Array | string, note = "") => {
    const file = join(values.out, name);
    writeFileSync(file, data);
    console.log(file + note);
  };
  for (const id of profiles) {
    // A LaTeX template needs LaTeX, which the editor has and this command does not: its profile
    // gets the filled .tex and the formats that need no compiler.
    const latex = !!latexStyleOf(project, id);
    const wanted = latex ? formats.filter((f) => f !== "pdf" && f !== "svg" && f !== "typ") : formats;
    if (latex && (wanted.length < formats.length || formats.includes("all"))) console.error(m.latexStyle(id));
    const doc = !latex && wanted.some((f) => f === "pdf" || f === "svg" || f === "all") ? typst.compile(id) : undefined;
    const pages = doc ? m.pages(doc.numOfPages) : "";
    const stem = exportStem(project, id);
    for (const format of wanted) {
      if (format === "pdf") write(`${stem}.pdf`, typst.pdf(doc!), pages);
      else if (format === "svg") write(`${stem}.svg`, typst.svg(doc!), pages);
      else if (format === "all") {
        const files = doc ? [{ name: `${stem}.pdf`, mime: "application/pdf", data: new Uint8Array(typst.pdf(doc)) }] : [];
        for (const f of latex ? (["tex", "md", "json", "jsonresume", "docx"] as const) : (["typ", "tex", "md", "json", "jsonresume", "docx"] as const)) files.push(...(await exportFiles(project, id, f, inputs)));
        const bundle = bundleExports(project, id, files);
        write(bundle.name, bundle.data, ` (${files.map((f) => (f.name.startsWith(stem) ? f.name.slice(stem.length) : f.name)).join(", ")})`);
      } else
        for (const f of await exportFiles(project, id, format, inputs)) {
          write(f.name, f.data);
          if (f.left) console.error(m.jsonResumeLeft(f.name, f.left.join(", ")));
        }
    }
  }
}

async function main(argv: string[]) {
  const [command, ...rest] = argv;
  if (lang !== undefined && !(lang in MESSAGES)) fail(`${m.badLanguage(lang)}\n${USAGE}`, 2);
  if (command === "-h" || command === "--help" || command === "help") return console.log(USAGE);
  if (command === "-v" || command === "--version") return console.log(cli.version);
  if (command === "build") return build(rest);
  if (command === "validate") {
    if (rest.length !== 1) fail(USAGE, 2);
    const project = loadProject(rest[0]);
    console.log(`${rest[0]}: ${m.valid(Object.keys(project.profiles).length)}`);
    return;
  }
  if (command === "convert-curriculum") {
    const { values, positionals } = parseArgs({ args: rest, allowPositionals: true, options: { public: { type: "boolean" } } });
    if (positionals.length !== 2) fail(USAGE, 2);
    const { convertCurriculum } = await import("./convert.ts");
    const project = convertCurriculum(positionals[0], { publicFixture: values.public });
    const problems = validate(project);
    for (const p of problems) console.error(`converted${p.path}: ${p.message}`);
    writeFileSync(positionals[1], JSON.stringify(project, null, 2) + "\n");
    console.log(`${positionals[1]}: ${m.profiles(Object.keys(project.profiles).length)}`);
    return;
  }
  if (command === "import") {
    // The editor's importer without its review form: the rules' proposal, as is.
    const { values, positionals } = parseArgs({ args: rest, allowPositionals: true, options: { into: { type: "string" }, name: { type: "string" }, "no-style": { type: "boolean" } } });
    if (positionals.length !== 2) fail(USAGE, 2);
    const core = await import("@foja/core");
    const [source, out] = positionals;
    if (/\.json$/i.test(source)) {
      // A JSON Resume: its content, as is; it brings no look.
      let resume: unknown;
      try {
        resume = JSON.parse(readFileSync(source, "utf8"));
      } catch (e) {
        fail(`${source}: ${(e as Error).message}`);
      }
      if (!core.isJsonResume(resume)) fail(`${source}: ${m.notJsonResume}`);
      const into = values.into ? loadProject(values.into) : undefined;
      const name = values.name ?? (basename(source).replace(/\.json$/i, "").replace(/\.resume$/i, "") || "CV");
      const { project, profileId, entries } = core.fromJsonResume(resume, { name, language: into?.language ?? (m === MESSAGES.es ? "es" : "en"), into });
      writeFileSync(out, JSON.stringify(project, null, 2) + "\n");
      console.log(`${out}: ${m.imported(entries, profileId, "")}`);
      return;
    }
    const template = core.readTemplate(await core.readUpload(source, new Uint8Array(readFileSync(source))));
    const mapping = core.proposeMapping(template);
    const name = values.name ?? basename(source).replace(/\.(typ|tex|zip|tar\.gz|tgz)$/i, "");
    const into = values.into ? loadProject(values.into) : undefined;
    const { project, profileId, entries } = core.importData(template, mapping, { name, language: into?.language ?? (m === MESSAGES.es ? "es" : "en"), into });
    let style = "";
    if (template.missing.length) console.error(m.missingPackages(template.missing.join(", ")));
    else if (!values["no-style"]) {
      style = core.freshId(name, [...core.BUILTIN_STYLES.map((s) => s.id), ...Object.keys(project.templates ?? {})], "estilo");
      project.templates = { ...project.templates, [style]: core.importStyle(template, mapping, style, name) };
      project.profiles[profileId].layout = { template: style };
    }
    writeFileSync(out, JSON.stringify(project, null, 2) + "\n");
    console.log(`${out}: ${m.imported(entries, profileId, style)}`);
    return;
  }
  fail(USAGE, command ? 2 : 0);
}

main(argv).catch((e) => {
  // A bad option: Node's own message (in English), then the usage.
  if (String(e?.code).startsWith("ERR_PARSE_ARGS")) fail(`${e.message}\n${USAGE}`, 2);
  fail(e instanceof Error ? e.message : String(e));
});
