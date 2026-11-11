// What of the bank a profile shows. Each entry, item and skill has a priority, marked once in the
// bank; each profile has a length (short: the essential; normal: the essential and the normal;
// full: everything) and overrides for the exceptions. resolve.ts applies this for every export
// but Typst, and lib.typ applies the same rules for Typst: keep both in step (a test compares them).
//
// Also the migration from format 2, which had no ids on items and skills as plain strings.

import { slug } from "./project.ts";
import { FORMAT, type Layout, type Length, type Priority, type Profile, type Skill } from "./types.ts";

const SHOWN: Record<Length, Priority[]> = { short: ["essential"], normal: ["essential", "normal"], full: ["essential", "normal", "extra"] };

/** The bank path of an entry, of one of its items, of a skill: the keys of `Profile.overrides`. */
export const entryKey = (entry: string) => `entries/${entry}`;
export const itemKey = (entry: string, item: string) => `entries/${entry}/items/${item}`;
export const skillKey = (group: string, skill: string) => `skills/${group}/${skill}`;

export const lengthOf = (layout: Layout | undefined): Length => layout?.length ?? "normal";

/** What the length alone says about a thing of `priority`. */
export const byLength = (length: Length, priority: Priority = "normal") => SHOWN[length].includes(priority);

/** Whether the thing at bank path `key` goes in the profile: its override, or the length rule. */
export function shown(profile: Profile, key: string, priority?: Priority): boolean {
  const override = profile.overrides?.[key];
  return typeof override === "boolean" ? override : byLength(lengthOf(profile.layout), priority);
}

/** Whether the profile uses its short summary: as `summaryLength` says, or with the short length. */
export function usesShortSummary(profile: Profile): boolean {
  const wanted = profile.layout?.summaryLength ?? (lengthOf(profile.layout) === "short" ? "short" : "long");
  return wanted === "short" && !!profile.summaryShort?.trim();
}

/** The summary the profile shows. */
export const summaryOf = (profile: Profile) => (usesShortSummary(profile) ? profile.summaryShort! : profile.summary);

/** An id for a new thing: a slug of the first words of `text`, unique among `taken`. */
export function freshId(text: string, taken: Iterable<string>, fallback = "item"): string {
  const used = new Set(taken);
  const base = slug(text).split("-").slice(0, 4).join("-").slice(0, 32).replace(/-$/, "") || fallback;
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  return id;
}

/** The skills of a group after its lines were edited: a line that is still there keeps its skill
 * (id and priority); an edited line keeps the id of the one it replaced, at the same place. */
export function skillsFromLines(lines: string[], previous: Skill[]): Skill[] {
  const byText = new Map<string, Skill[]>();
  for (const s of previous) byText.set(s.text, [...(byText.get(s.text) ?? []), s]);
  const kept = lines.map((text) => byText.get(text)?.shift());
  const used = new Set(kept.filter((s): s is Skill => !!s).map((s) => s.id));
  return lines.map((text, i) => {
    if (kept[i]) return kept[i]!;
    const before = previous[i];
    if (before && !used.has(before.id)) {
      used.add(before.id);
      return { ...before, text };
    }
    const id = freshId(text, used, "skill");
    used.add(id);
    return { id, text };
  });
}

const isObject = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v);

/** A project in the current format: one of format 2 gets ids on its items, and its skills become
 * objects with ids. Anything else comes back as it is, for `validate` to judge. */
export function migrate(value: unknown): unknown {
  if (!isObject(value) || value.format !== "foja/2") return value;
  const p = structuredClone(value);
  p.format = FORMAT;
  for (const entry of Object.values(isObject(p.entries) ? p.entries : {})) {
    if (!isObject(entry) || !Array.isArray(entry.items)) continue;
    const taken: string[] = [];
    entry.items = entry.items.map((it: unknown) => {
      if (!isObject(it)) return it;
      const id = typeof it.id === "string" ? it.id : freshId(String(it.heading ?? it.text ?? ""), taken);
      taken.push(id);
      return { id, ...it };
    });
  }
  for (const group of Object.values(isObject(p.skills) ? p.skills : {})) {
    if (isObject(group) && Array.isArray(group.items) && group.items.every((s: unknown) => typeof s === "string")) {
      group.items = skillsFromLines(group.items, []);
    }
  }
  return p;
}
