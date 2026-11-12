// Versions of a project: automatic snapshots taken when it is saved, thinned out as they age, and
// versions named by the user, kept until deleted. They live in the project's `history`, so they go
// wherever the project goes; nothing here touches a version control system.

import { migrate } from "./select.ts";
import type { Asset, History, Project, Version, VersionProject } from "./types.ts";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How automatic snapshots thin out: by age, the newest of each period is kept. A project edited
 * every day for a year keeps about 80. */
const TIERS: [maxAge: number, period: number][] = [
  [HOUR, 10 * MINUTE],
  [DAY, HOUR],
  [30 * DAY, DAY],
  [Infinity, 30 * DAY],
];

// cyrb53: a fast 53-bit hash, enough to tell pictures apart (a clash is checked against the data).
function hash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// Assets are replaced, never changed in place, so a picture is hashed once.
const keys = new WeakMap<Asset, string>();
const same = (a: Asset, b: Asset) => a.type === b.type && a.data === b.data;

/** The project as a version keeps it, and the pool of pictures with its own added. */
function capture(project: Project, pool: Record<string, Asset> = {}): { project: VersionProject; pool: Record<string, Asset> } {
  const { assets, history: _history, ...rest } = project;
  const kept: VersionProject = structuredClone(rest);
  const next = { ...pool };
  if (assets) {
    kept.assets = {};
    for (const [name, asset] of Object.entries(assets)) {
      const base = keys.get(asset) ?? `${hash(asset.data)}-${asset.data.length.toString(36)}`;
      keys.set(asset, base);
      // Two pictures with the same hash: the second gets a suffix.
      let key = base;
      for (let n = 2; next[key] && !same(next[key], asset); n++) key = `${base}-x${n}`;
      next[key] = asset;
      kept.assets[name] = key;
    }
  }
  return { project: kept, pool: next };
}

const isAuto = (v: Version) => !v.name;

/** Drops the automatic snapshots the thinning leaves out, and the pictures no version uses. */
export function thin(history: History, now: Date): History {
  const newest = new Map<string, Version>();
  for (const v of history.versions.filter(isAuto)) {
    const time = Date.parse(v.date);
    const tier = TIERS.findIndex(([maxAge]) => now.getTime() - time < maxAge);
    const bucket = `${tier}:${Math.floor(time / TIERS[tier][1])}`;
    const kept = newest.get(bucket);
    if (!kept || Date.parse(kept.date) <= time) newest.set(bucket, v);
  }
  const keep = new Set(newest.values());
  const versions = history.versions.filter((v) => !isAuto(v) || keep.has(v));
  return withPool({ versions, assets: history.assets });
}

/** Keeps in the pool only the pictures some version uses. */
function withPool(history: History): History {
  const used = new Set(history.versions.flatMap((v) => Object.values(v.project.assets ?? {})));
  const assets = Object.fromEntries(Object.entries(history.assets ?? {}).filter(([key]) => used.has(key)));
  return Object.keys(assets).length ? { versions: history.versions, assets } : { versions: history.versions };
}

/** Adds a version of `project`: named, always; automatic, only when it differs from the newest
 * version. Returns the same history when nothing was added. */
export function snapshot(history: History, project: Project, now: Date, name?: string): History {
  const { project: kept, pool } = capture(project, history.assets);
  const last = history.versions.at(-1);
  if (!name && last && JSON.stringify(last.project) === JSON.stringify(kept)) return history;
  const version: Version = { date: now.toISOString(), ...(name ? { name } : {}), project: kept };
  return thin({ versions: [...history.versions, version], assets: pool }, now);
}

/** Versions turned on: the history starts with a snapshot of the project as it is. */
export const startHistory = (project: Project, now: Date): History => snapshot({ versions: [] }, project, now);

/** The project a version keeps, whole again (its pictures back in place), in the current format. */
export function versionProject(history: History, version: Version): Project {
  const { assets, ...rest } = structuredClone(version.project);
  const project = migrate(rest) as Project;
  if (assets) {
    project.assets = {};
    for (const [name, key] of Object.entries(assets)) {
      const asset = history.assets?.[key];
      if (asset) project.assets[name] = asset;
    }
  }
  return project;
}

export function renameVersion(history: History, version: Version, name: string): History {
  const trimmed = name.trim();
  const versions = history.versions.map((v) => {
    if (v !== version) return v;
    const { name: _old, ...rest } = v;
    return trimmed ? { ...rest, name: trimmed } : rest;
  });
  return { ...history, versions };
}

export function deleteVersion(history: History, version: Version): History {
  return withPool({ versions: history.versions.filter((v) => v !== version), assets: history.assets });
}

export interface Change {
  /** Where, from the project down: `["entries", "kernel", "items", "a1", "text"]`. Elements of a
   * list that have an id (or, for blocks, an entry) go by it, so moving one is not a change of
   * everything after it. */
  path: string[];
  /** Absent when the thing is new. */
  before?: unknown;
  /** Absent when the thing was deleted. */
  after?: unknown;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function keyOf(v: unknown): string | undefined {
  if (!isObject(v)) return undefined;
  if (typeof v.id === "string") return v.id;
  if (v.type === "entry" && typeof v.entry === "string") return v.entry;
  return undefined;
}

/** The keys of a list, when every element has one and none repeats. */
function listKeys(list: unknown[]): string[] | undefined {
  const keys = list.map(keyOf);
  return keys.every((k) => k !== undefined) && new Set(keys).size === keys.length ? (keys as string[]) : undefined;
}

/** What changed from one version of a project to another, field by field. Pictures compare by
 * their content: pass both sides as versions keep them (see `compareVersion`). */
export function diffProjects(before: unknown, after: unknown, path: string[] = []): Change[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (isObject(before) && isObject(after)) {
    const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])];
    return fields.flatMap((k) => diffProjects(before[k], after[k], [...path, k]));
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const a = listKeys(before);
    const b = listKeys(after);
    if (a && b && (before.some(isObject) || after.some(isObject))) {
      const changes = [...new Set([...b, ...a])].flatMap((key) => diffProjects(before[a.indexOf(key)], after[b.indexOf(key)], [...path, key]));
      // Same elements in another order: the order is the change.
      const common = (keys: string[], other: string[]) => keys.filter((k) => other.includes(k));
      if (common(a, b).join("\u0000") !== common(b, a).join("\u0000")) changes.push({ path: [...path, "order"], before: common(a, b), after: common(b, a) });
      return changes;
    }
    if (before.some(isObject) || after.some(isObject)) {
      return Array.from({ length: Math.max(before.length, after.length) }, (_, i) => diffProjects(before[i], after[i], [...path, String(i)])).flat();
    }
  }
  const change: Change = { path };
  if (before !== undefined) change.before = before;
  if (after !== undefined) change.after = after;
  return [change];
}

/** What changed from a version to the project as it is now. */
export function compareVersion(history: History, version: Version, project: Project): Change[] {
  return diffProjects(version.project, capture(project, history.assets).project);
}
