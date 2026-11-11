#!/usr/bin/env node
// foja: build CVs from a Foja project.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { migrate, validate, type Project } from "@foja/core";
import { detectLanguage, MESSAGES, systemLanguages, takeLanguage, type Language } from "./messages.ts";

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

const FORMATS = ["pdf", "svg", "typ", "tex", "md", "json", "docx", "all"] as const;
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

  const { Typst, templateFiles } = await import("./typst.ts");
  const { bundleExports, exportFiles, exportStem } = await import("@foja/core/export");
  const typst = new Typst(project);
  const template = templateFiles();
  mkdirSync(values.out, { recursive: true });
  const write = (name: string, data: Uint8Array | string, note = "") => {
    const file = join(values.out, name);
    writeFileSync(file, data);
    console.log(file + note);
  };
  for (const id of profiles) {
    const doc = formats.some((f) => f === "pdf" || f === "svg" || f === "all") ? typst.compile(id) : undefined;
    const pages = doc ? m.pages(doc.numOfPages) : "";
    const stem = exportStem(project, id);
    for (const format of formats) {
      if (format === "pdf") write(`${stem}.pdf`, typst.pdf(doc!), pages);
      else if (format === "svg") write(`${stem}.svg`, typst.svg(doc!), pages);
      else if (format === "all") {
        const files = [{ name: `${stem}.pdf`, mime: "application/pdf", data: new Uint8Array(typst.pdf(doc!)) }];
        for (const f of ["typ", "tex", "md", "json", "docx"] as const) files.push(...(await exportFiles(project, id, f, template)));
        const bundle = bundleExports(project, id, files);
        write(bundle.name, bundle.data, ` (${files.map((f) => (f.name.startsWith(stem) ? f.name.slice(stem.length) : f.name)).join(", ")})`);
      } else for (const f of await exportFiles(project, id, format, template)) write(f.name, f.data);
    }
  }
}

async function main(argv: string[]) {
  const [command, ...rest] = argv;
  if (lang !== undefined && !(lang in MESSAGES)) fail(`${m.badLanguage(lang)}\n${USAGE}`, 2);
  if (command === "-h" || command === "--help" || command === "help") return console.log(USAGE);
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
  fail(USAGE, command ? 2 : 0);
}

main(argv).catch((e) => {
  // A bad option: Node's own message (in English), then the usage.
  if (String(e?.code).startsWith("ERR_PARSE_ARGS")) fail(`${e.message}\n${USAGE}`, 2);
  fail(e instanceof Error ? e.message : String(e));
});
