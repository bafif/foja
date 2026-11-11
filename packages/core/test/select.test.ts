import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { migrate, resolveProfile, skillsFromLines, validate, type Project, type ResolvedCv } from "../src/index.ts";
import { exportFiles } from "../src/export/index.ts";

const read = (name: string): Project => JSON.parse(readFileSync(new URL(`../../../examples/${name}`, import.meta.url), "utf8"));
const fictional = read("fictional.project.json");
const curriculum = read("curriculum.project.json");

/** The same project as format 2 wrote it: no ids on items, skills as plain strings. */
function asFormat2(project: Project): unknown {
  const p: any = structuredClone(project);
  p.format = "foja/2";
  for (const e of Object.values<any>(p.entries)) e.items = e.items?.map(({ id: _, ...it }: any) => it);
  for (const g of Object.values<any>(p.skills)) g.items = g.items.map((s: any) => s.text);
  for (const e of Object.values<any>(p.entries)) if (!e.items) delete e.items;
  return p;
}

const entryIds = (cv: ResolvedCv) => cv.sections.flatMap((s) => s.blocks.flatMap((b) => (b.type === "entry" ? [b.entry.id] : [])));
const itemTexts = (cv: ResolvedCv, entry: string) => cv.sections.flatMap((s) => s.blocks.flatMap((b) => (b.type === "entry" && b.entry.id === entry ? b.entry.items.map((it) => it.text) : [])));

describe("migration from format 2", () => {
  test("gives the fixtures as they are in the repository", () => {
    for (const p of [fictional, curriculum]) expect(migrate(asFormat2(p))).toEqual(p);
  });

  test("leaves a current project alone and the rest for validate", () => {
    expect(migrate(fictional)).toBe(fictional);
    expect(migrate("nope")).toBe("nope");
    expect(validate(migrate({ format: "foja/2" }))[0].message).toBe('missing "language"');
  });

  test("an old project comes out as it did: everything in, nothing filtered", () => {
    const old = migrate(asFormat2(curriculum)) as Project;
    expect(validate(old)).toEqual([]);
    for (const id of Object.keys(old.profiles)) {
      const cv = resolveProfile(old, id);
      for (const b of old.profiles[id].sections.flatMap((s) => s.blocks)) {
        if (b.type === "entry") expect(itemTexts(cv, b.entry)).toEqual((old.entries[b.entry].items ?? []).map((it) => it.text));
      }
      expect(cv.skills.flat().map((g) => g.items)).toEqual(old.profiles[id].skills.flat().map((g) => old.skills[g].items.map((s) => s.text)));
      expect(cv.summary).toBe(old.profiles[id].summary);
      expect(cv.sections.map((s) => s.id)).toEqual(old.profiles[id].sections.map((s) => s.id));
    }
  });
});

describe("priorities, length and overrides", () => {
  /** The fictional developer with a few things marked. */
  function marked(): Project {
    const p = structuredClone(fictional);
    p.entries["nube-sur"].priority = "essential";
    p.entries["datos-abiertos"].priority = "extra";
    p.entries["nube-sur"].items![0].priority = "essential";
    p.entries["nube-sur"].items![2].priority = "extra";
    p.skills.lenguajes.items[3].priority = "extra";
    p.skills.idiomas.items.forEach((s) => (s.priority = "extra"));
    return p;
  }
  const at = (length: "short" | "normal" | "full", extra: Partial<Project["profiles"][string]> = {}) => {
    const p = marked();
    Object.assign(p.profiles.desarrolladora, extra);
    p.profiles.desarrolladora.layout = { ...p.profiles.desarrolladora.layout, length };
    return resolveProfile(p, "desarrolladora");
  };

  test("full shows everything, normal leaves the extra out, short keeps the essential", () => {
    const full = at("full");
    expect(entryIds(full)).toContain("datos-abiertos");
    expect(itemTexts(full, "nube-sur")).toHaveLength(3);
    expect(full.skills.flat().map((g) => g.title)).toContain("Idiomas");

    const normal = at("normal");
    expect(entryIds(normal)).not.toContain("datos-abiertos");
    expect(itemTexts(normal, "nube-sur")).toHaveLength(2);
    expect(normal.skills.flat().find((g) => g.title === "Lenguajes")!.items).toEqual(["TypeScript", "Python", "SQL"]);
    // A group the selection emptied goes away.
    expect(normal.skills.flat().map((g) => g.title)).not.toContain("Idiomas");

    const short = at("short");
    expect(entryIds(short)).toEqual(["nube-sur"]);
    expect(itemTexts(short, "nube-sur")).toEqual([fictional.entries["nube-sur"].items![0].text]);
    expect(short.skills).toEqual([]);
    // Sections the selection emptied go away; their order and titles otherwise stay.
    expect(short.sections.map((s) => s.id)).toEqual(normal.sections.filter((s) => s.blocks.some((b) => b.type !== "entry" || b.entry.id === "nube-sur")).map((s) => s.id));
  });

  test("overrides put in or leave out one thing, whatever the length", () => {
    const cv = at("short", { overrides: { "entries/datos-abiertos": true, "entries/nube-sur/items/calidad": true, "skills/lenguajes/typescript": true, "entries/nube-sur": true } });
    expect(entryIds(cv)).toEqual(["nube-sur", "datos-abiertos"]);
    expect(itemTexts(cv, "nube-sur")).toHaveLength(2);
    expect(cv.skills.flat()).toEqual([{ title: "Lenguajes", items: ["TypeScript"] }]);
    expect(entryIds(at("full", { overrides: { "entries/nube-sur": false } }))).not.toContain("nube-sur");
  });

  test("an empty section stays, as before", () => {
    const p = marked();
    p.profiles.desarrolladora.sections.push({ id: "vacia", title: "Vacía", blocks: [] });
    p.profiles.desarrolladora.layout = { length: "short" };
    expect(resolveProfile(p, "desarrolladora").sections.map((s) => s.id)).toContain("vacia");
  });

  test("the short summary goes with the short length, or when the profile asks for it", () => {
    const summaryShort = "Desarrolladora full stack.";
    expect(at("short", { summaryShort }).summary).toBe(summaryShort);
    expect(at("normal", { summaryShort }).summary).toBe(fictional.profiles.desarrolladora.summary);
    expect(at("short").summary).toBe(fictional.profiles.desarrolladora.summary); // no short one written
    const p = marked();
    p.profiles.desarrolladora.summaryShort = summaryShort;
    p.profiles.desarrolladora.layout = { summaryLength: "short" };
    expect(resolveProfile(p, "desarrolladora").summary).toBe(summaryShort);
    p.profiles.desarrolladora.layout = { length: "short", summaryLength: "long" };
    expect(resolveProfile(p, "desarrolladora").summary).toBe(fictional.profiles.desarrolladora.summary);
  });

  test("a compact section still drops the items of its entries", async () => {
    const p = marked();
    p.profiles.desarrolladora.sections[0].compact = true;
    p.profiles.desarrolladora.layout = { ...p.profiles.desarrolladora.layout, length: "full" };
    const md = new TextDecoder().decode((await exportFiles(p, "desarrolladora", "md"))[0].data);
    expect(md).not.toContain("Facturación");
  });
});

describe("ids", () => {
  test("edited skill lines keep their ids and priorities", () => {
    const before = [
      { id: "ts", text: "TypeScript", priority: "essential" as const },
      { id: "py", text: "Python" },
      { id: "go", text: "Go", priority: "extra" as const },
    ];
    // Reordered, one edited in place, one new.
    const after = skillsFromLines(["Go", "Python 3", "TypeScript", "Rust"], before);
    expect(after).toEqual([
      { id: "go", text: "Go", priority: "extra" },
      { id: "py", text: "Python 3" },
      { id: "ts", text: "TypeScript", priority: "essential" },
      { id: "rust", text: "Rust" },
    ]);
    expect(skillsFromLines(["C", "C++", "C#"], []).map((s) => s.id)).toEqual(["c", "c-2", "c-3"]);
  });

  test("duplicate ids and bad override keys are errors", () => {
    const p = structuredClone(fictional);
    p.entries["nube-sur"].items![1].id = p.entries["nube-sur"].items![0].id;
    p.skills.lenguajes.items[1].id = "typescript";
    p.profiles.desarrolladora.overrides = { "entries/nube-sur": true, "nada/x": false };
    expect(validate(p).map((x) => x.path)).toEqual(["/profiles/desarrolladora/overrides/nada~1x"]);
    delete p.profiles.desarrolladora.overrides;
    expect(validate(p).map((x) => x.message)).toEqual(['duplicate item id "facturacion"', 'duplicate skill id "typescript"']);
  });
});
