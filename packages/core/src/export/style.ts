// The look of the exports that are not Typst (LaTeX, Word): each follows the profile's built-in
// style. A style of the user's own is Typst code that neither can run, so they use Legajo for it.

import { DEFAULT_ACCENT } from "../project.ts";
import { resolveProfile, type ResolvedCv } from "../resolve.ts";
import { styleOf } from "../templates.ts";
import type { Layout, Project } from "../types.ts";

export type ExportStyle = "legajo" | "banda" | "minimal" | "claustro" | "recto" | "llano";
export const STYLE_NAMES: Record<ExportStyle, string> = { legajo: "Legajo", banda: "Banda", minimal: "Minimal", claustro: "Claustro", recto: "Recto", llano: "Llano" };

/** The one-column styles made for applicant tracking systems: plain text in reading order, no
 * tables, the contacts in the body. */
export const ATS_STYLES = ["claustro", "recto", "llano"] as const;
export type AtsStyle = (typeof ATS_STYLES)[number];
export const isAtsStyle = (style: ExportStyle): style is AtsStyle => (ATS_STYLES as readonly string[]).includes(style);

type Defaults = { margins: { top: number; bottom: number; left: number; right: number }; accent: string; font: NonNullable<Layout["font"]> };

/** What the one-column styles start from where the profile says nothing, as in their Typst files. */
const STYLE_DEFAULTS: Record<Exclude<ExportStyle, "legajo">, Defaults> = {
  banda: { margins: { top: 10, bottom: 14, left: 16, right: 16 }, accent: DEFAULT_ACCENT, font: "Noto Sans" },
  minimal: { margins: { top: 15, bottom: 15, left: 17, right: 17 }, accent: "#141414", font: "Noto Sans" },
  claustro: { margins: { top: 14, bottom: 14, left: 18, right: 18 }, accent: "#1a1a1a", font: "XCharter" },
  recto: { margins: { top: 14, bottom: 14, left: 16, right: 16 }, accent: "#1f4e79", font: "Noto Sans" },
  llano: { margins: { top: 13, bottom: 13, left: 15, right: 15 }, accent: DEFAULT_ACCENT, font: "Noto Sans" },
};

/** The profile's built-in style, or Legajo for a style of the user's own. */
export function exportStyleOf(project: Project, profileId: string): { style: ExportStyle; custom: boolean } {
  const s = styleOf(project, profileId);
  return s.custom ? { style: "legajo", custom: true } : { style: s.id as ExportStyle, custom: false };
}

/** The profile resolved with its style's defaults where the layout says nothing (the resolver
 * fills in Legajo's): every other style is one column, with its own font, margins and accent. */
export function resolveStyled(project: Project, profileId: string): { cv: ResolvedCv; style: ExportStyle; custom: boolean } {
  const { style, custom } = exportStyleOf(project, profileId);
  if (style === "legajo") return { cv: resolveProfile(project, profileId), style, custom };
  const profile = project.profiles[profileId];
  const layout = profile.layout ?? {};
  const d = STYLE_DEFAULTS[style];
  const styled = { ...layout, columns: 1 as const, font: layout.font ?? d.font, accent: layout.accent ?? d.accent, margins: { ...d.margins, ...layout.margins } };
  const styledProject = { ...project, profiles: { ...project.profiles, [profileId]: { ...profile, layout: styled } } };
  return { cv: resolveProfile(styledProject, profileId), style, custom };
}
