// Reads a Typst CV template with fixed rules, without running it: its definitions (`#let`), the
// calls in its sample content (a function called again and again is an entry), its headings (the
// sections), the bullets under each call (the entry's items) and its `#show: x.with(...)` (the
// header). Typst code here is data: it is scanned, never evaluated.

/** An argument of a call: named (`company: "Acme"`), positional, or the trailing content block. */
export interface Arg {
  /** `name` for a named argument, `#0`, `#1`… for positional ones, `#body` for a trailing `[...]`. */
  key: string;
  raw: string;
  /** The plain text of the value: a string unquoted, content without markup, the strings inside
   * anything else joined with " – ". */
  text: string;
  /** The elements of an array value, as plain text. */
  list?: string[];
}

export interface Call {
  fn: string;
  args: Arg[];
  /** Bullets right after the call, before the next call or heading. */
  items: string[];
}

export type TemplateBlock = { kind: "call"; call: Call } | { kind: "item"; text: string } | { kind: "text"; text: string };

export interface TemplateSection {
  title: string;
  level: number;
  blocks: TemplateBlock[];
}

export interface ParsedFile {
  /** `#let` functions: name → parameter names. */
  definitions: Record<string, string[]>;
  /** The full text of each top-level `#let`. */
  lets: string[];
  imports: string[];
  /** Top-level `#set` and `#show` rules, except the header's. */
  rules: string[];
  header?: Call;
  /** Calls before the first heading. */
  preamble: TemplateBlock[];
  sections: TemplateSection[];
}

/** Functions of Typst itself, never taken for a template's macro. */
const BUILTINS = new Set(
  "v h text par block box grid table stack align pad place line rect circle ellipse square polygon image link emph strong underline strike overline smallcaps upper lower lorem pagebreak colbreak linebreak parbreak heading list enum terms figure columns page document set show let import include if for while return raw math repr str int float type range datetime calc counter state context locate query metadata label ref cite bibliography outline footnote quote numbering measure layout hide move scale rotate highlight sub super sym emoji panic assert eval read json yaml toml csv xml cbor plugin".split(" "),
);

/** Index just past the bracket that closes the one at `i`, skipping strings, comments and raw. */
export function closing(src: string, i: number): number {
  const stack: string[] = [];
  const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === '"' && stack.at(-1) !== "[") {
      for (j++; j < src.length && src[j] !== '"'; j++) if (src[j] === "\\") j++;
    } else if (c === "/" && src[j + 1] === "/" && stack.at(-1) !== "[") {
      while (j < src.length && src[j] !== "\n") j++;
    } else if (c === "/" && src[j + 1] === "*") {
      const end = src.indexOf("*/", j + 2);
      j = end < 0 ? src.length : end + 1;
    } else if (c === "`") {
      const end = src.indexOf("`", j + 1);
      j = end < 0 ? src.length : end;
    } else if (c === "\\" && stack.at(-1) === "[") j++;
    else if (pairs[c]) stack.push(pairs[c]);
    else if (c === stack.at(-1)) {
      stack.pop();
      if (stack.length === 0) return j + 1;
    }
  }
  return src.length;
}

/** Splits the inside of `(...)` at the commas that are not nested. */
function splitArgs(inner: string): string[] {
  const out: string[] = [];
  let from = 0;
  for (let j = 0; j < inner.length; j++) {
    const c = inner[j];
    if ("([{".includes(c) || c === '"') {
      j = (c === '"' ? stringEnd(inner, j) : closing(inner, j)) - 1;
    } else if (c === ",") {
      out.push(inner.slice(from, j));
      from = j + 1;
    }
  }
  out.push(inner.slice(from));
  return out.map((s) => s.trim()).filter(Boolean);
}

const stringEnd = (src: string, i: number) => {
  let j = i + 1;
  for (; j < src.length && src[j] !== '"'; j++) if (src[j] === "\\") j++;
  return j + 1;
};

const unescape = (s: string) => s.replace(/\\(["\\nt])/g, (_, c) => ({ n: "\n", t: "\t" })[c as "n" | "t"] ?? c);

/** Content markup as plain text, `*strong*` kept as Foja's `**strong**`. */
export function markupText(markup: string): string {
  return markup
    .replace(/\/\/[^\n]*/g, "")
    .replace(/#(?:h|v)\([^)]*\)/g, " ")
    .replace(/#link\("[^"]*"\)\[([^\]]*)\]/g, "$1")
    .replace(/#link\("([^"]*)"\)/g, "$1")
    .replace(/#[A-Za-z][\w.-]*(\([^)]*\))?/g, "")
    .replace(/\*([^*\n]+)\*/g, "**$1**")
    .replace(/(^|\s)_([^_\n]+)_/g, "$1$2")
    .replace(/\\([#*_\\$@<>`~])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Plain text of a value, and its elements when it is an array. */
function valueText(raw: string): { text: string; list?: string[] } {
  const v = raw.trim();
  if (v.startsWith('"') && stringEnd(v, 0) === v.length) return { text: unescape(v.slice(1, -1)) };
  if (v.startsWith("[") && closing(v, 0) === v.length) return { text: markupText(v.slice(1, -1)) };
  if (v.startsWith("(") && closing(v, 0) === v.length && !/^\(\s*[A-Za-z_][\w-]*\s*:/.test(v)) {
    const list = splitArgs(v.slice(1, -1)).map((x) => valueText(x).text);
    return { text: list.join(", "), list };
  }
  const strings = [...v.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => unescape(m[1]));
  return { text: strings.length ? strings.join(" – ") : v };
}

function parseArgs(inner: string): Arg[] {
  let n = 0;
  return splitArgs(inner).map((part) => {
    const named = /^([A-Za-z_][\w-]*)\s*:(?!:)\s*([\s\S]*)$/.exec(part);
    const raw = named ? named[2] : part;
    return { key: named ? named[1] : `#${n++}`, raw, ...valueText(raw) };
  });
}

/** Parameter names of a `#let f(...)`. */
function parseParams(inner: string): string[] {
  return splitArgs(inner).map((p) => p.replace(/^\.\./, "").split(":")[0].trim());
}

/** The end of a top-level statement that starts at `i`: the end of its line, or later if a
 * bracket opened on it closes on a later line. */
function statementEnd(src: string, i: number): number {
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === "\n") return j;
    if ("([{".includes(c)) j = closing(src, j) - 1;
    else if (c === '"') j = stringEnd(src, j) - 1;
  }
  return src.length;
}

/** Reads one `.typ` file. */
export function parseTypst(src: string): ParsedFile {
  const out: ParsedFile = { definitions: {}, lets: [], imports: [], rules: [], preamble: [], sections: [] };
  let section: TemplateSection | undefined;
  let lastCall: Call | undefined;
  const push = (b: TemplateBlock) => (section ? section.blocks : out.preamble).push(b);
  let i = 0;
  while (i < src.length) {
    const lineStart = i === 0 || src[i - 1] === "\n";
    const rest = src.slice(i, src.indexOf("\n", i) < 0 ? src.length : src.indexOf("\n", i));
    if (lineStart) {
      const trimmed = rest.trimStart();
      const heading = /^(=+)\s+(.*)$/.exec(trimmed);
      if (heading) {
        section = { title: markupText(heading[2].replace(/<[\w-]+>\s*$/, "")), level: heading[1].length, blocks: [] };
        out.sections.push(section);
        lastCall = undefined;
        i += rest.length + 1;
        continue;
      }
      const bullet = /^[-+]\s+(.*)$/.exec(trimmed);
      if (bullet) {
        // A bullet runs on over the indented lines that follow it.
        let end = i + rest.length;
        while (end < src.length && /^\n[ \t]+[^\s-+]/.test(src.slice(end, end + 40))) end = src.indexOf("\n", end + 1) < 0 ? src.length : src.indexOf("\n", end + 1);
        const text = markupText(src.slice(i, end).trimStart().slice(1));
        if (lastCall) lastCall.items.push(text);
        else push({ kind: "item", text });
        i = end + 1;
        continue;
      }
      if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("//") && !trimmed.startsWith("/*")) {
        const end = statementEnd(src, i);
        const text = markupText(src.slice(i, end));
        if (text) push({ kind: "text", text });
        lastCall = undefined;
        i = end + 1;
        continue;
      }
    }
    if (src[i] === "/" && src[i + 1] === "/") {
      i = src.indexOf("\n", i) < 0 ? src.length : src.indexOf("\n", i);
      continue;
    }
    if (src[i] === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end < 0 ? src.length : end + 2;
      continue;
    }
    if (src[i] !== "#") {
      i++;
      continue;
    }
    const word = /^#([A-Za-z_][\w-]*(?:\.[A-Za-z_][\w-]*)*)/.exec(src.slice(i, i + 200));
    if (!word) {
      i++;
      continue;
    }
    const name = word[1];
    const after = i + word[0].length;
    if (["let", "import", "set", "show", "include"].includes(name)) {
      const end = statementEnd(src, i);
      const text = src.slice(i, end);
      if (name === "let") {
        const def = /^#let\s+([A-Za-z_][\w-]*)\s*\(/.exec(text);
        if (def) out.definitions[def[1]] = parseParams(text.slice(def[0].length, closing(text, def[0].length - 1) - 1));
        out.lets.push(text);
      } else if (name === "import" || name === "include") out.imports.push(text);
      else {
        const header = /^#show\s*:\s*([A-Za-z_][\w-]*)\.with\(/.exec(text);
        if (header) {
          const open = header[0].length - 1;
          out.header = { fn: header[1], args: parseArgs(text.slice(open + 1, closing(text, open) - 1)), items: [] };
        } else out.rules.push(text);
      }
      i = end;
      continue;
    }
    // A call: `#f(args)`, with trailing content blocks `[...]` as more arguments.
    let j = after;
    let args: Arg[] = [];
    if (src[j] === "(") {
      const end = closing(src, j);
      args = parseArgs(src.slice(j + 1, end - 1));
      j = end;
    }
    let body = 0;
    while (src[j] === "[") {
      const end = closing(src, j);
      const raw = src.slice(j, end);
      args.push({ key: body++ === 0 ? "#body" : `#body${body}`, raw, text: markupText(raw.slice(1, -1)), list: bulletsOf(raw.slice(1, -1)) });
      j = end;
    }
    const fn = name.split(".").pop()!;
    if (j > after && !BUILTINS.has(fn) && !BUILTINS.has(name.split(".")[0])) {
      lastCall = { fn: name, args, items: [] };
      push({ kind: "call", call: lastCall });
    }
    i = j;
  }
  return out;
}

/** The bullets of a content block, or undefined when it has none. */
function bulletsOf(markup: string): string[] | undefined {
  const lines = markup.split("\n").filter((l) => /^\s*[-+]\s+/.test(l));
  return lines.length ? lines.map((l) => markupText(l.replace(/^\s*[-+]\s+/, ""))) : undefined;
}
