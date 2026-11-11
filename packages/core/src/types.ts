// The Foja project format, version 3. `schema/project.schema.json` is the contract; these types
// mirror it for TypeScript code. Keep both in sync (test/schema.test.ts checks the example).
// `migrate` (migrate.ts) brings version 2 up to it.

export const FORMAT = "foja/3";

export type ContactKind = "phone" | "email" | "website" | "github" | "linkedin" | "location";
export const CONTACT_KINDS: ContactKind[] = ["phone", "email", "website", "github", "linkedin", "location"];

/** How much a thing of the bank matters, marked once: `essential` goes in every length, `normal`
 * (the default) in Normal and Complete, `extra` only in Complete. */
export type Priority = "essential" | "normal" | "extra";
export const PRIORITIES: Priority[] = ["essential", "normal", "extra"];

/** A line of text; `**bold**` spans are allowed. */
export interface Item {
  /** Unique among the entry's items; profiles name it in their overrides. */
  id: string;
  heading?: string;
  text: string;
  priority?: Priority;
}

/** Something done over time: a job, a degree, a project. Shared by every profile. */
export interface Entry {
  title: string;
  place?: string;
  /** `YYYY-MM`. */
  start?: string;
  /** `YYYY-MM`; `null` means ongoing; absent means `start` is a single date. */
  end?: string | null;
  note?: string;
  items?: Item[];
  priority?: Priority;
}

export interface Skill {
  /** Unique in its group; profiles name it in their overrides. */
  id: string;
  text: string;
  priority?: Priority;
}

export interface SkillGroup {
  title: string;
  items: Skill[];
}

export type Length = "short" | "normal" | "full";
export const LENGTHS: Length[] = ["short", "normal", "full"];

export type Block =
  | { type: "entry"; entry: string }
  | { type: "item"; heading?: string; text: string }
  | { type: "paragraph"; text: string };

export interface Section {
  id: string;
  title: string;
  /** Which column the section goes in when the layout has two. */
  column?: "main" | "side";
  /** Entries without their items, small type. */
  compact?: boolean;
  blocks: Block[];
}

export interface Layout {
  /** A built-in style (`legajo`, `banda`, `minimal`, `claustro`, `recto`, `llano`, `arco`, `rotulo`, `portada`) or the id of one in `Project.templates`. */
  template?: string;
  columns?: 1 | 2;
  sidebar?: "left" | "right";
  /** Percent of the text width. */
  sidebarWidth?: number;
  photo?: "square" | "rounded" | "circle" | "none";
  font?: "XCharter" | "Noto Sans";
  /** Points. */
  fontSize?: number;
  /** `#rrggbb`; absent means the style's own colour. */
  accent?: string;
  /** Millimetres. */
  margins?: { top?: number; bottom?: number; left?: number; right?: number };
  density?: "compact" | "normal" | "relaxed";
  paper?: "a4" | "us-letter";
  dateFormat?: "MM/YYYY" | "MMM YYYY" | "YYYY";
  /** Language of the fixed labels; defaults to the project language. */
  labels?: "es" | "en" | "pt";
  /** What of the bank goes in, by priority: `short` the essential, `normal` (the default) the
   * essential and the normal, `full` everything. */
  length?: Length;
  /** Which summary goes in; absent, the short one with the short length (when there is one). */
  summaryLength?: "short" | "long";
}

export interface Profile {
  /** Shown in the editor; defaults to the id. */
  name?: string;
  subtitle: string;
  /** A first block in the sidebar, e.g. the course applied for. */
  highlight?: { title: string; text: string };
  contacts: ContactKind[];
  /** Rows of skill group ids; a row with several groups is laid out side by side. */
  skills: string[][];
  summary: string;
  /** The summary for the short length. */
  summaryShort?: string;
  /** Exceptions to the length rule, by path in the bank (`entries/<id>`,
   * `entries/<id>/items/<id>`, `skills/<group>/<id>`): true shows it, false leaves it out. */
  overrides?: Record<string, boolean>;
  sections: Section[];
  layout?: Layout;
}

export interface Asset {
  type: "image/jpeg" | "image/png" | "image/svg+xml";
  /** Base64. */
  data: string;
}

/** A CV style written in Typst by the user (see docs/templates.md). */
export interface CustomTemplate {
  name: string;
  /** Typst source; it starts with `#import "/lib.typ": *`. */
  source: string;
  /** The files of an imported template, by relative path: the compiler sees them under
   * `/custom/<id>/`. Text files here, pictures in `binaries` (base64). */
  files?: Record<string, string>;
  binaries?: Record<string, string>;
  /** The path, among `files`, of the imported template's licence. */
  license?: string;
  /** An imported LaTeX template: how its macros are filled with the CV (export/latex-template.ts).
   * Its `source` is then a Typst style that shows the PDF LaTeX makes. */
  latex?: LatexFill;
}

/** One argument of a LaTeX template's macro: a field of the CV, or the template's own text. */
export interface LatexArg {
  /** An entry field (`title`, `place`, `period`, `start`, `end`, `note`, `items`) or, in the
   * header, `name`, `subtitle` or a contact kind. */
  field?: string;
  raw?: string;
  /** Written as `[...]`, and left out when empty. */
  optional?: boolean;
}

export interface LatexFill {
  /** The main .tex file among the template's files: its preamble is kept as it is. */
  main: string;
  /** XeLaTeX, for a template that picks its fonts by name; pdfLaTeX when absent. */
  engine?: "xetex";
  header?: { macro: string; args: LatexArg[] };
  /** Entry macros: what goes in each argument. */
  entries: Record<string, LatexArg[]>;
  /** The entry macro of each section, by section id. */
  sections: Record<string, string>;
  /** The entry macro of the other sections. */
  entry?: string;
  /** The command a section title is written with (`\section`, `\cvsection`…). */
  section: string;
  summaryTitle?: string;
  /** The list around a section's entries, when the template has one. */
  entryList?: { begin: string; end: string };
  /** The list of an entry's items; in `item`, `#` is the text. */
  itemList?: { begin: string; end: string; item: string };
}

export interface Project {
  format: typeof FORMAT;
  /** BCP 47 tag of the CV text, e.g. `es`. */
  language: string;
  person: {
    givenNames: string[];
    familyNames: string[];
    /** Name of an asset. */
    photo?: string | null;
  };
  contacts: Partial<Record<ContactKind, string>>;
  skills: Record<string, SkillGroup>;
  entries: Record<string, Entry>;
  profiles: Record<string, Profile>;
  assets?: Record<string, Asset>;
  templates?: Record<string, CustomTemplate>;
}
