import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { fromJsonResume, isJsonResume, resolveProfile, toJsonResume, validate, type JsonResume, type Project } from "../src/index.ts";
import { exportFiles } from "../src/export/index.ts";

const resume: JsonResume = JSON.parse(readFileSync(new URL("fixtures/resume.json", import.meta.url), "utf8"));
const fictional: Project = JSON.parse(readFileSync(new URL("../../../examples/fictional.project.json", import.meta.url), "utf8"));
const ISO = /^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/;

describe("JSON Resume import", () => {
  const { project, profileId, entries } = fromJsonResume(resume, { name: "CV", language: "en" });
  const profile = project.profiles[profileId];
  const titled = (title: string) => profile.sections.find((s) => s.title === title)!;
  const entry = (title: string) => Object.values(project.entries).find((e) => e.title === title)!;

  test("makes a valid project", () => {
    expect(validate(project).filter((p) => p.severity === "error")).toEqual([]);
    expect(entries).toBe(8);
  });

  test("the person, the contacts and the profile", () => {
    expect(project.person).toEqual({ givenNames: ["Mara", "Elena"], familyNames: ["Prueba"], photo: null });
    expect(project.contacts).toEqual({
      email: "mara@example.com",
      phone: "+1 555 0100",
      website: "mara.example.com",
      location: "Springfield, Oregon, US",
      linkedin: "linkedin.com/in/mara-prueba",
      github: "github.com/maraprueba",
    });
    expect(profile.contacts).toEqual(["phone", "email", "website", "github", "linkedin", "location"]);
    expect(profile.subtitle).toBe("Data engineer");
    expect(profile.summary).toBe("Data engineer who likes **small** pipelines.");
  });

  test("entries keep their dates: no end is ongoing, a single date stays single", () => {
    expect(entry("Data engineer")).toMatchObject({ place: "Fictional Data Co.", start: "2022-03", end: null, note: "Batch and streaming pipelines." });
    expect(entry("Data engineer").items!.map((i) => i.text)).toEqual(["Cut the nightly load from four hours to forty minutes", "Moved the warehouse to Postgres"]);
    expect(entry("Intern")).toMatchObject({ start: "2021-01", end: "2021-06" });
    expect(entry("Best thesis")).toMatchObject({ place: "State University", start: "2021-07" });
    expect("end" in entry("Best thesis")).toBe(false);
    expect(entry("Bachelor, Computer Science")).toMatchObject({ place: "State University", start: "2017-01", end: "2021-01", note: "3.8" });
    expect(entry("tinyetl").note).toBe("A tiny ETL library · https://github.com/maraprueba/tinyetl");
  });

  test("a year without its month makes the profile show years", () => {
    expect(profile.layout?.dateFormat).toBe("YYYY");
    const months = fromJsonResume({ work: [{ name: "A", position: "B", startDate: "2020-02" }] }, { name: "CV", language: "en" });
    expect(Object.values(months.project.profiles)[0].layout).toBeUndefined();
  });

  test("sections in JSON Resume's order, titled in the project's language", () => {
    expect(profile.sections.map((s) => s.title)).toEqual(["Experience", "Volunteering", "Education", "Projects", "Awards", "Certificates", "Publications", "Interests", "References"]);
    expect(titled("Interests")).toMatchObject({ column: "side", blocks: [{ type: "item", heading: "Cycling", text: "gravel, touring" }, { type: "item", text: "Chess" }] });
    expect(titled("References").blocks).toEqual([{ type: "item", heading: "A. Manager", text: "Mara made our data boring, in the best way." }]);
    const es = fromJsonResume(resume, { name: "CV", language: "es" });
    expect(es.project.profiles[es.profileId].sections.map((s) => s.title).slice(0, 3)).toEqual(["Experiencia", "Voluntariado", "Formación"]);
  });

  test("skills: a group per skill with keywords, one for the rest, one for the languages", () => {
    const groups = profile.skills.map(([id]) => project.skills[id]);
    expect(groups.map((g) => [g.title, g.items.map((i) => i.text)])).toEqual([
      ["Data", ["SQL", "Spark", "dbt"]],
      ["Skills", ["Leadership", "Writing (Fluent)"]],
      ["Languages", ["English (Native)", "Spanish (B2)"]],
    ]);
  });

  test("a picture on the web is not fetched; one inside the file is kept", () => {
    expect(project.assets).toBeUndefined();
    const data = "iVBORw0KGgo=";
    const inside = fromJsonResume({ basics: { name: "A B", image: `data:image/png;base64,${data}` } }, { name: "CV", language: "en" }).project;
    expect(inside.person.photo).toBe("photo");
    expect(inside.assets).toEqual({ photo: { type: "image/png", data } });
  });

  test("added to a project, it keeps the person and fills only the missing contacts", () => {
    const into = fromJsonResume(resume, { name: "Mara", language: "en", into: fictional });
    expect(into.project.person).toEqual(fictional.person);
    expect(into.project.contacts.email).toBe(fictional.contacts.email);
    expect(into.project.contacts.linkedin).toBe("linkedin.com/in/mara-prueba");
    expect(Object.keys(into.project.profiles)).toEqual([...Object.keys(fictional.profiles), "mara"]);
    expect(Object.keys(into.project.entries).length).toBe(Object.keys(fictional.entries).length + 8);
    expect(validate(into.project).filter((p) => p.severity === "error")).toEqual([]);
  });

  test("tells a JSON Resume from a Foja project", () => {
    expect(isJsonResume(resume)).toBe(true);
    expect(isJsonResume({ basics: {} })).toBe(true);
    expect(isJsonResume(fictional)).toBe(false);
    expect(isJsonResume({ format: "foja/2", basics: {} })).toBe(false);
    expect(isJsonResume([])).toBe(false);
    expect(isJsonResume(null)).toBe(false);
  });

  test("survives what does not follow the schema", () => {
    const odd = { basics: { name: 3, profiles: "none" }, work: [null, { startDate: "someday" }, "x"], skills: [{ keywords: [1, "Go"] }] } as unknown as JsonResume;
    const { project: p } = fromJsonResume(odd, { name: "CV", language: "en" });
    expect(validate(p).filter((x) => x.severity === "error")).toEqual([]);
    expect(Object.values(p.entries)).toEqual([{ title: "—" }]);
  });
});

describe("JSON Resume export", () => {
  const { resume: out, left } = toJsonResume(fictional, "desarrolladora");

  test("basics from the profile", () => {
    expect(out.$schema).toMatch(/jsonresume/);
    expect(out.basics).toEqual({
      name: "Inés Ejemplo",
      label: fictional.profiles.desarrolladora.subtitle,
      phone: "+54 11 5555-0100",
      email: "ines.ejemplo@example.com",
      location: { city: "Córdoba", region: "Argentina" },
      profiles: [{ network: "GitHub", username: "ines-ejemplo", url: "https://github.com/ines-ejemplo" }],
      summary: resolveProfile(fictional, "desarrolladora").summary.replaceAll("**", ""),
    });
  });

  test("sections by their names; dates in ISO 8601, an ongoing job without an end", () => {
    const experience = fictional.profiles.desarrolladora.sections.find((s) => s.id === "experiencia")!.blocks;
    expect(out.work!.map((w) => w.position)).toEqual(experience.map((b) => b.type === "entry" && fictional.entries[b.entry].title));
    expect(out.work![0]).toMatchObject({ name: "Nube Sur (empresa ficticia)", startDate: "2023-03" });
    expect("endDate" in out.work![0]).toBe(false);
    expect(out.work![0].highlights![0]).toMatch(/^Facturación: Rediseño/);
    expect(out.education!.length).toBe(2);
    expect(out.projects!.length).toBe(1);
    for (const d of [...out.work!, ...out.education!, ...out.projects!].flatMap((x) => [x.startDate, x.endDate]).filter(Boolean)) expect(d).toMatch(ISO);
  });

  test("skill groups, and the languages group as languages", () => {
    expect(out.skills!.map((s) => s.name)).toEqual(["Lenguajes", "Herramientas"]);
    expect(out.languages).toEqual([
      { language: "Español", fluency: "nativo" },
      { language: "Inglés", fluency: "C1" },
      { language: "Portugués", fluency: "B1" },
    ]);
  });

  test("names what has no place in JSON Resume", () => {
    expect(left).toEqual(["Fortalezas"]);
    const docente = toJsonResume(fictional, "docente");
    expect(docente.left).toEqual([fictional.profiles.docente.highlight!.title]);
    expect(docente.resume.work!.length).toBe(3);
  });

  test("the same entries the PDF shows: the length of the profile decides", () => {
    const short = structuredClone(fictional);
    short.profiles.desarrolladora.layout = { ...short.profiles.desarrolladora.layout, length: "short" };
    const shown = resolveProfile(short, "desarrolladora").sections.flatMap((s) => s.blocks.filter((b) => b.type === "entry")).length;
    const r = toJsonResume(short, "desarrolladora").resume;
    expect([...(r.work ?? []), ...(r.education ?? []), ...(r.projects ?? [])].length).toBe(shown);
  });

  test("goes back in: exported and imported again, it exports the same", () => {
    const back = fromJsonResume(out, { name: "CV", language: "es" });
    expect(validate(back.project).filter((p) => p.severity === "error")).toEqual([]);
    const again = toJsonResume(back.project, back.profileId).resume;
    expect(again.work).toEqual(out.work);
    expect(again.education).toEqual(out.education);
    expect(again.projects).toEqual(out.projects);
    expect(again.languages).toEqual(out.languages);
    expect(again.basics).toEqual(out.basics);
  });

  test("an export of its own, with what is left", async () => {
    const [file] = await exportFiles(fictional, "desarrolladora", "jsonresume");
    expect(file.name).toBe("ines-ejemplo-desarrolladora.resume.json");
    expect(JSON.parse(new TextDecoder().decode(file.data))).toEqual(out);
    expect(file.left).toEqual(["Fortalezas"]);
  });
});
