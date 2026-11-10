// The look of the exports that are not Typst (LaTeX, Word): each follows the profile's built-in
// style. A style of the user's own is Typst code that neither can run, so they use Legajo for it.

import { DEFAULT_ACCENT } from "../project.ts";
import { resolveProfile, type ResolvedCv } from "../resolve.ts";
import { styleOf } from "../templates.ts";
import type { Project } from "../types.ts";

export type ExportStyle = "legajo" | "banda" | "minimal";
export const STYLE_NAMES: Record<ExportStyle, string> = { legajo: "Legajo", banda: "Banda", minimal: "Minimal" };

/** What the one-column styles start from where the profile says nothing, as in their Typst files. */
const STYLE_DEFAULTS = {
  banda: { margins: { top: 10, bottom: 14, left: 16, right: 16 }, accent: DEFAULT_ACCENT },
  minimal: { margins: { top: 15, bottom: 15, left: 17, right: 17 }, accent: "#141414" },
};

/** The profile's built-in style, or Legajo for a style of the user's own. */
export function exportStyleOf(project: Project, profileId: string): { style: ExportStyle; custom: boolean } {
  const s = styleOf(project, profileId);
  return s.custom ? { style: "legajo", custom: true } : { style: s.id as ExportStyle, custom: false };
}

/** The profile resolved with its style's defaults where the layout says nothing (the resolver
 * fills in Legajo's): Banda and Minimal are one column, in Noto Sans, with their own margins and
 * accent. */
export function resolveStyled(project: Project, profileId: string): { cv: ResolvedCv; style: ExportStyle; custom: boolean } {
  const { style, custom } = exportStyleOf(project, profileId);
  if (style === "legajo") return { cv: resolveProfile(project, profileId), style, custom };
  const profile = project.profiles[profileId];
  const layout = profile.layout ?? {};
  const d = STYLE_DEFAULTS[style];
  const styled = { ...layout, columns: 1 as const, font: layout.font ?? "Noto Sans", accent: layout.accent ?? d.accent, margins: { ...d.margins, ...layout.margins } };
  const styledProject = { ...project, profiles: { ...project.profiles, [profileId]: { ...profile, layout: styled } } };
  return { cv: resolveProfile(styledProject, profileId), style, custom };
}
