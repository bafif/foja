import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { pickStyle, resolveProfile, imageSize, toBase64, validate, type Project } from "../src/index.ts";
import { ATS_STYLES, STYLE_NAMES, bundleExports, escapeLatex, exportFiles, inlineLatex, inlineMarkdown, lineSpacing, renderLatex, renderMarkdown, wordLanguage } from "../src/export/index.ts";

const example: Project = JSON.parse(readFileSync(new URL("../../../examples/curriculum.project.json", import.meta.url), "utf8"));
const decoder = new TextDecoder();

/** Names and contents of a stored-only ZIP (what zip.ts writes). */
function unzip(data: Uint8Array): Record<string, Uint8Array> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const out: Record<string, Uint8Array> = {};
  let at = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    const size = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const name = decoder.decode(data.subarray(at + 30, at + 30 + nameLength));
    out[name] = data.subarray(at + 30 + nameLength, at + 30 + nameLength + size);
    at += 30 + nameLength + size;
  }
  return out;
}

/** The parts of a .docx, as text (docx deflates them; Node's zlib reads them back). */
async function docxParts(data: Uint8Array): Promise<Record<string, string>> {
  const { inflateRawSync } = await import("node:zlib");
  const view = new DataView(data.buffer, data.byteOffset);
  const parts: Record<string, string> = {};
  let at = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    const method = view.getUint16(at + 8, true);
    const size = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const extra = view.getUint16(at + 28, true);
    const name = decoder.decode(data.subarray(at + 30, at + 30 + nameLength));
    const body = data.subarray(at + 30 + nameLength + extra, at + 30 + nameLength + extra + size);
    parts[name] = decoder.decode(method === 8 ? inflateRawSync(body) : body);
    at += 30 + nameLength + extra + size;
  }
  return parts;
}

/** word/document.xml of a .docx. */
const documentXml = async (data: Uint8Array) => (await docxParts(data))["word/document.xml"] ?? "";

/** The example's programador profile in an ATS style, picked as the editor does (with its preset). */
function inAtsStyle(style: string): Project {
  const p = structuredClone(example);
  p.profiles.programador.layout = { ...pickStyle(p.profiles.programador.layout, style), length: "full" };
  return p;
}

/** The example with the programmer profile in a given style (built-in, or "mio", one's own). */
function inStyle(style: string): Project {
  const p = structuredClone(example);
  if (style === "mio") p.templates = { mio: { name: "Mío", source: '#import "/lib.typ": *\n#cv.name' } };
  p.profiles.programador.layout = { ...p.profiles.programador.layout, template: style };
  return p;
}

describe("resolve", () => {
  test("entries, dates and contacts", () => {
    const cv = resolveProfile(example, "programador");
    expect(cv.name).toBe("Bautista Damián Fiori");
    expect(cv.contacts.map((c) => c.kind)).toEqual(["phone", "email", "linkedin"]);
    expect(cv.contacts[2].href).toBe("https://linkedin.com/in/b-d-fiori");
    const first = cv.sections[0].blocks[0];
    expect(first.type === "entry" && first.entry.period).toBe("05/2026 – actualidad");
    expect(cv.sections.filter((s) => s.side).map((s) => s.id)).toEqual(["fortalezas", "proyectos-personales"]);
  });

  test("one column puts every section in the main flow", () => {
    const p = structuredClone(example);
    p.profiles.programador.layout = { columns: 1 };
    expect(resolveProfile(p, "programador").sections.some((s) => s.side)).toBe(false);
  });

  test("image sizes from headers", () => {
    const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAIAAAASFvFNAAAAEklEQVR4nGP4z8DwnwEIGP4DAC/kBPxtZ0k3AAAAAElFTkSuQmCC"), (c) => c.charCodeAt(0));
    expect(imageSize(png)).toEqual({ width: 3, height: 2 });
  });
});

describe("LaTeX", () => {
  test("escapes specials and keeps bold", () => {
    expect(escapeLatex("50% & $5 #1 a_b {x} ~ ^ \\")).toBe("50\\% \\& \\$5 \\#1 a\\_b \\{x\\} \\textasciitilde{} \\textasciicircum{} \\textbackslash{}");
    expect(inlineLatex("a **b_c** d")).toBe("a \\textbf{b\\_c} d");
  });

  test("two columns: header frame, sidebar first, main after the frame break", () => {
    const tex = renderLatex(resolveProfile(example, "programador"));
    expect(tex).toContain("\\newstaticframe[1]{\\textwidth}");
    expect(tex).toContain("\\FitSide{");
    expect(tex.indexOf("\\SideHeading{Fortalezas}")).toBeLessThan(tex.indexOf("\\framebreak"));
    expect(tex.indexOf("\\framebreak")).toBeLessThan(tex.indexOf("\\CVSection{Experiencia}"));
    expect(tex).toContain("\\definecolor{accent}{HTML}{1F5F5B}");
    expect(tex).not.toMatch(/dotted|RoyalBlue|cmyk/);
    expect(tex).not.toContain("photo"); // the fixture's photo is an SVG, which pdflatex cannot take
  });

  test("layout options reach the preamble", () => {
    const p = structuredClone(example);
    p.profiles.programador.layout = { columns: 1, paper: "us-letter", accent: "#aa3355", fontSize: 11, labels: "en" };
    const tex = renderLatex(resolveProfile(p, "programador"));
    expect(tex).toContain("\\documentclass[letterpaper,11pt]{memoir}");
    expect(tex).toContain("\\definecolor{accent}{HTML}{AA3355}");
    expect(tex).not.toContain("flowframe");
    expect(tex).toContain("\\CVSection{Skills}");
  });

  test("the profile's style reaches the LaTeX export", async () => {
    const files = async (style: string) => unzip((await exportFiles(inStyle(style), "programador", "tex"))[0].data);
    const banda = await files("banda");
    const bandaTex = decoder.decode(banda["cv.tex"]);
    expect(bandaTex).toContain("Banda style");
    expect(bandaTex).toContain("\\AddToShipoutPictureBG*");
    expect(bandaTex).not.toContain("flowframe"); // one column, as in Typst
    expect(bandaTex).toContain("left=16mm,right=16mm");
    expect(bandaTex).toContain("\\usepackage[sfdefault]{noto}");
    expect(decoder.decode(banda["README.txt"])).toContain("Banda style");
    const minimalTex = decoder.decode((await files("minimal"))["cv.tex"]);
    expect(minimalTex).toContain("Minimal style");
    expect(minimalTex).toContain("\\definecolor{accent}{HTML}{141414}");
    expect(minimalTex).not.toMatch(/flowframe|AddToShipout/);
    // A style of one's own is Typst: LaTeX comes out as Legajo, and the README says so.
    const own = await files("mio");
    expect(decoder.decode(own["cv.tex"])).toContain("Legajo style");
    expect(decoder.decode(own["README.txt"])).toContain("The Typst export keeps your style.");
  });

  test.each(ATS_STYLES)("%s: one column of text, the contacts in the body before the first title", async (style) => {
    const files = unzip((await exportFiles(inAtsStyle(style), "programador", "tex"))[0].data);
    const tex = decoder.decode(files["cv.tex"]);
    expect(tex).toContain(`${STYLE_NAMES[style]} style`);
    expect(tex).not.toMatch(/flowframe|AddToShipout|includegraphics|tabular|\\FitSide/);
    expect(tex).toContain(style === "claustro" ? "\\usepackage{XCharter}" : "\\usepackage[sfdefault]{noto}");
    const body = tex.slice(tex.indexOf("\\begin{document}"));
    expect(body).toContain("\\raggedright\\hyphenpenalty=10000"); // no word split at a line end
    expect(body.indexOf("email@example.com")).toBeGreaterThan(0);
    expect(body.indexOf("email@example.com")).toBeLessThan(body.indexOf("\\CVSection"));
    // Every part under a title: the summary under "Perfil", the skills under "Habilidades".
    expect(body.indexOf("\\CVSection{Perfil}")).toBeGreaterThan(0);
    expect(body.indexOf("\\CVSection{Perfil}")).toBeLessThan(body.indexOf("\\CVSection{Habilidades}"));
    expect(decoder.decode(files["README.txt"])).toContain(`${STYLE_NAMES[style]} style`);
  });

  test("Claustro: the name centred, the institution above the position and the dates", () => {
    const cv = resolveProfile(inAtsStyle("claustro"), "programador");
    const tex = renderLatex(cv, "claustro");
    expect(tex).toContain("{\\centering");
    const first = cv.sections[0].blocks[0];
    if (first.type !== "entry") throw new Error("the first block is not an entry");
    const e = first.entry;
    expect(tex).toContain(`\\textbf{${escapeLatex(e.place)}}\\\\\\textit{${escapeLatex(e.title)}}\\hfill{${escapeLatex(e.period)}}`);
  });

  test("the bundle carries a JPEG photo", async () => {
    const p = structuredClone(example);
    p.assets = { "photo.jpg": { type: "image/jpeg", data: toBase64(new Uint8Array([0xff, 0xd8, 0xff, 0xd9])) } };
    p.person.photo = "photo.jpg";
    const [file] = await exportFiles(p, "programador", "tex");
    expect(Object.keys(unzip(file.data)).sort()).toEqual(["README.txt", "cv.tex", "photo.jpg"]);
  });
});

describe("Markdown", () => {
  test("escapes but keeps bold", () => {
    expect(inlineMarkdown("a **b** _c_ [d]")).toBe("a **b** \\_c\\_ \\[d\\]");
  });

  test("a readable CV", () => {
    const md = renderMarkdown(resolveProfile(example, "programador"));
    expect(md.startsWith("# Bautista Damián Fiori\n\n**Programador**\n")).toBe(true);
    expect(md).toContain("[email@example.com](mailto:email@example.com)");
    expect(md).toContain("### Desarrollador de software\n\n*Obrok* · 05/2026 – actualidad");
    expect(md).toContain("- **Datalogger ATtiny85.** Diseño de un datalogger");
    expect(md.indexOf("## Educación")).toBeLessThan(md.indexOf("## Fortalezas"));
    expect(md).not.toMatch(/\n{3}/);
  });
});

describe("files", () => {
  test("names and the all-formats bundle", async () => {
    const files = [
      ...(await exportFiles(example, "docente-ia", "md")),
      ...(await exportFiles(example, "docente-ia", "json")),
      ...(await exportFiles(example, "docente-ia", "docx")),
    ];
    expect(files.map((f) => f.name)).toEqual([
      "bautista-damian-fiori-docente-ia.md",
      "bautista-damian-fiori.foja.json",
      "bautista-damian-fiori-docente-ia.resolved.json",
      "bautista-damian-fiori-docente-ia.docx",
    ]);
    expect(JSON.parse(decoder.decode(files[1].data))).toEqual(example);
    const resolved = JSON.parse(decoder.decode(files[2].data));
    expect(resolved.format).toBe("foja/2-resolved");
    const all = bundleExports(example, "docente-ia", files);
    expect(Object.keys(unzip(all.data))).toHaveLength(4);
  });

  test("Word: a valid package with the text and the bullets", async () => {
    const [docx] = await exportFiles(example, "programador", "docx");
    expect(docx.data[0]).toBe(0x50); // PK
    const xml = await documentXml(docx.data);
    expect(xml).toContain("Bautista Damián Fiori");
    expect(xml).toContain("Datalogger ATtiny85. ");
    expect(xml).toContain("<w:smallCaps/>");
    expect(xml).toMatch(/w:fill="[0-9A-F]{6}"/); // the shaded sidebar
    expect(xml).not.toContain('w:val="dotted"');
  });

  test("Word follows the profile's style", async () => {
    const banda = await documentXml((await exportFiles(inStyle("banda"), "programador", "docx"))[0].data);
    expect(banda).toContain('w:fill="1F5F5B"'); // the band behind the name
    expect(banda).toMatch(/<w:left [^>]*w:color="1F5F5B"/); // the bar before each title
    expect(banda).not.toContain("<w:smallCaps/>");
    const minimal = await documentXml((await exportFiles(inStyle("minimal"), "programador", "docx"))[0].data);
    expect(minimal).not.toContain("<w:smallCaps/>");
    expect(minimal).not.toMatch(/w:fill="[0-9A-F]{6}"/);
    expect(minimal).toContain("EXPERIENCIA");
  });

  // What LibreOffice showed when it opened the exports (11/11/2026); Word follows the same rules.
  test("Word, two columns: the row of the whole CV can start on the first page", async () => {
    const xml = await documentXml((await exportFiles(example, "programador", "docx"))[0].data);
    // A row is kept with what follows when the first paragraph of a cell is: then a row as tall as the page
    // starts on the second one. The outer table is the first; its cells are the first ones.
    const outer = xml.slice(xml.indexOf("<w:tbl>"));
    const cells = outer.split("<w:tc>").slice(1, 4);
    for (const cell of cells) expect(cell.slice(cell.indexOf("<w:p>"), cell.indexOf("</w:p>"))).not.toContain("<w:keepNext/>");
  });

  test("Word: gaps are exact, not blank lines; entries are not cut between pages", async () => {
    const xml = await documentXml((await exportFiles(example, "programador", "docx"))[0].data);
    // An empty paragraph spaced only after would add a whole line before the space.
    expect(xml).not.toMatch(/<w:p><w:pPr><w:spacing w:after="\d+"\/><\/w:pPr><\/w:p>/);
    expect(xml).toMatch(/<w:spacing w:after="0" w:before="0" w:line="\d+" w:lineRule="exact"\/>/);
    expect(xml).toContain("<w:cantSplit/>");
  });

  test("Word: hyphenation in the CV's language, and Typst's line spacing", async () => {
    const parts = await docxParts((await exportFiles(example, "programador", "docx"))[0].data);
    expect(parts["word/settings.xml"]).toContain("<w:autoHyphenation/>");
    expect(parts["word/styles.xml"]).toContain('w:lang w:val="es-ES"');
    expect(wordLanguage("en")).toBe("en-US");
    expect(wordLanguage("pt-BR")).toBe("pt-BR");
    // Baseline to baseline as in Typst: 10 pt XCharter with a leading of 0.55 em is 12.2 pt; Georgia's single
    // line is 11.4 pt. Noto Sans has a much taller single line, so it gets less than single.
    expect(lineSpacing("legajo", false)).toBe(259);
    expect(lineSpacing("banda", true)).toBe(232);
  });

  test.each(["banda", "minimal"] as const)("Word in %s: the dates at the right margin, as in Typst", async (style) => {
    const xml = await documentXml((await exportFiles(inStyle(style), "programador", "docx"))[0].data);
    expect(xml).toMatch(/<w:tab w:val="right"/);
    // No column of dates: the only tables left are Banda's band.
    expect(xml.split("<w:tbl>").length - 1).toBe(style === "banda" ? 1 : 0);
  });

  test.each(ATS_STYLES)("Word in %s: paragraphs only, the contacts in the body, no header or footer", async (style) => {
    const parts = await docxParts((await exportFiles(inAtsStyle(style), "programador", "docx"))[0].data);
    const xml = parts["word/document.xml"];
    expect(xml).not.toContain("<w:tbl>");
    expect(xml).toMatch(/<w:tab w:val="right"/); // the dates on a tab stop at the right margin
    expect(Object.keys(parts).filter((name) => /header|footer/.test(name))).toEqual([]);
    const email = xml.indexOf("email@example.com");
    expect(email).toBeGreaterThan(xml.indexOf("Bautista Damián Fiori"));
    expect(email).toBeLessThan(xml.search(/>(PERFIL|Perfil)</));
    expect(xml).not.toContain("<w:drawing>"); // the preset leaves the photo out
  });
});

describe("hostile or unusual input", () => {
  test("a contact cannot inject LaTeX", () => {
    const p = structuredClone(example);
    p.contacts.email = "a}{x}\\input{/etc/passwd}\\iffalse{";
    p.contacts.website = "https://ex.com/a b_c~d#e%f&g";
    p.profiles.programador.contacts = ["email", "website"];
    const tex = renderLatex(resolveProfile(p, "programador"));
    const hrefs = [...tex.matchAll(/\\href\{([^}]*)\}/g)].map((m) => m[1]);
    expect(hrefs).toHaveLength(2);
    // Only plain characters and escaped percent signs are left.
    for (const h of hrefs) expect(h.replace(/\\%/g, "%")).toMatch(/^[A-Za-z0-9\-./:?=@+,;%]+$/);
    expect(tex).not.toContain("\\input{/etc/passwd}");
  });

  test("ids that are Object.prototype members are not found", () => {
    const p = structuredClone(example);
    p.profiles.programador.sections[0].blocks.push({ type: "entry", entry: "constructor" });
    p.profiles.programador.skills.push(["tostring"]);
    expect(validate(p).filter((x) => x.severity === "error").map((x) => x.message)).toEqual(['no skill group "tostring"', 'no entry "constructor"']);
  });

  test("empty texts and a dropped contact are warnings, not errors", () => {
    const p = structuredClone(example);
    p.profiles.programador.subtitle = "";
    p.profiles.programador.sections[0].blocks.push({ type: "item", text: "" });
    delete p.contacts.phone;
    const problems = validate(p);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.every((x) => x.severity === "warning")).toBe(true);
  });

  test("names without Latin letters still give file names", async () => {
    const p = structuredClone(example);
    p.person.givenNames = ["Мария"];
    p.person.familyNames = ["Иванова"];
    const [md] = await exportFiles(p, "programador", "md");
    expect(md.name).toBe("cv-programador.md");
  });

  test("a skill starting with [ or * keeps LaTeX line breaks sound", () => {
    const p = structuredClone(example);
    const first = Object.keys(p.skills)[0];
    p.skills[first].items = ["[C++]", "*nix", "Go"].map((text, i) => ({ id: `s${i}`, text }));
    const tex = renderLatex(resolveProfile(p, "programador"));
    expect(tex).toContain("[C++]\\\\{}*nix\\\\{}Go");
    expect(tex).not.toMatch(/\\\\\s*\[C/);
  });

  test("control characters do not reach the Word XML", async () => {
    const p = structuredClone(example);
    p.profiles.programador.summary = "uno\u000bdos\u000ctres";
    const [docx] = await exportFiles(p, "programador", "docx");
    const { inflateRawSync } = await import("node:zlib");
    const view = new DataView(docx.data.buffer, docx.data.byteOffset);
    let at = 0;
    let xml = "";
    while (view.getUint32(at, true) === 0x04034b50) {
      const method = view.getUint16(at + 8, true);
      const size = view.getUint32(at + 18, true);
      const nameLength = view.getUint16(at + 26, true);
      const extra = view.getUint16(at + 28, true);
      const name = decoder.decode(docx.data.subarray(at + 30, at + 30 + nameLength));
      const body = docx.data.subarray(at + 30 + nameLength + extra, at + 30 + nameLength + extra + size);
      if (name === "word/document.xml") xml = decoder.decode(method === 8 ? inflateRawSync(body) : body);
      at += 30 + nameLength + extra + size;
    }
    expect(xml).toContain("uno dos tres");
    expect(xml).not.toMatch(/[\u000b\u000c]/);
  });
});
