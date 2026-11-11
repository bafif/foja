// JSON Resume (https://jsonresume.org, schema 1.0.0), the open format for résumés, both ways.
// Importing makes a project: the entries of the bank, one profile with its sections, and the skills and the
// languages as skill groups. Exporting writes one profile as its PDF shows it (the same length and exceptions).
// JSON Resume has fixed sections: what a profile has that finds no place there is named in `left`, never dropped
// without a word.

import { slug } from "./project.ts";
import { resolveProfile, type ResolvedEntry } from "./resolve.ts";
import { freshId } from "./select.ts";
import { CONTACT_KINDS, FORMAT, type Asset, type Block, type ContactKind, type Entry, type Item, type Profile, type Project, type Section } from "./types.ts";

interface Dated {
  startDate?: string;
  endDate?: string;
}

/** The parts of JSON Resume that Foja reads and writes. Every field is optional, as in the schema. */
export interface JsonResume {
  $schema?: string;
  basics?: {
    name?: string;
    label?: string;
    /** A URL; Foja reads and writes only `data:` URLs (it never fetches anything). */
    image?: string;
    email?: string;
    phone?: string;
    url?: string;
    summary?: string;
    location?: { address?: string; postalCode?: string; city?: string; countryCode?: string; region?: string };
    profiles?: { network?: string; username?: string; url?: string }[];
  };
  work?: (Dated & { name?: string; position?: string; url?: string; summary?: string; highlights?: string[] })[];
  volunteer?: (Dated & { organization?: string; position?: string; url?: string; summary?: string; highlights?: string[] })[];
  education?: (Dated & { institution?: string; url?: string; area?: string; studyType?: string; score?: string; courses?: string[] })[];
  awards?: { title?: string; date?: string; awarder?: string; summary?: string }[];
  certificates?: { name?: string; date?: string; issuer?: string; url?: string; summary?: string }[];
  publications?: { name?: string; publisher?: string; releaseDate?: string; url?: string; summary?: string }[];
  skills?: { name?: string; level?: string; keywords?: string[] }[];
  languages?: { language?: string; fluency?: string }[];
  interests?: { name?: string; keywords?: string[] }[];
  references?: { name?: string; reference?: string }[];
  projects?: (Dated & { name?: string; description?: string; highlights?: string[]; url?: string; entity?: string })[];
  meta?: Record<string, unknown>;
}

export const JSON_RESUME_SCHEMA = "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json";

/** The sections of JSON Resume that hold a list, in the schema's order. */
type Kind = "work" | "volunteer" | "education" | "awards" | "certificates" | "publications" | "skills" | "languages" | "interests" | "references" | "projects";

/** Section titles of an imported résumé, by language of the project. */
const TITLES: Record<string, Record<Kind, string>> = {
  es: {
    work: "Experiencia",
    volunteer: "Voluntariado",
    education: "Formación",
    awards: "Premios",
    certificates: "Certificaciones",
    publications: "Publicaciones",
    skills: "Habilidades",
    languages: "Idiomas",
    interests: "Intereses",
    references: "Referencias",
    projects: "Proyectos",
  },
  en: {
    work: "Experience",
    volunteer: "Volunteering",
    education: "Education",
    awards: "Awards",
    certificates: "Certificates",
    publications: "Publications",
    skills: "Skills",
    languages: "Languages",
    interests: "Interests",
    references: "References",
    projects: "Projects",
  },
  pt: {
    work: "Experiência",
    volunteer: "Voluntariado",
    education: "Formação",
    awards: "Prêmios",
    certificates: "Certificações",
    publications: "Publicações",
    skills: "Habilidades",
    languages: "Idiomas",
    interests: "Interesses",
    references: "Referências",
    projects: "Projetos",
  },
};

/** Which JSON Resume section a Foja section or skill group goes to, by words of its id and title in Spanish,
 * English or Portuguese. Sections of entries that match none are work. */
const KINDS: [Kind, RegExp][] = [
  ["volunteer", /volunt/],
  ["education", /educa|formac|estudi|studies|academ|universi|escola|school/],
  ["projects", /proye|proje/],
  ["awards", /premi|award|honou?r|distinc|reconoc/],
  ["certificates", /certific|curso|course|licen[cs]e/],
  ["publications", /publica/],
  // Whole words: "Lenguajes" and "Programming languages" are skills.
  ["languages", /^(?!.*(program|codig|coding))(.*-)?(idiomas?|languages?|lenguas|linguas)(-.*)?$/],
  ["interests", /interes|interest|hobb/],
  ["references", /referen/],
  ["work", /experi|trabaj|trabalh|work|employ|emple|career|profes|docen|teach/],
];

function kindOf(...names: string[]): Kind | undefined {
  const words = slug(names.join(" "));
  return KINDS.find(([, pattern]) => pattern.test(words))?.[0];
}

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.map(text).filter(Boolean) : []);
const list = <T>(value: T[] | undefined): T[] => (Array.isArray(value) ? value.filter((v) => v && typeof v === "object") : []);

/** A JSON Resume, not a Foja project: no `format`, and some of its own sections. */
export function isJsonResume(value: unknown): value is JsonResume {
  if (!value || typeof value !== "object" || Array.isArray(value) || "format" in value) return false;
  return ["basics", "work", "education", "skills", "projects"].some((key) => key in value);
}

/** `2024-05-17`, `2024-05` or `2024` as Foja's month; a year alone is January of it, and says so. */
function monthOf(value: unknown): { month: string; yearOnly: boolean } | undefined {
  const m = /^(\d{4})(?:-(\d{2}))?/.exec(text(value));
  if (!m) return undefined;
  if (m[2] && (Number(m[2]) < 1 || Number(m[2]) > 12)) return undefined;
  return { month: `${m[1]}-${m[2] ?? "01"}`, yearOnly: !m[2] };
}

/** `https://www.linkedin.com/in/someone/` → `linkedin.com/in/someone`, as Foja writes its contacts. */
const bare = (url: string) => url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/+$/, "");

export interface ImportedResume {
  project: Project;
  profileId: string;
  /** How many entries went to the bank. */
  entries: number;
}

/** A JSON Resume as a Foja project, or added to `into` (its person and contacts stay; new ones fill gaps). */
export function fromJsonResume(resume: JsonResume, options: { name: string; language: string; into?: Project }): ImportedResume {
  const p: Project = options.into
    ? structuredClone(options.into)
    : { format: FORMAT, language: options.language, person: { givenNames: [], familyNames: [], photo: null }, contacts: {}, skills: {}, entries: {}, profiles: {} };
  const titles = TITLES[p.language.split("-")[0]] ?? TITLES.en;
  const basics = resume.basics && typeof resume.basics === "object" ? resume.basics : {};

  if (!options.into) {
    const words = text(basics.name).split(/\s+/).filter(Boolean);
    p.person.givenNames = words.length > 1 ? words.slice(0, -1) : words.length ? words : [options.name];
    p.person.familyNames = words.length > 1 ? words.slice(-1) : [];
    // A picture inside the file (what Foja exports); one on the web would have to be fetched, and Foja does not.
    const image = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/.exec(text(basics.image));
    if (image) {
      p.assets = { ...p.assets, photo: { type: image[1] as Asset["type"], data: image[2] } };
      p.person.photo = "photo";
    }
  }

  const contacts: Partial<Record<ContactKind, string>> = {};
  if (text(basics.email)) contacts.email = text(basics.email);
  if (text(basics.phone)) contacts.phone = text(basics.phone);
  if (text(basics.url)) contacts.website = bare(text(basics.url));
  const location = basics.location && typeof basics.location === "object" ? basics.location : {};
  const where = [location.address, location.city, location.region, location.countryCode].map(text).filter(Boolean).join(", ");
  if (where) contacts.location = where;
  for (const profile of list(basics.profiles)) {
    const network = slug(text(profile.network));
    const kind = network.includes("linkedin") ? "linkedin" : network.includes("github") ? "github" : undefined;
    if (!kind || contacts[kind]) continue;
    const user = text(profile.username);
    const url = text(profile.url) || (user ? `${kind === "linkedin" ? "linkedin.com/in" : "github.com"}/${user}` : "");
    if (url) contacts[kind] = bare(url);
  }
  for (const [kind, value] of Object.entries(contacts) as [ContactKind, string][]) p.contacts[kind] ??= value;

  let yearOnly = false;
  let made = 0;
  const month = (value: unknown) => {
    const m = monthOf(value);
    if (m?.yearOnly) yearOnly = true;
    return m?.month;
  };
  /** From–to; without an end the entry is ongoing, as JSON Resume means it. */
  const span = (entry: Entry, from: Dated) => {
    const start = month(from.startDate);
    const end = month(from.endDate);
    if (start) {
      entry.start = start;
      entry.end = end ?? null;
    } else if (end) entry.start = end;
    return entry;
  };
  const once = (entry: Entry, date: unknown) => {
    const at = month(date);
    if (at) entry.start = at;
    return entry;
  };
  const items = (lines: string[]): Item[] | undefined => {
    const taken: string[] = [];
    const out = lines.map((line) => {
      const id = freshId(line, taken, "item");
      taken.push(id);
      return { id, text: line };
    });
    return out.length ? out : undefined;
  };
  const entry = (title: string, place: string, note: string[], lines: string[] = []): Entry => {
    const e: Entry = { title: title || place || "—" };
    if (title && place) e.place = place;
    if (note.filter(Boolean).length) e.note = note.filter(Boolean).join(" · ");
    const its = items(lines);
    if (its) e.items = its;
    return e;
  };
  const toBank = (e: Entry): Block => {
    const id = freshId(`${e.title} ${e.place ?? ""}`, Object.keys(p.entries), "entry");
    p.entries[id] = e;
    made++;
    return { type: "entry", entry: id };
  };

  const sections: Section[] = [];
  const add = (kind: Kind, blocks: Block[], column?: "side") => {
    if (!blocks.length) return;
    const id = freshId(titles[kind], sections.map((s) => s.id), "section");
    sections.push({ id, title: titles[kind], ...(column ? { column } : {}), blocks });
  };
  add("work", list(resume.work).map((w) => toBank(span(entry(text(w.position), text(w.name), [text(w.summary)], strings(w.highlights)), w))));
  add("volunteer", list(resume.volunteer).map((v) => toBank(span(entry(text(v.position), text(v.organization), [text(v.summary)], strings(v.highlights)), v))));
  add(
    "education",
    list(resume.education).map((e) => toBank(span(entry([e.studyType, e.area].map(text).filter(Boolean).join(", "), text(e.institution), [text(e.score)], strings(e.courses)), e))),
  );
  add("projects", list(resume.projects).map((pr) => toBank(span(entry(text(pr.name), text(pr.entity), [text(pr.description), text(pr.url)], strings(pr.highlights)), pr))));
  add("awards", list(resume.awards).map((a) => toBank(once(entry(text(a.title), text(a.awarder), [text(a.summary)]), a.date))));
  add("certificates", list(resume.certificates).map((c) => toBank(once(entry(text(c.name), text(c.issuer), [text(c.summary), text(c.url)]), c.date))));
  add("publications", list(resume.publications).map((pu) => toBank(once(entry(text(pu.name), text(pu.publisher), [text(pu.summary), text(pu.url)]), pu.releaseDate))));
  const lines = (heading: string, body: string): Block[] => (heading || body ? [body && heading ? { type: "item", heading, text: body } : { type: "item", text: heading || body }] : []);
  add("interests", list(resume.interests).flatMap((i) => lines(text(i.name), strings(i.keywords).join(", "))), "side");
  add("references", list(resume.references).flatMap((r) => lines(text(r.name), text(r.reference))));

  // Skills with keywords are a group each; the ones without, and the languages, a group of lines.
  const rows: string[][] = [];
  const group = (title: string, texts: string[]) => {
    if (!texts.length) return;
    const id = freshId(title, Object.keys(p.skills), "skills");
    const taken: string[] = [];
    p.skills[id] = {
      title,
      items: texts.map((t) => {
        const sid = freshId(t, taken, "skill");
        taken.push(sid);
        return { id: sid, text: t };
      }),
    };
    rows.push([id]);
  };
  const skills = list(resume.skills);
  for (const s of skills) if (strings(s.keywords).length) group(text(s.name) || titles.skills, strings(s.keywords));
  group(
    titles.skills,
    skills.filter((s) => !strings(s.keywords).length && text(s.name)).map((s) => (text(s.level) ? `${text(s.name)} (${text(s.level)})` : text(s.name))),
  );
  group(
    titles.languages,
    list(resume.languages).flatMap((l) => (text(l.language) ? [text(l.fluency) ? `${text(l.language)} (${text(l.fluency)})` : text(l.language)] : [])),
  );

  const profileId = freshId(options.name, Object.keys(p.profiles), "cv");
  const profile: Profile = {
    name: options.name,
    // The subtitle cannot be empty: without a label, the name of the profile.
    subtitle: text(basics.label) || options.name,
    contacts: CONTACT_KINDS.filter((k) => contacts[k]),
    skills: rows,
    summary: text(basics.summary),
    sections,
  };
  // A date without its month cannot be shown with one.
  if (yearOnly) profile.layout = { dateFormat: "YYYY" };
  p.profiles[profileId] = profile;
  return { project: p, profileId, entries: made };
}

const plain = (s: string) => s.replaceAll("**", "");
const line = (heading: string | undefined, body: string) => plain(heading ? `${heading}: ${body}` : body);

/** `Inglés (C1)` → language and fluency. */
function language(value: string): { language: string; fluency?: string } {
  const m = /^(.*?)\s*[(（]([^)）]*)[)）]\s*$/.exec(value) ?? /^(.*?)\s+[–—-]\s+(.*)$/.exec(value);
  return m && m[1] ? { language: m[1], fluency: m[2] } : { language: value };
}

/** A profile as JSON Resume, as its PDF shows it; `left` names what JSON Resume has no place for. */
export function toJsonResume(project: Project, profileId: string): { resume: JsonResume; left: string[] } {
  const cv = resolveProfile(project, profileId);
  const left: string[] = [];
  const basics: NonNullable<JsonResume["basics"]> = { name: cv.name };
  if (cv.subtitle) basics.label = plain(cv.subtitle);
  const photo = cv.photo && project.assets?.[cv.photo.name];
  if (photo && photo.type !== "image/svg+xml") basics.image = `data:${photo.type};base64,${photo.data}`;
  const profiles: NonNullable<NonNullable<JsonResume["basics"]>["profiles"]> = [];
  for (const c of cv.contacts) {
    if (c.kind === "email") basics.email = c.value;
    else if (c.kind === "phone") basics.phone = c.value;
    else if (c.kind === "website") basics.url = c.href ?? c.value;
    else if (c.kind === "location") {
      const [city, ...rest] = c.value.split(/\s*,\s*/);
      basics.location = rest.length ? { city, region: rest.join(", ") } : { city };
    } else profiles.push({ network: c.kind === "linkedin" ? "LinkedIn" : "GitHub", username: c.value.replace(/\/+$/, "").split("/").pop(), url: c.href ?? c.value });
  }
  if (profiles.length) basics.profiles = profiles;
  if (cv.summary) basics.summary = plain(cv.summary);
  if (cv.highlight) left.push(cv.highlight.title);

  const out: Required<Omit<JsonResume, "$schema" | "basics" | "meta">> = {
    work: [],
    volunteer: [],
    education: [],
    awards: [],
    certificates: [],
    publications: [],
    skills: [],
    languages: [],
    interests: [],
    references: [],
    projects: [],
  };
  for (const group of cv.skills.flat()) {
    if (kindOf(group.title) === "languages") out.languages.push(...group.items.map((i) => language(plain(i))));
    else out.skills.push({ name: plain(group.title), keywords: group.items.map(plain) });
  }

  /** From–to of an entry of the bank: ongoing has no end; a single date ends where it starts. */
  const dates = (id: string): Dated => {
    const raw = project.entries[id];
    if (!raw?.start) return {};
    if (raw.end === null) return { startDate: raw.start };
    return { startDate: raw.start, endDate: raw.end ?? raw.start };
  };
  const at = (id: string) => project.entries[id]?.start;
  const highlights = (e: ResolvedEntry) => e.items.map((i) => line(i.heading, i.text));
  const some = <T extends object>(value: T): T => Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && !v.length))) as T;

  for (const section of cv.sections) {
    const kind = kindOf(section.id, section.title) ?? "work";
    let lost = false;
    for (const block of section.blocks) {
      if (block.type === "entry") {
        const e = block.entry;
        const note = e.note && plain(e.note);
        if (kind === "volunteer") out.volunteer.push(some({ organization: e.place, position: e.title, ...dates(e.id), summary: note, highlights: highlights(e) }));
        else if (kind === "education") out.education.push(some({ institution: e.place, area: e.title, ...dates(e.id), score: note, courses: highlights(e) }));
        else if (kind === "projects") out.projects.push(some({ name: e.title, entity: e.place, description: note, highlights: highlights(e), ...dates(e.id) }));
        else if (kind === "awards") out.awards.push(some({ title: e.title, awarder: e.place, date: at(e.id), summary: note }));
        else if (kind === "certificates") out.certificates.push(some({ name: e.title, issuer: e.place, date: at(e.id), summary: note }));
        else if (kind === "publications") out.publications.push(some({ name: e.title, publisher: e.place, releaseDate: at(e.id), summary: note }));
        else if (kind === "languages") out.languages.push(some({ language: e.title, fluency: note }));
        else if (kind === "interests") out.interests.push(some({ name: e.title, keywords: highlights(e) }));
        else if (kind === "references") out.references.push(some({ name: e.title, reference: note ?? highlights(e).join(" ") }));
        else out.work.push(some({ name: e.place, position: e.title, ...dates(e.id), summary: note, highlights: highlights(e) }));
        continue;
      }
      const heading = block.type === "item" ? block.heading : undefined;
      const body = plain(block.text);
      if (kind === "interests") out.interests.push(some({ name: heading ? plain(heading) : body, keywords: heading ? [body] : [] }));
      else if (kind === "references") out.references.push(some({ name: heading && plain(heading), reference: body }));
      else if (kind === "languages") out.languages.push(language(line(heading, body)));
      else if (kind === "awards") out.awards.push(some({ title: heading ? plain(heading) : body, summary: heading ? body : undefined }));
      else lost = true;
    }
    if (lost) left.push(section.title);
  }

  const resume: Record<string, unknown> = { $schema: JSON_RESUME_SCHEMA, basics };
  for (const [key, value] of Object.entries(out)) if (value.length) resume[key] = value;
  return { resume: resume as JsonResume, left };
}
