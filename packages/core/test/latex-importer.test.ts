import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { importData, importStyle, latexEngine, latexText, parseLatex, proposeMapping, readFont, readTemplate, validate, type Project } from "../src/index.ts";
import { fillLatex, latexBundle } from "../src/export/index.ts";

const resume = readFileSync(new URL("./fixtures/latex/resume.tex", import.meta.url));
const files = { "resume.tex": new Uint8Array(resume) };

/** A template laid out as the common list-based résumés are: entries and items in lists that the
 * template's own macros open and close. Written for these tests. */
const listed = String.raw`\documentclass{article}
\usepackage{enumitem}
\newcommand{\entriesStart}{\begin{itemize}[leftmargin=0pt, label={}]}
\newcommand{\entriesEnd}{\end{itemize}}
\newcommand{\pointsStart}{\begin{itemize}}
\newcommand{\pointsEnd}{\end{itemize}\vspace{-4pt}}
\newcommand{\point}[1]{\item\small{#1}}
\newcommand{\heading}[4]{\item \textbf{#1} \hfill #2 \\ \textit{#3} \hfill \textit{#4}}
\begin{document}
\begin{center}
  {\Huge \scshape Jo Example} \\ \href{mailto:jo@example.com}{jo@example.com}
\end{center}
\section{Experience}
\entriesStart
  \heading{Example Co.}{Jun 2020 -- Present}{Developer}{Rosario}
  \pointsStart
    \point{Wrote the \textbf{billing} service}
    \point{Ran the on-call rota}
  \pointsEnd
  \heading{Other Co.}{2018 -- 2020}{Intern}{Rosario}
\entriesEnd
\section{Skills}
\begin{itemize}
  \item Python, SQL % a comment
\end{itemize}
\end{document}
`;

describe("LaTeX templates", () => {
  test("plain text of markup", () => {
    expect(latexText(String.raw`\textbf{Ana} P\'erez -- \href{https://x.org}{site} \\ 50\% \textcolor{red}{done}~ok`)).toBe("Ana Pérez – site 50% done ok");
    expect(latexText(String.raw`\vspace{2pt}\small{Item} $|$ \emph{x}`)).toBe("Item | x");
  });

  test("reads macros, sections, items and the header", () => {
    const t = readTemplate(files);
    expect(t.engine).toBe("latex");
    expect(t.header?.fn).toBe("cvheader");
    expect(Object.keys(t.macros)).toEqual(["cventry"]);
    expect(t.macros.cventry).toHaveLength(3);
    expect(t.macros.cventry[0].items).toEqual(["Designed the billing service and its API.", "Cut the nightly import from two hours to ten minutes."]);
    expect(t.parsed.sections.map((s) => s.title)).toEqual(["Experience", "Education", "Skills"]);
    expect(t.parsed.sections[2].blocks).toEqual([
      { kind: "item", text: "Python, TypeScript, SQL" },
      { kind: "item", text: "Spanish (native), English (C1)" },
    ]);
    expect(t.parsed.definitions).toMatchObject({ cvheader: ["#1", "#2", "#3", "#4"], cventry: ["#1", "#2", "#3", "#4"], cvdetail: ["#1"] });
  });

  test("lists opened by the template's macros", () => {
    const p = parseLatex(listed);
    const calls = p.sections[0].blocks.flatMap((b) => (b.kind === "call" ? [b.call] : []));
    expect(calls.map((c) => c.fn)).toEqual(["heading", "heading"]);
    expect(calls[0].items).toEqual(["Wrote the billing service", "Ran the on-call rota"]);
    expect(p.entryList).toEqual({ begin: "\\entriesStart", end: "\\entriesEnd" });
    expect(p.itemList).toEqual({ begin: "\\pointsStart", end: "\\pointsEnd", item: "\\point{#}" });
    expect(p.sections[1].blocks).toEqual([{ kind: "item", text: "Python, SQL" }]);
  });

  test("the proposal, the data, the style and the filled .tex", () => {
    const t = readTemplate(files);
    const mapping = proposeMapping(t);
    expect(mapping.header).toEqual({ "#1": "name", "#2": "location", "#3": "email", "#4": "website" });
    expect(mapping.macros.cventry).toEqual({ "#1": "title", "#2": "place", "#3": "period", "#4": "note" });

    const { project, profileId } = importData(t, mapping, { name: "Resume", language: "en" });
    expect(project.person.familyNames).toEqual(["Pérez"]);
    const style = importStyle(t, mapping, "resume", "Resume");
    expect(style.latex).toMatchObject({ main: "resume.tex", entry: "cventry", section: "\\section", itemList: { begin: "\\begin{cvitems}", end: "\\end{cvitems}", item: "\\cvdetail{#}" } });
    const p: Project = { ...project, templates: { resume: style } };
    p.profiles[profileId].layout = { ...p.profiles[profileId].layout, template: "resume" };
    expect(validate(p)).toEqual([]);

    const tex = fillLatex(p, profileId);
    expect(tex.startsWith("% A one-page CV template")).toBe(true);
    expect(tex).toContain("\\newcommand{\\cventry}[4]");
    expect(tex).toContain("\\cvheader{Ana Pérez}{Rosario, Argentina}{ana@example.com}{ana.example.com}");
    expect(tex).toMatch(/\\cventry\{Backend developer\}\{Example Co\.\}\{03\/2021 – [^}]+\}\{Rosario\}\n\\begin\{cvitems\}\n {2}\\cvdetail\{Designed the billing service and its API\.\}/);
    expect(tex).toContain("\\section{Skills}\n\\begin{cvitems}\n  \\cvdetail{Python, TypeScript, SQL}");
    expect(tex.trimEnd().endsWith("\\end{document}")).toBe(true);

    // The LaTeX export is the template itself, filled.
    const bundle = latexBundle(p, profileId);
    expect(Object.keys(bundle).sort()).toEqual(["README-foja.txt", "resume.tex"]);
    expect(bundle["resume.tex"]).toBe(tex);
  });

  test("a template that picks its fonts by name needs XeLaTeX", () => {
    const modern = readFileSync(new URL("./fixtures/latex/modern.tex", import.meta.url));
    const t = readTemplate({ "modern.tex": new Uint8Array(modern) });
    expect(t.latexEngine).toBe("xetex");
    expect(readTemplate(files).latexEngine).toBe("pdftex");
    expect(latexEngine({ "cv.tex": "% !TEX program = xelatex\n\\documentclass{article}" })).toBe("xetex");
    expect(latexEngine({ "cv.tex": "% \\usepackage{fontspec}\n\\documentclass{article}" })).toBe("pdftex");
    // \cvsection draws its own title: a section by its name.
    expect(t.parsed.sections.map((s) => s.title)).toEqual(["Experience", "Education"]);
    expect(t.header?.fn).toBe("header");
    const mapping = proposeMapping(t);
    expect(mapping.header).toEqual({ "#1": "name", "#2": "email", "#3": "github", "#4": "location" });
    const style = importStyle(t, mapping, "modern", "Modern");
    expect(style.latex).toMatchObject({ engine: "xetex", section: "\\cvsection", entry: "job" });
  });

  test("uploaded fonts are read, and a LaTeX template keeps the ones it brings", () => {
    const font = (name: string) => new Uint8Array(readFileSync(new URL(`../../template/fonts/${name}`, import.meta.url)));
    const bold = readFont(font("NotoSans-Bold.ttf"))!;
    expect(bold).toMatchObject({ families: ["Noto Sans"], psName: "NotoSans-Bold", weight: 700, bold: true, italic: false });
    const italic = readFont(font("XCharter-Italic.otf"))!;
    expect(italic.families).toContain("XCharter");
    expect(italic).toMatchObject({ italic: true, bold: false });
    expect(italic.slant).toBeGreaterThan(0);
    expect(readFont(new TextEncoder().encode("not a font at all"))).toBeUndefined();
    expect(readFont(font("NotoSans-Bold.ttf").slice(0, 300))).toBeUndefined();

    const modern = new Uint8Array(readFileSync(new URL("./fixtures/latex/modern.tex", import.meta.url)));
    const t = readTemplate({ "modern.tex": modern, "fonts/NotoSans-Bold.ttf": font("NotoSans-Bold.ttf") });
    expect(t.fonts).toEqual([]);
    expect(Object.keys(t.binaries)).toEqual(["fonts/NotoSans-Bold.ttf"]);
  });

  test("a list-based template keeps its lists when filled", () => {
    const t = readTemplate({ "cv.tex": new TextEncoder().encode(listed) });
    const mapping = proposeMapping(t);
    expect(mapping.macros.heading).toEqual({ "#1": "title", "#2": "period", "#3": "place", "#4": "note" });
    mapping.macros.heading = { "#1": "place", "#2": "period", "#3": "title", "#4": "note" };
    const { project, profileId } = importData(t, mapping, { name: "Listed", language: "en" });
    const p: Project = { ...project, templates: { listed: importStyle(t, mapping, "listed", "Listed") } };
    p.profiles[profileId].layout = { ...p.profiles[profileId].layout, template: "listed" };
    const tex = fillLatex(p, profileId);
    expect(tex).toContain("\\section{Experience}\n\\entriesStart\n\\heading{Example Co.}{");
    expect(tex).toContain("\\pointsStart\n  \\point{Wrote the billing service}\n  \\point{Ran the on-call rota}\n\\pointsEnd");
    expect(tex).toMatch(/\\heading\{Other Co\.\}\{[^}]*2018[^}]*2020\}\{Intern\}\{Rosario\}\n\\entriesEnd/);
  });
});
