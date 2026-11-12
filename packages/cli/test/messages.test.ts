import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { detectLanguage, MESSAGES, systemLanguages, takeLanguage } from "../src/messages.ts";

test("every message exists in English and Spanish, and none is empty", () => {
  const kinds = (m: object) => Object.entries(m).map(([k, v]) => [k, typeof v, typeof v === "string" ? v.trim() !== "" : true]);
  expect(kinds(MESSAGES.es)).toEqual(kinds(MESSAGES.en));
  for (const m of Object.values(MESSAGES)) for (const [, , filled] of kinds(m)) expect(filled).toBe(true);
});

describe("the language follows the system", () => {
  test.each([
    [{ LANG: "es_AR.UTF-8" }, "es"],
    [{ LANG: "en_US.UTF-8", LC_MESSAGES: "es_ES.UTF-8" }, "es"],
    [{ LC_ALL: "en_GB.UTF-8", LANG: "es_AR.UTF-8" }, "en"],
    [{ LANG: "en_US.UTF-8", LANGUAGE: "en_US:es" }, "es"],
    [{ LANG: "fr_FR.UTF-8" }, "en"],
    [{ LANG: "es" }, "es"],
  ])("%o → %s", (env, lang) => {
    expect(detectLanguage(systemLanguages(env))).toBe(lang);
  });

  test("without a locale, or with C, it asks Node", () => {
    const node = Intl.DateTimeFormat().resolvedOptions().locale;
    expect(systemLanguages({})).toEqual([node]);
    expect(systemLanguages({ LANG: "C.UTF-8", LANGUAGE: "es" })).toEqual([node]);
  });
});

test("--lang is taken out of the arguments wherever it is", () => {
  expect(takeLanguage(["build", "--lang", "es", "a.json"])).toEqual({ lang: "es", rest: ["build", "a.json"] });
  expect(takeLanguage(["--lang=en", "validate", "a.json"])).toEqual({ lang: "en", rest: ["validate", "a.json"] });
  expect(takeLanguage(["validate", "a.json"])).toEqual({ lang: undefined, rest: ["validate", "a.json"] });
});

describe("foja speaks the language it is asked to", () => {
  const main = fileURLToPath(new URL("../src/main.ts", import.meta.url));
  const run = (args: string[], env: Record<string, string>) =>
    spawnSync(process.execPath, [main, ...args], { encoding: "utf8", env: { PATH: process.env.PATH, ...env } });

  test("help follows the locale, and --lang wins over it", () => {
    expect(run(["--help"], { LANG: "es_AR.UTF-8" }).stdout).toMatch(/^uso:/);
    expect(run(["--help"], { LANG: "en_US.UTF-8" }).stdout).toMatch(/^usage:/);
    expect(run(["--help", "--lang", "en"], { LANG: "es_AR.UTF-8" }).stdout).toMatch(/^usage:/);
  });

  test("--version says the version of the package", () => {
    const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(run(["--version"], {}).stdout.trim()).toBe(version);
  });

  test("errors too", () => {
    const notAProject = fileURLToPath(new URL("../package.json", import.meta.url));
    const es = run(["validate", notAProject], { LANG: "es_AR.UTF-8" });
    expect(es.status).toBe(1);
    expect(es.stderr).toContain(`${notAProject}: no es un proyecto de Foja válido`);
    expect(run(["validate", notAProject, "--lang", "en"], { LANG: "es_AR.UTF-8" }).stderr).toContain("not a valid Foja project");
    const lang = run(["--lang", "fr", "--help"], { LANG: "en_US.UTF-8" });
    expect(lang.status).toBe(2);
    expect(lang.stderr).toMatch(/^unknown language "fr"/);
  });
});
