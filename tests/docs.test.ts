// The documentation comes in English and Spanish: every `name.md` has its `name.es.md` (or `name.en.md`, for one
// written in Spanish first) next to it, the two link to each other, and their relative links lead to files that
// exist, in the same language when there is a version in it.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { expect, test } from "vitest";

const root = join(import.meta.dirname, "..");
// Not documentation of the project: hidden folders (.git, .github, caches, local checkouts), build output,
// dependencies, and the CV's own texts (data, in Spanish).
const SKIP_DIRS = new Set(["node_modules", "dist", "target", "test-results", "playwright-report"]);
const SKIP_PATHS = ["cvgen/data/textos/"];
const SKIP_FILES = /^(CLAUDE|LICENSE.*|CHANGELOG.*|README\.upstream)\.md$/;

function docs(dir = root): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    const rel = relative(root, path).split("\\").join("/");
    if (e.isDirectory()) return e.name.startsWith(".") || SKIP_DIRS.has(e.name) || SKIP_PATHS.some((p) => `${rel}/`.startsWith(p)) ? [] : docs(path);
    return e.name.endsWith(".md") && !SKIP_FILES.test(e.name) ? [rel] : [];
  });
}

const all = docs();
const translation = /\.(es|en)\.md$/;
const twins = (file: string) =>
  translation.test(file) ? [file.replace(translation, ".md")] : [file.replace(/\.md$/, ".es.md"), file.replace(/\.md$/, ".en.md")];

test("finds the documentation", () => {
  expect(all).toContain("README.md");
  expect(all).toContain("README.es.md");
});

test.each(all)("%s has its other language", (file) => {
  const found = twins(file).filter((t) => all.includes(t));
  expect(found, `${file} has no translation: add ${twins(file).join(" or ")}`).toHaveLength(1);
});

const links = (file: string) =>
  [...readFileSync(join(root, file), "utf8").matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]).filter((l) => !/^(#|mailto:)/.test(l));

test.each(all)("%s links to its other language", (file) => {
  const twin = twins(file).find((t) => all.includes(t));
  if (!twin) return;
  const ok = links(file).some((l) => l.split("#")[0].endsWith(basename(twin)));
  expect(ok, `${file} should link to ${twin} at the top`).toBe(true);
});

/** A document's language: its suffix, or for the original, the other one than its translation's. */
const language = (file: string) =>
  file.endsWith(".es.md") ? "es" : file.endsWith(".en.md") ? "en" : all.includes(file.replace(/\.md$/, ".es.md")) ? "en" : "es";

test.each(all)("%s: relative links lead to files that exist, in its language", (file) => {
  const problems: string[] = [];
  for (const link of links(file)) {
    if (/^[a-z]+:/i.test(link)) continue;
    const target = join(dirname(file), decodeURIComponent(link.split("#")[0])).split("\\").join("/");
    if (!existsSync(join(root, target))) problems.push(`${link}: no such file`);
    else if (all.includes(target) && !twins(file).includes(target) && language(target) !== language(file)) {
      const base = target.replace(translation, ".md");
      const same = [base, ...twins(base)].find((d) => all.includes(d) && language(d) === language(file));
      if (same) problems.push(`${link}: should lead to ${relative(dirname(file), same)}`);
    }
  }
  expect(problems).toEqual([]);
});
