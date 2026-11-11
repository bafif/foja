import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import { BUILTIN_STYLES, STYLE_SKELETON, markBoxes, overflowLines, partAt, resolveProfile, slug, typstBundle, validate, type Layout, type Project } from "@foja/core";
import { Typst, templateFiles } from "../src/typst.ts";
import { parseMarkdown } from "../src/convert.ts";

const read = (path: string): Project => JSON.parse(readFileSync(new URL(`../../../examples/${path}`, import.meta.url), "utf8"));
const curriculum = read("curriculum.project.json");
// The editor's examples: my own CV, and made-up people with little experience, each with a profile
// in an eye-catching style first and one for job portals second. The fictional project is the
// fixture the tests shape at will.
const invented = ["pasantia", "cosmetologa", "primer-empleo"].map((name) => [read(`${name}.project.json`), read(`${name}.en.project.json`)]);
const examples = [read("example.project.json"), read("example.en.project.json"), ...invented.flat()];
const fictional = read("fictional.project.json");
const A4 = { width: 595.28, height: 841.89 };

function withStyle(project: Project, style: string, layout: Layout = {}): Project {
  const p = structuredClone(project);
  for (const profile of Object.values(p.profiles)) profile.layout = { ...profile.layout, ...layout, template: style };
  return p;
}

describe.each(BUILTIN_STYLES.map((s) => s.id))("style %s", (style) => {
  test("compiles every profile, with marks in pairs and a declared geometry", () => {
    for (const project of [curriculum, fictional, ...examples]) {
      const p = withStyle(project, style);
      const typst = new Typst(p);
      for (const id of Object.keys(p.profiles)) {
        const doc = typst.compile(id);
        expect(typst.pdf(doc).subarray(0, 5).toString()).toBe("%PDF-");
        const marks = typst.marks(doc);
        const paths = new Set(marks.map((m) => m.path));
        for (const path of ["name", "subtitle", "sections.0", "sections.0.blocks.0"]) expect(paths).toContain(path);
        for (const path of paths) expect(marks.filter((m) => m.path === path).map((m) => m.kind).sort()).toEqual(["end", "start"]);
        expect(typst.geometry(doc)?.main?.width).toBeGreaterThan(200);
      }
    }
  });
});

test("the examples fit on one page in the default style", () => {
  for (const project of [fictional, ...examples]) {
    const typst = new Typst(project);
    for (const id of Object.keys(project.profiles)) expect(typst.compile(id).numOfPages).toBe(1);
  }
});

test("the made-up people: valid, the same profiles in both languages, between them every style for a short CV", () => {
  const styles = (p: Project) => Object.values(p.profiles).map((profile) => profile.layout?.template ?? "legajo");
  const layouts = (p: Project) => Object.values(p.profiles).map((profile) => profile.layout);
  const firsts: string[] = [];
  const seconds: string[] = [];
  for (const [es, en] of invented) {
    expect(es.language).toBe("es");
    expect(en.language).toBe("en");
    expect(validate(es)).toEqual([]);
    expect(validate(en)).toEqual([]);
    expect(layouts(en)).toEqual(layouts(es));
    const [first, second] = styles(es);
    firsts.push(first);
    seconds.push(second);
  }
  expect(firsts.sort()).toEqual(["arco", "portada", "rotulo"]);
  expect(seconds.sort()).toEqual(["claustro", "llano", "recto"]);
});

describe("click geometry (Legajo)", () => {
  const typst = new Typst(fictional);
  const doc = typst.compile("desarrolladora");
  const marks = typst.marks(doc);
  const geometry = typst.geometry(doc)!;
  const boxes = markBoxes(marks, geometry, A4);

  test("the two columns are declared", () => {
    expect(geometry.side!.x).toBeLessThan(geometry.main!.x);
  });

  test("a point finds the innermost part in its column", () => {
    const entry = boxes.find((b) => b.path === "sections.0.blocks.1")!;
    expect(partAt(boxes, 1, entry.x + 10, entry.y + entry.height / 2)).toBe("sections.0.blocks.1");
    const contacts = boxes.find((b) => b.path === "contacts")!;
    expect(contacts.x).toBe(geometry.side!.x);
    expect(partAt(boxes, 1, contacts.x + 20, contacts.y + contacts.height / 2)).toBe("contacts");
  });

  test("overflow is counted in lines", () => {
    expect(overflowLines(marks)).toBe(0);
    const long = structuredClone(fictional);
    const s = long.profiles.desarrolladora.sections[0];
    s.blocks = Array.from({ length: 6 }, () => s.blocks).flat();
    const t2 = new Typst(long);
    const m2 = t2.marks(t2.compile("desarrolladora"));
    expect(Math.max(...m2.map((m) => m.page))).toBeGreaterThan(1);
    expect(overflowLines(m2)).toBeGreaterThan(5);
  });
});

const variants: [string, Layout][] = [
  ["one column", { columns: 1 }],
  ["one column, round photo", { columns: 1, photo: "circle" }],
  ["sidebar on the right, wide", { sidebar: "right", sidebarWidth: 38 }],
  ["no photo", { photo: "none" }],
  ["English labels, month names", { labels: "en", dateFormat: "MMM YYYY" }],
  ["years only, sans", { dateFormat: "YYYY", font: "Noto Sans" }],
  ["letter paper, wide margins", { paper: "us-letter", margins: { top: 25, bottom: 25, left: 25, right: 25 } }],
  ["compact, small type", { density: "compact", fontSize: 9 }],
  ["relaxed, large type, accent", { density: "relaxed", fontSize: 11, accent: "#aa3355" }],
];

describe("layout options", () => {
  test.each(variants)("%s", (_, layout) => {
    for (const style of BUILTIN_STYLES.map((s) => s.id)) {
      const p = withStyle(curriculum, style, layout);
      expect(validate(p)).toEqual([]);
      expect(new Typst(p).compile("programador").numOfPages).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("styles of one's own", () => {
  test("the skeleton compiles as a project style", () => {
    const p = structuredClone(fictional);
    p.templates = { mio: { name: "Mío", source: STYLE_SKELETON } };
    p.profiles.desarrolladora.layout = { template: "mio" };
    expect(validate(p)).toEqual([]);
    const typst = new Typst(p);
    const doc = typst.compile("desarrolladora");
    expect(new Set(typst.marks(doc).map((m) => m.path))).toContain("sections.0.blocks.0");
  });

  test("a style that does not exist is a validation error", () => {
    const p = structuredClone(fictional);
    p.profiles.desarrolladora.layout = { template: "nada" };
    expect(validate(p).map((x) => x.path)).toEqual(["/profiles/desarrolladora/layout/template"]);
  });

  test("a style cannot read files outside the project", () => {
    for (const path of ["/etc/hostname", "../../../../etc/hostname", "/proc/self/environ"]) {
      const p = structuredClone(fictional);
      p.templates = { espia: { name: "Espía", source: `#import "/lib.typ": *\n#read(${JSON.stringify(path)})` } };
      p.profiles.desarrolladora.layout = { template: "espia" };
      expect(() => new Typst(p).compile("desarrolladora"), path).toThrow(/Typst failed/);
    }
  });

  test("an incomplete date does not break the layout", () => {
    const p = structuredClone(fictional);
    p.entries[Object.keys(p.entries)[0]].end = "";
    expect(new Typst(p).compile("desarrolladora").numOfPages).toBeGreaterThanOrEqual(1);
  });

  test("a style with a Typst error reports it", () => {
    const p = structuredClone(fictional);
    p.templates = { roto: { name: "Roto", source: '#import "/lib.typ": *\n#cv.nope' } };
    p.profiles.desarrolladora.layout = { template: "roto" };
    expect(() => new Typst(p).compile("desarrolladora")).toThrow(/Typst failed/);
  });
});

test("the Typst bundle compiles on its own", () => {
  const p = withStyle(fictional, "banda");
  const files = typstBundle(p, "docente", templateFiles());
  expect(Object.keys(files)).toEqual(expect.arrayContaining(["cv.typ", "lib.typ", "styles/legajo.typ", "styles/banda.typ", "styles/minimal.typ"]));
  const fontBlobs = Object.entries(files)
    .filter(([name]) => /\.(otf|ttf)$/.test(name))
    .map(([, data]) => Buffer.from(data as Uint8Array));
  const compiler = NodeCompiler.create({ workspace: "/bundle", fontArgs: [{ fontBlobs }] });
  for (const [name, data] of Object.entries(files)) {
    compiler.mapShadow(`/bundle/${name}`, Buffer.from(typeof data === "string" ? new TextEncoder().encode(data) : data));
  }
  const result = compiler.compile({ mainFilePath: "/bundle/cv.typ", inputs: { profile: "docente" } });
  expect(result.takeError()).toBeNull();
  expect(result.result?.numOfPages).toBe(1);
});

describe("curriculum converter", () => {
  test("slug", () => {
    expect(slug("Programación")).toBe("programacion");
    expect(slug("Experiencia docente y de debate")).toBe("experiencia-docente-y-de-debate");
  });
  test("parseMarkdown", () => {
    expect(parseMarkdown("intro\n# Uno\nlinea a\nlinea b\n\n# Dos\nc")).toEqual([
      { text: "intro" },
      { heading: "Uno", text: "linea a linea b" },
      { heading: "Dos", text: "c" },
    ]);
  });
});

describe("Typst picks what the other exports pick", () => {
  // A style that lays out nothing and hands back what lib.typ resolved.
  const DUMP = `#import "/lib.typ": *
#metadata((
  summary: cv.summary,
  skills: cv.skills,
  sections: cv.sections.map(s => (id: s.id, path: s.path, blocks: s.blocks.map(b => if b.type == "entry" { (entry: b.id, path: b.path, items: b.items.map(it => it.text)) } else { (text: b.text, path: b.path) }))),
))<cv-dump>`;

  /** The same shape from resolve.ts (paths aside, which only Typst has). */
  function fromResolve(p: Project, id: string) {
    const cv = resolveProfile(p, id);
    return {
      summary: cv.summary,
      skills: cv.skills,
      sections: cv.sections.map((s) => ({ id: s.id, blocks: s.blocks.map((b) => (b.type === "entry" ? { entry: b.entry.id, items: b.entry.items.map((it) => it.text) } : { text: b.text })) })),
    };
  }
  const withoutPaths = (dump: any) => ({ ...dump, sections: dump.sections.map(({ path: _, ...s }: any) => ({ ...s, blocks: s.blocks.map(({ path: __, ...b }: any) => b) })) });

  /** Entries, items and skills marked essential, normal or extra in turn, and a short summary. */
  function marked(project: Project): Project {
    const p = structuredClone(project);
    const cycle = ["essential", undefined, "extra"] as const;
    Object.values(p.entries).forEach((e, i) => {
      e.priority = cycle[i % 3];
      e.items?.forEach((it, j) => (it.priority = cycle[(i + j) % 3]));
    });
    Object.values(p.skills).forEach((g, i) => g.items.forEach((s, j) => (s.priority = cycle[(i + j + 1) % 3])));
    for (const profile of Object.values(p.profiles)) profile.summaryShort = "Corto.";
    return p;
  }

  test.each(["short", "normal", "full"] as const)("length %s, with overrides", (length) => {
    for (const project of [marked(curriculum), marked(fictional)]) {
      const p = structuredClone(project);
      for (const profile of Object.values(p.profiles)) {
        profile.layout = { ...profile.layout, template: "dump", length };
        const firstEntry = profile.sections.flatMap((s) => s.blocks).find((b) => b.type === "entry");
        if (firstEntry?.type === "entry") profile.overrides = { [`entries/${firstEntry.entry}`]: length !== "full" };
      }
      p.templates = { dump: { name: "Dump", source: DUMP } };
      const typst = new Typst(p);
      for (const id of Object.keys(p.profiles)) {
        const [dump] = typst.query<any>(typst.compile(id), "cv-dump");
        expect(withoutPaths(dump), id).toEqual(fromResolve(p, id));
        // Paths keep each part's place in the profile, so a click still finds it.
        for (const s of dump.sections) for (const b of s.blocks) expect(b.path.startsWith(s.path + ".blocks.")).toBe(true);
      }
    }
  });
});
