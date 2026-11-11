// Reads a LaTeX CV template with fixed rules, without running it, into the same shape the Typst
// reader gives: the macros it defines (\newcommand, \def, \NewDocumentCommand), the calls in its
// sample content (a macro called again and again is an entry), its \section titles, the \item
// lines under each call (the entry's items) and the call before the first section (the header).
// It also notes how the template writes a section, the list around a section's entries and the
// list of an entry's items, so that the same macros can be filled with a CV (export/latex-template.ts).

import type { Arg, Call, ParsedFile, TemplateBlock, TemplateSection } from "./parse.ts";

/** How a list is opened and closed: `\begin{itemize}[...]`, a macro of the template… */
export interface LatexList {
  begin: string;
  end: string;
}

export interface ParsedLatex extends ParsedFile {
  /** The command a section title is written with (`\section`, `\section*`, `\cvsection`…). */
  sectionCommand: string;
  /** The list around a section's entries, when the template puts them in one. */
  entryList?: LatexList;
  /** The list of an entry's items, and how one item is written (`#` is the text). */
  itemList?: LatexList & { item: string };
}

const LIST_ENVS = /^(itemize|enumerate|description|compactitem|compactenum)$/;
const SECTION_CMDS = new Set(["section", "section*", "subsection", "subsection*", "chapter", "chapter*"]);
/** Commands whose argument is the text shown. */
const TEXT_CMDS = new Set("textbf textit emph textsc textsl texttt textrm textsf textmd textup underline mbox makebox fbox uline small footnotesize large Large LARGE huge Huge normalsize scriptsize tiny".split(" "));
/** Commands of LaTeX itself, never taken for a template's macro. */
const BUILTINS = new Set(
  "begin end item section subsection subsubsection paragraph chapter part vspace hspace vskip hskip vfill hfill hfil newline linebreak pagebreak newpage clearpage noindent indent centering raggedright raggedleft par quad qquad medskip smallskip bigskip label ref setlength addtolength thispagestyle pagestyle color textcolor colorbox href url includegraphics input include textbar textbullet cdot ldots dots today maketitle tableofcontents bfseries itshape scshape slshape mdseries upshape rmfamily sffamily ttfamily selectfont fontsize hline cline multicolumn rule titlerule phantom hphantom vphantom strut enspace thinspace negthinspace nopagebreak enlargethispage footnote marginpar caption newcommand renewcommand providecommand def gdef edef xdef let NewDocumentCommand RenewDocumentCommand newenvironment renewenvironment setcounter stepcounter addvspace relax hbox vbox raisebox parbox minipage tabular extracolsep fill"
    .split(" ")
    .concat([...TEXT_CMDS]),
);

const ACCENTS: Record<string, Record<string, string>> = {
  "'": { a: "á", e: "é", i: "í", o: "ó", u: "ú", A: "Á", E: "É", I: "Í", O: "Ó", U: "Ú", "\\i": "í" },
  "`": { a: "à", e: "è", i: "ì", o: "ò", u: "ù" },
  '"': { a: "ä", e: "ë", i: "ï", o: "ö", u: "ü", U: "Ü", "\\i": "ï" },
  "~": { n: "ñ", N: "Ñ", a: "ã", o: "õ" },
  "^": { a: "â", e: "ê", i: "î", o: "ô", u: "û" },
};

/** The source without comments (a `%` that is not `\%` ends the line's text). */
export function stripComments(src: string): string {
  return src.replace(/(^|[^\\])((?:\\\\)*)%.*$/gm, "$1$2");
}

/** Index just past the brace (or bracket) that closes the one at `i`. */
export function closingBrace(src: string, i: number): number {
  const [open, close] = src[i] === "[" ? ["[", "]"] : ["{", "}"];
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    const ch = src[j];
    if (ch === "\\") {
      j++;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close && --depth === 0) return j + 1;
  }
  return src.length;
}

/** Plain text of LaTeX markup: commands that show their argument keep it, others go. */
export function latexText(raw: string): string {
  let s = raw.replace(/\\href\s*\{[^{}]*\}\s*\{/g, "{").replace(/\\url\s*\{([^{}]*)\}/g, "$1");
  s = s.replace(/\\(textcolor|colorbox)\s*(\[[^\]]*\])?\s*\{[^{}]*\}/g, "");
  s = s.replace(/\\(['`"~^])\s*\{?(\\i|[a-zA-Z])\}?/g, (whole, accent: string, letter: string) => ACCENTS[accent]?.[letter] ?? whole);
  s = s.replace(/\\~\{\}|\\textasciitilde\b/g, "~").replace(/\$\|\$|\\textbar\b\s*(\{\})?/g, "|").replace(/\\textbullet\b\s*(\{\})?|\$\\(bullet|cdot)\$/g, "·");
  s = s.replace(/---/g, "—").replace(/--/g, "–").replace(/\\\\(\[[^\]]*\])?|\\newline\b/g, " ").replace(/~/g, " ");
  s = s.replace(/\\([&%$#_{}])/g, "$1");
  // Commands with arguments: a text command keeps them, any other drops them (\vspace{2pt}).
  for (let guard = 0; guard < 20; guard++) {
    const next = s.replace(/\\([a-zA-Z]+)\*?\s*(\[[^\][]*\])?\s*\{([^{}]*)\}/g, (_, name: string, _opt, arg: string) =>
      TEXT_CMDS.has(name) || !BUILTINS.has(name) ? arg : "",
    );
    if (next === s) break;
    s = next;
  }
  s = s.replace(/\\[a-zA-Z]+\*?/g, " ").replace(/[{}$]/g, "");
  return s.replace(/\s+/g, " ").trim();
}

interface Definition {
  params: number;
  /** Whether the first parameter is optional (`\newcommand{\x}[2][default]`). */
  optional: boolean;
  body: string;
}

/** `\newcommand`, `\renewcommand`, `\providecommand`, `\def` and `\NewDocumentCommand` definitions. */
export function latexDefinitions(src: string): { commands: Record<string, Definition>; environments: Record<string, { begin: string; end: string }> } {
  const commands: Record<string, Definition> = {};
  const environments: Record<string, { begin: string; end: string }> = {};
  const group = (i: number) => {
    while (/\s/.test(src[i] ?? "")) i++;
    if (src[i] !== "{" && src[i] !== "[") return undefined;
    const end = closingBrace(src, i);
    return { text: src.slice(i + 1, end - 1), end, bracket: src[i] === "[" };
  };
  for (const m of src.matchAll(/\\(newcommand|renewcommand|providecommand|NewDocumentCommand|RenewDocumentCommand|DeclareDocumentCommand|newenvironment|renewenvironment|def|gdef|long\\def)\*?/g)) {
    let i = m.index! + m[0].length;
    if (m[1].endsWith("def")) {
      const name = /^\s*\\([a-zA-Z@]+)((?:#\d)*)\s*\{/.exec(src.slice(i));
      if (!name) continue;
      const open = i + name[0].length - 1;
      commands[name[1]] = { params: (name[2].match(/#/g) ?? []).length, optional: false, body: src.slice(open + 1, closingBrace(src, open) - 1) };
      continue;
    }
    const nameGroup = group(i);
    let name: string | undefined;
    if (nameGroup && !nameGroup.bracket) {
      name = nameGroup.text.trim().replace(/^\\/, "");
      i = nameGroup.end;
    } else {
      const bare = /^\s*\\([a-zA-Z@]+)/.exec(src.slice(i));
      if (!bare) continue;
      name = bare[1];
      i += bare[0].length;
    }
    if (m[1].includes("Document")) {
      const spec = group(i);
      const body = spec && group(spec.end);
      if (!spec || !body) continue;
      const args = spec.text.match(/[mosO]|[rRdD]../g) ?? [];
      commands[name] = { params: args.filter((a) => a !== "s").length, optional: args[0] === "o" || args[0] === "O", body: body.text };
      continue;
    }
    let params = 0;
    let optional = false;
    let g = group(i);
    if (g?.bracket) {
      params = Number(g.text) || 0;
      g = group(g.end);
      if (g?.bracket) {
        optional = true;
        g = group(g.end);
      }
    }
    if (!g) continue;
    if (m[1].endsWith("environment")) {
      const end = group(g.end);
      environments[name] = { begin: g.text, end: end?.text ?? "" };
    } else commands[name] = { params, optional, body: g.text };
  }
  return { commands, environments };
}

/** The engine a template needs: XeLaTeX when it picks fonts by name (fontspec, polyglossia…) or
 * says so (`% !TEX program = xelatex`), pdfLaTeX otherwise. */
export function latexEngine(texts: Record<string, string>): "pdftex" | "xetex" {
  const byPackage = /\\(?:usepackage|RequirePackage)\s*(?:\[[^\]]*\])?\s*\{[^}]*\b(?:fontspec|unicode-math|polyglossia|xltxtra|xunicode|mathspec)\b/;
  const bySaying = /%\s*!\s*TEX\s+(?:TS-)?program\s*=\s*(?:xe|lua)latex/i;
  const xetex = Object.entries(texts).some(([path, text]) => /\.(tex|cls|sty)$/.test(path) && (byPackage.test(stripComments(text)) || bySaying.test(text)));
  return xetex ? "xetex" : "pdftex";
}

const opensList = (body: string) => /\\begin\s*\{(itemize|enumerate|description)\}/.test(body);
const closesList = (body: string) => /\\end\s*\{(itemize|enumerate|description)\}/.test(body);

/** Reads a LaTeX template: its definitions, sections, calls and items. */
export function parseLatex(source: string): ParsedLatex {
  const src = stripComments(source);
  const { commands, environments } = latexDefinitions(src);
  const definitions = Object.fromEntries(Object.entries(commands).map(([name, d]) => [name, Array.from({ length: d.params }, (_, k) => `#${k + 1}`)]));
  const isListEnv = (env: string) => LIST_ENVS.test(env) || (environments[env] !== undefined && opensList(environments[env].begin));
  const itemMacro = (name: string) => commands[name]?.params === 1 && /\\item\b/.test(commands[name].body);
  // A section title is written with \section, or with a one-argument macro that calls it or whose
  // name says so (\cvsection, \sectionTitle), as templates that draw their own titles do.
  const sectionMacro = (name: string) =>
    commands[name]?.params === 1 && (/\\(section|subsection|chapter)\*?\s*\{\s*#1\s*\}/.test(commands[name].body) || /section$|^section|heading$/i.test(name));
  const listStart = (name: string) => commands[name]?.params === 0 && opensList(commands[name].body) && !closesList(commands[name].body);
  const listEnd = (name: string) => commands[name]?.params === 0 && closesList(commands[name].body) && !opensList(commands[name].body);
  const structural = Object.keys(commands).filter((n) => commands[n].params >= 2 || itemMacro(n) || sectionMacro(n) || listStart(n) || listEnd(n));
  const itemStop = new RegExp(String.raw`\\item\b|\\(?:begin|end)\s*\{|\\(?:section|subsection|chapter)\b` + structural.map((n) => String.raw`|\\${n}(?![a-zA-Z@])`).join(""), "g");

  const begin = src.search(/\\begin\s*\{document\}/);
  const finish = src.search(/\\end\s*\{document\}/);
  const body = begin < 0 ? src : src.slice(src.indexOf("}", begin) + 1, finish < 0 ? undefined : finish);

  const preamble: TemplateBlock[] = [];
  const sections: TemplateSection[] = [];
  let blocks = preamble;
  let sectionCommand: string | undefined;
  let entryList: LatexList | undefined;
  let itemList: (LatexList & { item: string }) | undefined;
  let lastCall: Call | undefined;
  /** Open lists: what opened them, and whether they hold the last call's items. */
  const lists: { raw: string; forItems: boolean; forEntries: boolean }[] = [];
  let text = "";
  const flush = () => {
    const t = latexText(text);
    if (t) blocks.push({ kind: "text", text: t });
    text = "";
  };
  const addItem = (raw: string, macro?: string) => {
    const t = latexText(raw);
    if (!t) return;
    const list = lists.at(-1);
    if (lastCall && list?.forItems) {
      lastCall.items.push(t);
      itemList ??= { begin: list.raw, end: "", item: macro ? `\\${macro}{#}` : "\\item #" };
    } else blocks.push({ kind: "item", text: t });
  };
  const openList = (raw: string) => {
    flush();
    const forEntries = !lastCall && lists.every((l) => !l.forEntries);
    lists.push({ raw, forItems: !!lastCall, forEntries });
  };
  const closeList = (raw: string) => {
    const list = lists.pop();
    if (!list) return;
    if (list.forItems && itemList && itemList.begin === list.raw && !itemList.end) itemList.end = raw;
    if (list.forItems) lastCall = undefined;
    if (list.forEntries && entryList && entryList.begin === list.raw && !entryList.end) entryList.end = raw;
  };

  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    if (ch !== "\\") {
      if (ch === "\n" && /^\n\s*\n/.test(body.slice(i))) flush();
      text += ch;
      i++;
      continue;
    }
    const m = /^\\([a-zA-Z@]+\*?|.)/.exec(body.slice(i))!;
    const name = m[1];
    let j = i + m[0].length;
    const args: { raw: string; optional: boolean }[] = [];
    const readArgs = (max: number, optionalFirst = true) => {
      while (args.length < max) {
        let k = j;
        while (/[ \t]/.test(body[k] ?? "") || (body[k] === "\n" && body[k + 1] !== "\n")) k++;
        if (body[k] === "{" || (body[k] === "[" && optionalFirst)) {
          const end = closingBrace(body, k);
          args.push({ raw: body.slice(k + 1, end - 1), optional: body[k] === "[" });
          j = end;
        } else break;
      }
    };

    if (name === "begin" || name === "end") {
      readArgs(1, false);
      const env = args[0]?.raw.trim() ?? "";
      if (name === "begin") readArgs(2);
      const raw = body.slice(i, j);
      if (isListEnv(env)) (name === "begin" ? openList : closeList)(raw);
      i = j;
      continue;
    }
    if (SECTION_CMDS.has(name) || sectionMacro(name)) {
      readArgs(2);
      const title = args.find((a) => !a.optional);
      if (title) {
        flush();
        sectionCommand ??= `\\${name}`;
        blocks = [];
        sections.push({ title: latexText(title.raw), level: name.startsWith("sub") ? 2 : 1, blocks });
        lastCall = undefined;
      }
      i = j;
      continue;
    }
    if (name === "item") {
      flush();
      let k = j;
      while (/\s/.test(body[k] ?? "")) k++;
      let label = "";
      if (body[k] === "[") {
        const end = closingBrace(body, k);
        label = body.slice(k + 1, end - 1);
        j = end;
      }
      // The item's text runs to the next item, list or structural macro; formatting stays in it.
      itemStop.lastIndex = j;
      const end = itemStop.exec(body)?.index ?? body.length;
      addItem((label ? label + " " : "") + body.slice(j, end));
      i = end;
      continue;
    }
    if (itemMacro(name)) {
      flush();
      readArgs(1);
      if (args[0]) addItem(args[0].raw, name);
      i = j;
      continue;
    }
    if (listStart(name)) {
      openList(`\\${name}`);
      i = j;
      continue;
    }
    if (listEnd(name)) {
      closeList(`\\${name}`);
      i = j;
      continue;
    }
    const def = commands[name];
    if (!BUILTINS.has(name) && /^[a-zA-Z@]+$/.test(name)) {
      readArgs(def ? def.params : 9, def ? def.optional : true);
      if (args.some((a) => !a.optional) && (!def || def.params > 0)) {
        flush();
        let n = 0;
        let o = 0;
        const callArgs: Arg[] = args.map((a) => ({ key: a.optional ? `[${++o}]` : `#${++n}`, raw: a.raw, text: latexText(a.raw) }));
        const call: Call = { fn: name, args: callArgs, items: [] };
        const list = lists.at(-1);
        if (list?.forEntries && !entryList) entryList = { begin: list.raw, end: "" };
        blocks.push({ kind: "call", call });
        lastCall = call;
        i = j;
        continue;
      }
    }
    text += body.slice(i, j);
    i = j;
  }
  flush();
  return {
    definitions,
    lets: [],
    imports: [],
    rules: [],
    preamble,
    sections,
    sectionCommand: sectionCommand ?? "\\section",
    ...(entryList?.end ? { entryList } : {}),
    ...(itemList?.end ? { itemList } : {}),
  };
}
