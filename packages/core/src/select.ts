// What of the bank a profile shows. Each entry, item and skill has a priority, marked once in the
// bank; each profile has a length (short: the essential; normal: the essential and the normal;
// full: everything) and overrides for the exceptions. resolve.ts applies this for every export
// but Typst, and lib.typ applies the same rules for Typst: keep both in step (a test compares them).
//
// Also the migration from format 2, which had no ids on items and skills as plain strings.

import { slug } from "./project.ts";
import { FORMAT, type Layout, type Length, type Priority, type Profile, type Project, type Skill } from "./types.ts";

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

/** The profile with one override changed so that the thing at `key` is `value`: an override only
 * where `value` differs from what the length says, none where they agree. */
export function setShown(profile: Profile, key: string, priority: Priority | undefined, value: boolean): Profile {
  const overrides = { ...profile.overrides };
  if (value === byLength(lengthOf(profile.layout), priority)) delete overrides[key];
  else overrides[key] = value;
  const next = { ...profile, overrides };
  if (Object.keys(overrides).length === 0) delete next.overrides;
  return next;
}

/** Whether the short length would keep at least one of the profile's entries: one marked
 * essential, or put in by an override. Without one, Corto leaves the CV with no entries at all. */
export function shortKeepsEntries(project: Project, profileId: string): boolean {
  const profile = project.profiles[profileId];
  const short = { ...profile, layout: { ...profile.layout, length: "short" as const } };
  return profile.sections.some((s) => s.blocks.some((b) => b.type === "entry" && shown(short, entryKey(b.entry), project.entries[b.entry]?.priority)));
}

/** The bank paths of the extra things the profile still shows, in the order of the CV. */
function shownExtras(project: Project, profile: Profile): string[] {
  const keys: string[] = [];
  for (const row of profile.skills) for (const group of row) {
    for (const s of project.skills[group]?.items ?? []) if (s.priority === "extra" && shown(profile, skillKey(group, s.id), s.priority)) keys.push(skillKey(group, s.id));
  }
  for (const b of profile.sections.flatMap((s) => s.blocks)) {
    if (b.type !== "entry" || !project.entries[b.entry]) continue;
    const e = project.entries[b.entry];
    if (!shown(profile, entryKey(b.entry), e.priority)) continue;
    if (e.priority === "extra") keys.push(entryKey(b.entry));
    for (const it of e.items ?? []) if (it.priority === "extra" && shown(profile, itemKey(b.entry, it.id), it.priority)) keys.push(itemKey(b.entry, it.id));
  }
  return keys;
}

export type FitStep = { kind: "length"; length: Length } | { kind: "summary" } | { kind: "extra"; key: string };

/** One step to make the profile shorter, in a fixed order: the length one step down, then the
 * short summary, then the extra things still shown, the last first. Never down to the short
 * length when it would leave no entry (see `shortKeepsEntries`). Undefined when nothing is left. */
export function nextFit(project: Project, profileId: string): { profile: Profile; step: FitStep } | undefined {
  const profile = project.profiles[profileId];
  const length = lengthOf(profile.layout);
  const down: Length | undefined = length === "full" ? "normal" : length === "normal" && shortKeepsEntries(project, profileId) ? "short" : undefined;
  if (down) return { profile: { ...profile, layout: { ...profile.layout, length: down } }, step: { kind: "length", length: down } };
  if (!usesShortSummary(profile) && profile.summaryShort?.trim()) {
    return { profile: { ...profile, layout: { ...profile.layout, summaryLength: "short" } }, step: { kind: "summary" } };
  }
  const last = shownExtras(project, profile).at(-1);
  if (last) return { profile: { ...profile, overrides: { ...profile.overrides, [last]: false } }, step: { kind: "extra", key: last } };
  return undefined;
}

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
