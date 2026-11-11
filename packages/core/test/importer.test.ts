import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, test } from "vitest";
import { importData, importStyle, parsePeriod, proposeMapping, readTemplate, readUpload, safePath, validate, zip, UPLOAD_LIMITS, type Project } from "../src/index.ts";

const fixtures = new URL("./fixtures/", import.meta.url).pathname;
const single = new Uint8Array(readFileSync(join(fixtures, "single.typ")));
const fictional: Project = JSON.parse(readFileSync(new URL("../../../examples/fictional.project.json", import.meta.url), "utf8"));

/** Every file under a fixture folder, by relative path. */
function folder(dir: string, base = dir): Record<string, Uint8Array> {
  return Object.fromEntries(
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? Object.entries(folder(path, base)) : [[path.slice(base.length + 1), new Uint8Array(readFileSync(path))]];
    }),
  );
}

/** A .tar.gz of `files` (ustar headers, enough for the reader). */
function tarGz(files: Record<string, Uint8Array | string>): Uint8Array {
  const blocks: Uint8Array[] = [];
  const enc = new TextEncoder();
  for (const [name, content] of Object.entries(files)) {
    const data = typeof content === "string" ? enc.encode(content) : content;
    const header = new Uint8Array(512);
    header.set(enc.encode(name).subarray(0, 100), 0);
    header.set(enc.encode(data.length.toString(8).padStart(11, "0") + "\0"), 124);
    header[156] = "0".charCodeAt(0);
    blocks.push(header, data, new Uint8Array((512 - (data.length % 512)) % 512));
  }
  blocks.push(new Uint8Array(1024));
  return new Uint8Array(gzipSync(Buffer.concat(blocks)));
}

describe("uploads", () => {
  test("unsafe paths are refused", () => {
    for (const bad of ["../x.typ", "/etc/passwd", "a/../../b.typ", "C:\\x.typ", "a\\b.typ", "./../x"]) expect(() => safePath(bad), bad).toThrow(/unsafe path/);
    expect(safePath("./tiny-cv/lib.typ")).toBe("tiny-cv/lib.typ");
  });

  test("a .typ, a .zip and a .tar.gz give the same files", async () => {
    expect(Object.keys(await readUpload("cv.typ", single))).toEqual(["cv.typ"]);
    const files = folder(join(fixtures, "package"));
    expect(Object.keys(await readUpload("t.zip", zip(files))).sort()).toEqual(Object.keys(files).sort());
    const fromTar = await readUpload("t.tar.gz", tarGz(files));
    expect(new TextDecoder().decode(fromTar["main.typ"])).toBe(new TextDecoder().decode(files["main.typ"]));
  });

  test("an archive that climbs out, or unpacks too much, is refused", async () => {
    await expect(readUpload("t.zip", zip({ "../evil.typ": "x" }))).rejects.toThrow(/unsafe path/);
    await expect(readUpload("t.tar.gz", tarGz({ "/etc/evil.typ": "x" }))).rejects.toThrow(/unsafe path/);
    const many = Object.fromEntries(Array.from({ length: UPLOAD_LIMITS.files + 1 }, (_, i) => [`f${i}.typ`, "x"]));
    await expect(readUpload("t.zip", zip(many))).rejects.toThrow(/more than 400 files/);
    // A small archive that inflates past the cap stops while it inflates.
    const bomb = tarGz({ "zeros.typ": new Uint8Array(UPLOAD_LIMITS.bytes + 1024) });
    expect(bomb.length).toBeLessThan(100_000);
    await expect(readUpload("bomb.tar.gz", bomb)).rejects.toThrow(/MB unpacked/);
    await expect(readUpload("cv.pdf", single)).rejects.toThrow(/\.typ, a \.zip or a \.tar\.gz/);
  });
});

test("periods in Spanish and English", () => {
  expect(parsePeriod("Aug 2019 – May 2023")).toEqual({ start: "2019-08", end: "2023-05" });
  expect(parsePeriod("agosto de 2019 - actualidad")).toEqual({ start: "2019-08", end: null });
  expect(parsePeriod("03/2020 to Present")).toEqual({ start: "2020-03", end: null });
  expect(parsePeriod("2019-2021")).toEqual({ start: "2019-01", end: "2021-01" });
  expect(parsePeriod("2019-08")).toEqual({ start: "2019-08" });
  expect(parsePeriod("Springfield")).toBeUndefined();
});

describe("a one-file template", () => {
  const t = readTemplate({ "cv.typ": single });
  const mapping = proposeMapping(t);

  test("the proposal: header, macros and their arguments", () => {
    expect(t.header?.fn).toBe("resume");
    expect(Object.keys(t.macros).sort()).toEqual(["edu", "work"]);
    expect(mapping.header).toEqual({ author: "name", email: "email", phone: "phone", linkedin: "linkedin", "accent-color": "keep" });
    expect(mapping.macros.work).toEqual({ title: "title", company: "place", location: "note", dates: "period" });
    expect(mapping.macros.edu).toEqual({ institution: "place", degree: "title", dates: "period" });
  });

  test("the data: a valid project with the entries, their items and the summary", () => {
    const { project, profileId, entries } = importData(t, mapping, { name: "Plantilla", language: "en" });
    expect(validate(project)).toEqual([]);
    expect(entries).toBe(3);
    expect(project.person).toEqual({ givenNames: ["Jane"], familyNames: ["Doe"], photo: null });
    expect(project.contacts).toEqual({ email: "jane@example.com", phone: "+1 555 010 0000", linkedin: "linkedin.com/in/janedoe" });
    const profile = project.profiles[profileId];
    expect(profile.summary).toBe("Engineer who likes tidy systems.");
    expect(profile.sections.map((s) => s.title)).toEqual(["Experience", "Education", "Skills"]);
    const job = Object.values(project.entries)[0];
    expect(job).toMatchObject({ title: "Software Engineer", place: "Acme", start: "2021-08", end: null, note: "Springfield" });
    expect(job.items!.map((it) => it.text)).toEqual(["Built the billing service.", "Cut response times in half."]);
    expect(Object.values(project.entries)[2]).toMatchObject({ title: "B.Sc. Computer Science", place: "State University", start: "2016-01", end: "2020-01" });
    expect(profile.sections[2].blocks).toEqual([{ type: "item", text: "**Languages:** Python, TypeScript" }]);
  });

  test("added to an open project: a new profile, the person and contacts kept", () => {
    const { project, profileId } = importData(t, mapping, { name: "Plantilla", language: "es", into: fictional });
    expect(validate(project)).toEqual([]);
    expect(project.person).toEqual(fictional.person);
    expect(project.contacts.email).toBe(fictional.contacts.email);
    expect(Object.keys(project.profiles)).toEqual([...Object.keys(fictional.profiles), profileId]);
    expect(Object.keys(project.entries).length).toBe(Object.keys(fictional.entries).length + 3);
  });

  test("the look: definitions without the sample content, the header and the macros called with the CV", () => {
    const style = importStyle(t, mapping, "plantilla", "Plantilla");
    expect(style.files!["foja-defs.typ"]).toContain("#let work(");
    expect(style.files!["foja-defs.typ"]).not.toContain("Software Engineer");
    expect(style.source).toContain('#import "/custom/plantilla/foja-defs.typ": *');
    expect(style.source).toContain('#show: resume.with(author: cv.name, email: foja-contact("email"), phone: foja-contact("phone"), linkedin: foja-contact("linkedin"), accent-color: rgb("#26428b"))');
    expect(style.source).toContain('"work": b => {\n    work(title: b.title, company: b.place, location: (if b.note == none { "" } else { b.note }), dates: b.period)');
    expect(style.source).toContain('foja-section-macro = ("experience": "work", "education": "edu",)');
  });
});

describe("a template from a package", () => {
  test("positional arguments, a content block, the package rewritten to its files", async () => {
    const t = readTemplate(await readUpload("t.zip", zip(folder(join(fixtures, "package")))));
    expect(t.main).toBe("main.typ");
    expect(t.header?.fn).toBe("cv-header");
    expect(t.missing).toEqual([]);
    expect(t.license).toBe("LICENSE");
    const mapping = proposeMapping(t);
    expect(mapping.header).toEqual({ name: "name", email: "email", site: "website" });
    expect(mapping.macros["cv-entry"]).toEqual({ "#0": "title", "#1": "place", "#2": "period", "#body": "items" });
    const { project } = importData(t, mapping, { name: "Paquete", language: "es" });
    expect(Object.values(project.entries)).toMatchObject([
      { title: "Desarrollador", place: "Initech", start: "2019-03", end: null },
      { title: "Pasante", place: "Hooli", start: "2018-01" },
    ]);
    expect(Object.values(project.entries)[0].items!.map((it) => it.text)).toEqual(["Mantenimiento del sistema de facturación.", "Migración a la nube."]);
    const style = importStyle(t, mapping, "paquete", "Paquete");
    expect(style.source).toContain('#import "/custom/paquete/tiny-cv/lib.typ": cv-header, cv-entry');
    expect(style.source).toContain("cv-entry(b.title, b.place, b.period)[#list(..b.items.map(item-body))]");
    expect(style.license).toBe("LICENSE");
    expect(validate({ ...fictional, templates: { paquete: style } })).toEqual([]);
  });

  test("a package that is not in the upload is named, not fetched", () => {
    const t = readTemplate({ "cv.typ": new TextEncoder().encode('#import "@preview/absent:1.0.0": *\n= A\n#entry(title: "x")') });
    expect(t.missing).toEqual(["absent:1.0.0"]);
  });
});
