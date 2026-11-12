import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { compareVersion, deleteVersion, diffProjects, renameVersion, snapshot, startHistory, thin, validate, versionProject, type History, type Project } from "../src/index.ts";

const example: Project = JSON.parse(readFileSync(new URL("../../../examples/fictional.project.json", import.meta.url), "utf8"));
const photo = { type: "image/png" as const, data: "iVBORw0KGgo=" };
const withPhoto = (): Project => ({ ...structuredClone(example), person: { ...example.person, photo: "foto" }, assets: { foto: photo } });
const at = (iso: string) => new Date(iso);
const edited = (p: Project, title: string): Project => {
  const copy = structuredClone(p);
  const [id] = Object.keys(copy.entries);
  copy.entries[id].title = title;
  return copy;
};

test("a snapshot only when the project changed; a named version always", () => {
  const project = withPhoto();
  let history = startHistory(project, at("2026-11-12T10:00:00Z"));
  expect(history.versions).toHaveLength(1);
  expect(snapshot(history, project, at("2026-11-12T11:00:00Z"))).toBe(history);
  history = snapshot(history, project, at("2026-11-12T11:00:00Z"), "Enviado a Acme");
  expect(history.versions.map((v) => v.name)).toEqual([undefined, "Enviado a Acme"]);
});

test("a photo that did not change is kept once, whatever the number of versions", () => {
  let project = withPhoto();
  let history = startHistory(project, at("2026-11-01T10:00:00Z"));
  for (let day = 2; day <= 9; day++) {
    project = edited(project, `Puesto ${day}`);
    history = snapshot(history, project, at(`2026-11-0${day}T10:00:00Z`));
  }
  expect(history.versions).toHaveLength(9);
  expect(Object.keys(history.assets ?? {})).toHaveLength(1);
  // A new photo is one more picture; deleting every version that used the old one drops it.
  project = { ...project, assets: { foto: { type: "image/png", data: "AAAA" } } };
  history = snapshot(history, project, at("2026-11-10T10:00:00Z"));
  expect(Object.keys(history.assets ?? {})).toHaveLength(2);
  while (history.versions.length > 1) history = deleteVersion(history, history.versions[0]);
  expect(Object.values(history.assets ?? {})).toEqual([{ type: "image/png", data: "AAAA" }]);
});

test("automatic snapshots thin out with age; named versions stay", () => {
  let project = withPhoto();
  let history = startHistory(project, at("2026-01-01T00:00:00Z"));
  history = snapshot(history, project, at("2026-01-01T00:00:00Z"), "Enviado a Acme");
  // A save every 5 minutes for 300 days.
  let time = 0;
  for (let i = 1; i <= 300 * 288; i += 37) {
    project = edited(project, `Puesto ${i}`);
    time = Date.parse("2026-01-01T00:00:00Z") + i * 5 * 60_000;
    history = snapshot(history, project, new Date(time));
  }
  expect(history.versions.length).toBeLessThan(80);
  expect(history.versions.some((v) => v.name === "Enviado a Acme")).toBe(true);
  // The newest is the project as it is: nothing to snapshot.
  expect(snapshot(history, project, new Date(time + 1000))).toBe(history);
  // Thinning later, with nothing new, only drops more.
  expect(thin(history, new Date(time + 400 * 86_400_000)).versions.length).toBeLessThanOrEqual(history.versions.length);
});

test("a version comes back whole, with its photo, and valid", () => {
  const original = withPhoto();
  let history = startHistory(original, at("2026-11-12T10:00:00Z"));
  const changed = { ...edited(original, "Otro puesto"), assets: { foto: { type: "image/png" as const, data: "AAAA" } } };
  history = snapshot(history, changed, at("2026-11-12T12:00:00Z"));
  const restored = versionProject(history, history.versions[0]);
  expect(restored).toEqual(original);
  expect(validate(restored).filter((p) => p.severity === "error")).toEqual([]);
});

test("the comparison says field by field what changed", () => {
  const original = withPhoto();
  const history = startHistory(original, at("2026-11-12T10:00:00Z"));
  const changed = edited(original, "Otro puesto");
  const [entryId] = Object.keys(original.entries);
  changed.contacts = { ...changed.contacts, website: "ejemplo.com" };
  const profile = Object.values(changed.profiles)[0];
  profile.sections.reverse();
  changed.assets = { foto: { type: "image/png", data: "AAAA" } };
  const changes = compareVersion(history, history.versions[0], changed);
  expect(changes).toContainEqual({ path: ["entries", entryId, "title"], before: original.entries[entryId].title, after: "Otro puesto" });
  expect(changes).toContainEqual({ path: ["contacts", "website"], after: "ejemplo.com" });
  expect(changes.some((c) => c.path.join("/") === "assets/foto")).toBe(true);
  // Moving the sections is one change, of order, not one per section.
  const sections = changes.filter((c) => c.path.includes("sections"));
  expect(sections.map((c) => c.path.at(-1))).toEqual(profile.sections.length > 1 ? ["order"] : []);
  expect(compareVersion(history, history.versions[0], original)).toEqual([]);
});

test("lists without ids compare by position; a deleted thing has no after", () => {
  expect(diffProjects({ a: [{ t: 1 }, { t: 2 }] }, { a: [{ t: 1 }] })).toEqual([{ path: ["a", "1"], before: { t: 2 } }]);
  expect(diffProjects({ names: ["Ana"] }, { names: ["Ana", "María"] })).toEqual([{ path: ["names"], before: ["Ana"], after: ["Ana", "María"] }]);
});

test("a version can get a name, lose it, and the project file with its history is valid", () => {
  const project = withPhoto();
  let history: History = startHistory(project, at("2026-11-12T10:00:00Z"));
  history = renameVersion(history, history.versions[0], "  Enviado a Acme ");
  expect(history.versions[0].name).toBe("Enviado a Acme");
  expect(validate({ ...project, history }).filter((p) => p.severity === "error")).toEqual([]);
  history = renameVersion(history, history.versions[0], "");
  expect("name" in history.versions[0]).toBe(false);
  expect(validate({ ...project, history: { versions: [{ date: "ayer", project: {} }] } }).length).toBeGreaterThan(0);
});
