// A Typst CV template, read with parse.ts, and the one correspondence the user reviews: which
// argument of each macro is which field of a Foja entry, and which argument of the header is the
// name, the subtitle or a contact. The same correspondence works both ways: it turns the
// template's sample content into Foja data (importData), and it turns the template into a style of
// one's own that calls its macros with Foja's data (importStyle). Fixed rules only: a dictionary of
// argument names and regular expressions for dates, e-mails and URLs.

import { freshId } from "../select.ts";
import { toBase64 } from "../typst.ts";
import { CONTACT_KINDS, FORMAT, type Block, type ContactKind, type CustomTemplate, type Entry, type Item, type Project } from "../types.ts";
import { parseTypst, type Arg, type Call, type ParsedFile } from "./parse.ts";

export type EntryField = "title" | "place" | "period" | "start" | "end" | "note" | "items" | "omit";
export const ENTRY_FIELDS: EntryField[] = ["title", "place", "period", "start", "end", "note", "items", "omit"];
/** `keep` leaves the template's own value (a colour, a font); `omit` drops the argument. */
export type HeaderField = "name" | "subtitle" | ContactKind | "keep" | "omit";
export const HEADER_FIELDS: HeaderField[] = ["name", "subtitle", ...CONTACT_KINDS, "keep", "omit"];

export interface Mapping {
  header: Record<string, HeaderField>;
  /** Macro → argument key (`company`, `#0`, `#body`) → field. */
  macros: Record<string, Record<string, EntryField>>;
}

export interface Template {
  /** Text files by path (Typst sources, the licence, typst.toml…). */
  texts: Record<string, string>;
  /** Other files by path (pictures), fonts aside. */
  binaries: Record<string, Uint8Array>;
  /** The file with the sample content. */
  main: string;
  parsed: ParsedFile;
  /** The header call: the `#show: x.with(...)`, or a call before the first heading. */
  header?: Call;
  /** Whether the header came as `#show: x.with(...)` (a show rule over the whole CV) or as a call. */
  headerShows: boolean;
  /** The template's macros, with every sample call. */
  macros: Record<string, Call[]>;
  /** `@preview` packages, by `name:version`, found in the upload: their entrypoint. */
  packages: Record<string, string>;
  /** `@preview` packages imported but not in the upload. */
  missing: string[];
  /** Font files left out: Foja's compiler only has its own fonts. */
  fonts: string[];
  license?: string;
}

const TEXT = /\.(typ|toml|txt|md|bib|ya?ml|json|csv|xml|svg)$|(^|\/)(LICEN[CS]E|COPYING|NOTICE)[^/]*$/i;
const FONT = /\.(ttf|otf|woff2?)$/i;
const decoder = new TextDecoder();

/** Reads the files of an upload: picks the main file, its macros and its header. */
export function readTemplate(files: Record<string, Uint8Array>): Template {
  const texts: Record<string, string> = {};
  const binaries: Record<string, Uint8Array> = {};
  const fonts: string[] = [];
  for (const [path, data] of Object.entries(files)) {
    if (FONT.test(path)) fonts.push(path);
    else if (TEXT.test(path)) texts[path] = decoder.decode(data);
    else binaries[path] = data;
  }
  const parsed = Object.fromEntries(Object.entries(texts).filter(([p]) => p.endsWith(".typ")).map(([p, s]) => [p, parseTypst(s)]));
  const score = (p: ParsedFile) => p.sections.length * 3 + [...p.preamble, ...p.sections.flatMap((s) => s.blocks)].filter((b) => b.kind === "call").length + (p.header ? 5 : 0);
  const main = Object.keys(parsed).sort((a, b) => score(parsed[b]) - score(parsed[a]) || a.split("/").length - b.split("/").length)[0];
  if (!main) throw new Error("no .typ file in the upload");
  const file = parsed[main];

  let header = file.header;
  const calls = [...file.preamble, ...file.sections.flatMap((s) => s.blocks)].flatMap((b) => (b.kind === "call" ? [b.call] : []));
  if (!header) header = file.preamble.flatMap((b) => (b.kind === "call" ? [b.call] : [])).find((c) => c.args.some((a) => headerByName(a.key) === "name" || EMAIL.test(a.text)));
  const macros: Record<string, Call[]> = {};
  for (const c of calls) if (c !== header) (macros[c.fn] ??= []).push(c);

  const packages: Record<string, string> = {};
  for (const [path, text] of Object.entries(texts)) {
    if (!path.endsWith("typst.toml")) continue;
    const field = (k: string) => new RegExp(`^\\s*${k}\\s*=\\s*"([^"]+)"`, "m").exec(text)?.[1];
    const [name, version, entry] = [field("name"), field("version"), field("entrypoint")];
    if (name && entry) packages[`${name}:${version ?? ""}`] = join(dirname(path), entry);
  }
  const wanted = new Set(Object.values(texts).flatMap((s) => [...s.matchAll(/"@preview\/([a-z0-9-]+):([0-9.]+)"/g)].map((m) => `${m[1]}:${m[2]}`)));
  const missing = [...wanted].filter((p) => !findPackage(packages, p));
  const license = Object.keys(texts).find((p) => /(^|\/)(LICEN[CS]E|COPYING)[^/]*$/i.test(p));
  return { texts, binaries, main, parsed: file, header, headerShows: !!file.header, macros, packages, missing, fonts, license };
}

const dirname = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
const join = (dir: string, p: string) => (dir ? `${dir}/${p}` : p).replace(/(^|\/)\.\//g, "$1");
/** A package of the upload by `name:version`, or by name alone when the version differs. */
const findPackage = (packages: Record<string, string>, spec: string) => packages[spec] ?? Object.entries(packages).find(([k]) => k.split(":")[0] === spec.split(":")[0])?.[1];

// ---------------------------------------------------------------- the proposal

const norm = (k: string) => k.toLowerCase().replace(/[-_ ]/g, "");
const ENTRY_NAMES: [EntryField, string[]][] = [
  ["title", ["title", "position", "role", "degree", "job", "jobtitle", "puesto", "cargo", "titulo", "carrera", "rol", "name", "nombre", "project", "proyecto"]],
  ["place", ["company", "institution", "organization", "organisation", "org", "school", "university", "employer", "empresa", "institucion", "organizacion", "escuela", "universidad", "lugar", "place"]],
  ["period", ["dates", "date", "period", "duration", "time", "when", "fechas", "fecha", "periodo"]],
  ["start", ["start", "from", "startdate", "begin", "desde", "inicio"]],
  ["end", ["end", "to", "enddate", "until", "hasta", "fin"]],
  ["note", ["description", "details", "summary", "info", "note", "gpa", "descripcion", "detalle", "nota", "subtitle", "location", "city", "ubicacion", "ciudad"]],
  ["items", ["items", "bullets", "highlights", "tasks", "achievements", "responsibilities", "points", "tareas", "logros"]],
];
const HEADER_NAMES: [HeaderField, string[]][] = [
  ["name", ["name", "author", "fullname", "nombre", "autor"]],
  ["subtitle", ["title", "subtitle", "role", "position", "tagline", "headline", "jobtitle", "puesto", "titulo"]],
  ["email", ["email", "mail", "correo"]],
  ["phone", ["phone", "tel", "telephone", "mobile", "cell", "telefono", "celular"]],
  ["linkedin", ["linkedin"]],
  ["github", ["github"]],
  ["website", ["website", "site", "web", "url", "homepage", "personalsite", "portfolio", "pagina"]],
  ["location", ["location", "address", "city", "ubicacion", "direccion", "ciudad"]],
];
const byName = <F>(table: [F, string[]][], key: string) => table.find(([, names]) => names.includes(norm(key)))?.[0];
const headerByName = (key: string) => byName(HEADER_NAMES, key);

export const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
export const URL_RE = /^(https?:\/\/|www\.)\S+$|^[a-z0-9-]+(\.[a-z0-9-]+)+\/\S*$/i;
const PHONE = /^\+?[\d\s().-]{7,}$/;

const MONTHS: Record<string, number> = Object.fromEntries(
  [
    ["jan january ene enero", 1],
    ["feb february febrero", 2],
    ["mar march marzo", 3],
    ["apr april abr abril", 4],
    ["may mayo", 5],
    ["jun june junio", 6],
    ["jul july julio", 7],
    ["aug august ago agosto", 8],
    ["sep sept september set septiembre setiembre", 9],
    ["oct october octubre", 10],
    ["nov november noviembre", 11],
    ["dec december dic diciembre", 12],
  ].flatMap(([names, n]) => (names as string).split(" ").map((name) => [name, n])),
);
const PRESENT = /^(present|current|now|ongoing|today|actualidad|presente|actual|hoy|la fecha|en curso)$/i;

/** `Aug 2019`, `agosto de 2019`, `08/2019`, `2019-08` or `2019` as `YYYY-MM`; null for "present";
 * undefined when it is not a date. */
export function parseMonth(raw: string): string | null | undefined {
  const s = raw.trim().replace(/\.$/, "").toLowerCase();
  if (PRESENT.test(s)) return null;
  let m: RegExpExecArray | null;
  if ((m = /^(\d{4})-(\d{1,2})$/.exec(s))) return `${m[1]}-${m[2].padStart(2, "0")}`;
  if ((m = /^(\d{1,2})\/(\d{4})$/.exec(s))) return `${m[2]}-${m[1].padStart(2, "0")}`;
  if ((m = /^([a-záéíóú]+)\.?\s+(?:de\s+)?(\d{4})$/.exec(s)) && MONTHS[m[1]]) return `${m[2]}-${String(MONTHS[m[1]]).padStart(2, "0")}`;
  if ((m = /^(\d{4})$/.exec(s))) return `${m[1]}-01`;
  return undefined;
}

/** A period such as `Aug 2019 – May 2023`, `2019-2021` or `03/2020 - Present`; undefined when it
 * is not one. */
export function parsePeriod(raw: string): { start: string; end?: string | null } | undefined {
  const s = raw.trim();
  const years = /^(\d{4})\s*-\s*(\d{4})$/.exec(s);
  const parts = years ? [years[1], years[2]] : s.split(/\s*[–—]\s*|\s+-\s+|\s+(?:to|a|al|hasta)\s+/i);
  if (parts.length === 1) {
    const one = parseMonth(parts[0]);
    return one ? { start: one } : undefined;
  }
  if (parts.length !== 2) return undefined;
  const [start, end] = parts.map(parseMonth);
  return start && end !== undefined ? { start, end } : undefined;
}

/** Every argument key of a macro's calls, in the order they first appear, with a sample value. */
export function macroArgs(calls: Call[]): { key: string; sample: Arg }[] {
  const seen = new Map<string, Arg>();
  for (const c of calls) for (const a of c.args) if (!seen.has(a.key) || (!seen.get(a.key)!.text && a.text)) seen.set(a.key, a);
  return [...seen].map(([key, sample]) => ({ key, sample }));
}

/** What the rules propose; the user corrects it in the review form. */
export function proposeMapping(t: Template): Mapping {
  const header: Record<string, HeaderField> = {};
  for (const a of t.header?.args ?? []) {
    const v = a.text;
    header[a.key] =
      headerByName(a.key) ??
      (EMAIL.test(v) ? "email" : /linkedin\.com/i.test(v) ? "linkedin" : /github\.com/i.test(v) ? "github" : URL_RE.test(v) ? "website" : PHONE.test(v) && /\d{6}/.test(v.replace(/\D/g, "")) ? "phone" : "keep");
  }
  const macros: Record<string, Record<string, EntryField>> = {};
  for (const [fn, calls] of Object.entries(t.macros)) {
    const fields: Record<string, EntryField> = {};
    const taken = new Set<EntryField>();
    const args = macroArgs(calls);
    for (const { key } of args) {
      const f = key.startsWith("#") ? undefined : byName(ENTRY_NAMES, key);
      if (f) {
        fields[key] = f;
        taken.add(f);
      }
    }
    for (const { key, sample } of args) {
      if (fields[key]) continue;
      let f: EntryField = "omit";
      if (sample.list && !taken.has("items")) f = "items";
      else if (parsePeriod(sample.text) && !taken.has("period") && !taken.has("start")) f = "period";
      else if (key.startsWith("#") && sample.text && !EMAIL.test(sample.text) && !URL_RE.test(sample.text)) {
        f = !taken.has("title") ? "title" : !taken.has("place") ? "place" : !taken.has("note") ? "note" : "omit";
      }
      fields[key] = f;
      if (f !== "omit") taken.add(f);
    }
    macros[fn] = fields;
  }
  return { header, macros };
}

// ---------------------------------------------------------------- data

const SUMMARY = /^(summary|profile|about( me)?|objective|resumen|perfil|sobre m[ií]|objetivo)$/i;

export interface ImportedData {
  project: Project;
  profileId: string;
  /** Entries made, by section. */
  entries: number;
}

/** The template's sample content as Foja data: a new project, or a new profile (and its entries)
 * added to `into`, whose person and contacts are kept. */
export function importData(t: Template, mapping: Mapping, options: { name: string; language: string; into?: Project }): ImportedData {
  const p: Project = options.into
    ? structuredClone(options.into)
    : { format: FORMAT, language: options.language, person: { givenNames: [], familyNames: [], photo: null }, contacts: {}, skills: {}, entries: {}, profiles: {} };
  let subtitle = "";
  const contacts: ContactKind[] = [];
  for (const a of t.header?.args ?? []) {
    const f = mapping.header[a.key];
    if (!a.text || !f || f === "keep" || f === "omit") continue;
    if (f === "name") {
      if (!options.into) {
        const words = a.text.split(/\s+/);
        p.person = { givenNames: words.length > 1 ? words.slice(0, -1) : words, familyNames: words.length > 1 ? words.slice(-1) : [], photo: null };
      }
    } else if (f === "subtitle") subtitle = a.text;
    else {
      if (!p.contacts[f]) p.contacts[f] = a.text;
      contacts.push(f);
    }
  }
  if (!options.into && p.person.givenNames.length === 0) p.person.givenNames = [options.name];

  let summary = "";
  let made = 0;
  const sectionIds = new Set<string>();
  const sections = t.parsed.sections.flatMap((s) => {
    const texts = s.blocks.filter((b) => b.kind === "text");
    if (SUMMARY.test(s.title) && texts.length === s.blocks.length) {
      summary = texts.map((b) => (b.kind === "text" ? b.text : "")).join(" ");
      return [];
    }
    const blocks: Block[] = s.blocks.flatMap((b): Block[] => {
      if (b.kind === "item") return [{ type: "item", text: b.text }];
      if (b.kind === "text") return [{ type: "paragraph", text: b.text }];
      const fields = mapping.macros[b.call.fn];
      if (!fields || Object.values(fields).every((f) => f === "omit")) return [];
      const entry = entryOf(b.call, fields);
      const id = freshId(`${entry.title} ${entry.place ?? ""}`, Object.keys(p.entries), "entry");
      p.entries[id] = entry;
      made++;
      return [{ type: "entry", entry: id }];
    });
    const id = freshId(s.title, sectionIds, "section");
    sectionIds.add(id);
    return [{ id, title: s.title || id, blocks }];
  });
  if (!summary) summary = t.parsed.preamble.flatMap((b) => (b.kind === "text" ? [b.text] : [])).join(" ");
  const profileId = freshId(options.name, Object.keys(p.profiles), "profile");
  p.profiles[profileId] = { name: options.name, subtitle: subtitle || options.name, contacts: [...new Set(contacts)], skills: [], summary, sections };
  return { project: p, profileId, entries: made };
}

/** One call as an entry, by the mapping of its macro. */
export function entryOf(call: Call, fields: Record<string, EntryField>): Entry {
  const get = (field: EntryField) => call.args.filter((a) => fields[a.key] === field && a.text);
  const text = (field: EntryField) => get(field).map((a) => a.text).join(", ");
  const e: Entry = { title: text("title") || text("place") || "—" };
  if (text("title") && text("place")) e.place = text("place");
  const notes: string[] = [];
  const period = text("period") ? parsePeriod(text("period")) : undefined;
  if (period) {
    e.start = period.start;
    if (period.end !== undefined) e.end = period.end;
  } else if (text("period")) notes.push(text("period"));
  const start = text("start") ? parseMonth(text("start")) : undefined;
  if (start) {
    e.start = start;
    const end = text("end") ? parseMonth(text("end")) : undefined;
    if (end !== undefined) e.end = end;
  }
  if (text("note")) notes.push(text("note"));
  if (notes.length) e.note = notes.join(" · ");
  const lines = [...get("items").flatMap((a) => a.list ?? a.text.split(/\s*\n\s*/)), ...call.items].filter(Boolean);
  if (lines.length) {
    const taken: string[] = [];
    e.items = lines.map((line): Item => {
      const id = freshId(line, taken);
      taken.push(id);
      return { id, text: line };
    });
  }
  return e;
}

// ---------------------------------------------------------------- the look

/** Where a template's file lives for the compiler, next to the style at /custom/<id>.typ. */
export const customFilePath = (id: string, path: string) => `/custom/${id}/${path}`;

/** The template as a style of one's own: its files (imports of `@preview` packages that came in the
 * upload pointed at them) and a source that calls its macros with Foja's data. */
export function importStyle(t: Template, mapping: Mapping, id: string, name: string): CustomTemplate {
  const base = (path: string) => customFilePath(id, path);
  // `@preview` packages that came in the upload and absolute paths point into the template's
  // folder; relative paths too, for code moved out of it (`dir` is where that code was).
  const rewrite = (source: string, dir?: string) =>
    source.replace(/(#(?:import|include)\s+)"([^"]+)"/g, (whole, lead, target: string) => {
      if (target.startsWith("@preview/")) {
        const found = findPackage(t.packages, target.slice("@preview/".length));
        return found ? `${lead}"${base(found)}"` : whole;
      }
      if (target.startsWith("/")) return `${lead}"${base(target.slice(1))}"`;
      return dir === undefined ? whole : `${lead}"${base(join(dir, target))}"`;
    });
  const files: Record<string, string> = {};
  for (const [path, text] of Object.entries(t.texts)) files[path] = path.endsWith(".typ") ? rewrite(text) : text;

  const mainDir = dirname(t.main);
  const used = new Set([...Object.keys(mapping.macros).filter((m) => Object.values(mapping.macros[m]).some((f) => f !== "omit")), ...(t.header ? [t.header.fn] : [])]);
  const imports = t.parsed.imports.filter((s) => s.startsWith("#import")).map((s) => rewrite(s, mainDir));
  // The main file's own definitions (its macros, or what its rules use) go to a file of their
  // own, without the sample content.
  if (t.parsed.lets.length) {
    const defs = join(mainDir, "foja-defs.typ");
    files[defs] = [...t.parsed.imports.filter((s) => s.startsWith("#import")).map((s) => rewrite(s, mainDir)), ...t.parsed.lets].join("\n") + "\n";
    imports.push(`#import "${base(defs)}": *`);
  }

  const headerArgs = (t.header?.args ?? []).flatMap((a) => {
    const f = mapping.header[a.key] ?? "keep";
    if (f === "omit") return a.key.startsWith("#") ? ['""'] : [];
    const value = f === "keep" ? rewrite(a.raw, mainDir) : f === "name" ? "cv.name" : f === "subtitle" ? "cv.subtitle" : `foja-contact("${f}")`;
    return [a.key.startsWith("#") ? value : `${a.key}: ${value}`];
  });

  // The macro each section used, by the section ids importData gives (same rule, same order).
  const sectionMacro: Record<string, string> = {};
  const ids = new Set<string>();
  let level: number | undefined;
  for (const s of t.parsed.sections) {
    if (SUMMARY.test(s.title) && s.blocks.every((b) => b.kind === "text")) continue;
    const sid = freshId(s.title, ids, "section");
    ids.add(sid);
    const call = s.blocks.find((b) => b.kind === "call" && used.has(b.call.fn));
    if (call?.kind === "call") {
      sectionMacro[sid] = call.call.fn;
      level ??= s.level;
    }
  }
  level ??= t.parsed.sections[0]?.level ?? 2;
  const entryMacros = Object.keys(mapping.macros).filter((m) => m !== t.header?.fn && Object.values(mapping.macros[m]).some((f) => f !== "omit"));
  const counts = entryMacros.map((m) => [m, t.macros[m]?.length ?? 0] as const).sort((a, b) => b[1] - a[1]);
  const summaryTitle = t.parsed.sections.find((s) => SUMMARY.test(s.title))?.title;

  const expr: Record<Exclude<EntryField, "omit">, string> = {
    title: "b.title",
    place: "b.place",
    period: "b.period",
    start: "foja-start(b)",
    end: "foja-end(b)",
    note: '(if b.note == none { "" } else { b.note })',
    items: "b.items.map(item-body)",
  };
  const closures = entryMacros.map((m) => {
    const fields = mapping.macros[m];
    const args = macroArgs(t.macros[m] ?? []);
    const named = args.filter((a) => !a.key.startsWith("#") && fields[a.key] && fields[a.key] !== "omit").map((a) => `${a.key}: ${expr[fields[a.key] as Exclude<EntryField, "omit">]}`);
    const positional = args.filter((a) => /^#\d+$/.test(a.key)).map((a) => (fields[a.key] && fields[a.key] !== "omit" ? expr[fields[a.key] as Exclude<EntryField, "omit">] : '""'));
    const bodies = args
      .filter((a) => a.key.startsWith("#body"))
      .map((a) => {
        const f = fields[a.key];
        return f === "items" ? "[#list(..b.items.map(item-body))]" : f && f !== "omit" ? `[#${expr[f]}]` : "[]";
      });
    const itemsInArgs = Object.values(fields).includes("items");
    const call = `${m}(${[...positional, ...named].join(", ")})${bodies.join("")}`;
    const after = itemsInArgs ? "" : "\n    if b.items.len() > 0 { list(..b.items.map(item-body)) }";
    return `  "${m}": b => {\n    ${call}${after}\n  },`;
  });

  const source = [
    `// ${name}: a template imported into Foja. Its own files are next to this one, under`,
    `// /custom/${id}/; this file calls its macros with the CV's data (docs/templates.md).`,
    `#import "/lib.typ": *`,
    ...imports,
    ...t.parsed.rules.map((r) => rewrite(r, mainDir)),
    "",
    `#let foja-contact(kind) = { let c = cv.contacts.find(c => c.kind == kind); if c == none { "" } else { c.value } }`,
    `#let foja-start(b) = month(project.entries.at(b.id).at("start", default: ""))`,
    `#let foja-end(b) = { let e = project.entries.at(b.id); if "end" not in e { "" } else if e.end == none { labels.present } else { month(e.end) } }`,
    `#let foja-entry = (`,
    ...closures,
    `)`,
    `#let foja-section-macro = (${Object.entries(sectionMacro).map(([s, m]) => `"${s}": "${m}"`).join(", ")}${Object.keys(sectionMacro).length ? "," : ":"})`,
    "",
    t.header
      ? t.headerShows
        ? `#show: ${t.header.fn}.with(${headerArgs.join(", ")})`
        : `#anchored("name", ${t.header.fn}(${headerArgs.join(", ")}))`
      : `#anchored("name", text(size: 2em, weight: "bold", cv.name))\n#anchored("subtitle", par(cv.subtitle))\n#anchored("contacts", par(cv.contacts.map(contact-text).join(" · ")))`,
    "",
    `#if cv.summary != "" { heading(level: ${level}, ${summaryTitle ? JSON.stringify(summaryTitle) : "labels.profile"}); anchored("summary", par(inline(cv.summary))) }`,
    `#for s in cv.sections {`,
    `  anchored(s.path, {`,
    `    heading(level: ${level}, s.title)`,
    `    for b in s.blocks {`,
    `      anchored(b.path, if b.type == "entry" {`,
    counts.length
      ? `        foja-entry.at(foja-section-macro.at(s.id, default: "${counts[0][0]}"))(b)`
      : `        [*#b.title* #h(1fr) #b.period \\ #b.place]`,
    `      } else if b.type == "item" { list(item-body(b)) } else { par(inline(b.text)) })`,
    `    }`,
    `  })`,
    `}`,
    "",
  ].join("\n");

  const binaries = Object.fromEntries(Object.entries(t.binaries).map(([p, d]) => [p, toBase64(d)]));
  return { name, source, files, ...(Object.keys(binaries).length ? { binaries } : {}), ...(t.license ? { license: t.license } : {}) };
}
