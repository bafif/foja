// The look of the exports that are not Typst (LaTeX, Word): each follows the profile's built-in
// style. A style of the user's own is Typst code that neither can run, so they use Legajo for it.

import { DEFAULT_ACCENT } from "../project.ts";
import { resolveProfile, type ResolvedCv } from "../resolve.ts";
import { BUILTIN_STYLES, styleOf } from "../templates.ts";
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

/** Built-in styles with no LaTeX or Word version of their own (Arco, Rótulo and Portada, whose
 * looks are made of Typst's shapes): they come out in the layout of the nearest one, with their
 * own colour and typeface. */
const NEAREST: Record<string, { look: ExportStyle; accent: string; font: NonNullable<Layout["font"]> }> = {
  arco: { look: "legajo", accent: "#b06a5b", font: "Noto Sans" },
  rotulo: { look: "legajo", accent: "#a35a83", font: "Noto Sans" },
  portada: { look: "minimal", accent: "#1b1b1b", font: "Noto Sans" },
};

/** The name of a built-in style by id. */
export const styleName = (id: string) => BUILTIN_STYLES.find((s) => s.id === id)?.name ?? id;

/** The profile's built-in style, or Legajo for a style of the user's own. `standsIn` is the
 * built-in style the look stands in for, when that one has no LaTeX or Word version. */
export function exportStyleOf(project: Project, profileId: string): { style: ExportStyle; custom: boolean; standsIn?: string } {
  const s = styleOf(project, profileId);
  if (s.custom) return { style: "legajo", custom: true };
  const near = NEAREST[s.id];
  return near ? { style: near.look, custom: false, standsIn: s.id } : { style: s.id as ExportStyle, custom: false };
}

/** The project with the profile in the style its LaTeX and Word exports reproduce: its own, Legajo for a style of the
 * user's own, or the nearest one with the colour and the typeface of the style it stands in for. What Typst compiles
 * to know how long those exports have to be. */
export function exportedProject(project: Project, profileId: string): Project {
  const { style, standsIn } = exportStyleOf(project, profileId);
  const profile = project.profiles[profileId];
  const layout: Layout = { ...profile.layout, template: style };
  if (standsIn) {
    layout.font ??= NEAREST[standsIn].font;
    layout.accent ??= NEAREST[standsIn].accent;
  }
  return { ...project, profiles: { ...project.profiles, [profileId]: { ...profile, layout } } };
}

/** The profile resolved with its style's defaults where the layout says nothing (the resolver
 * fills in Legajo's): every other style is one column, with its own font, margins and accent. */
export function resolveStyled(project: Project, profileId: string): { cv: ResolvedCv; style: ExportStyle; custom: boolean; standsIn?: string } {
  const { style, custom, standsIn } = exportStyleOf(project, profileId);
  const profile = project.profiles[profileId];
  const layout = profile.layout ?? {};
  const near = standsIn ? NEAREST[standsIn] : undefined;
  const own = near ? { font: layout.font ?? near.font, accent: layout.accent ?? near.accent } : {};
  const withLayout = (next: Layout) => ({ ...project, profiles: { ...project.profiles, [profileId]: { ...profile, layout: next } } });
  if (style === "legajo") return { cv: resolveProfile(near ? withLayout({ ...layout, ...own }) : project, profileId), style, custom, standsIn };
  const d = STYLE_DEFAULTS[style];
  const styled = { ...layout, columns: 1 as const, font: layout.font ?? d.font, accent: layout.accent ?? d.accent, margins: { ...d.margins, ...layout.margins }, ...own };
  return { cv: resolveProfile(withLayout(styled), profileId), style, custom, standsIn };
}

/** The export styles whose spacing is Typst's (flow.ts). Only they take Typst's lines: in the others, which leave
 * more space between blocks than Typst, lines laid out as Typst's would push the text further. */
const COPIES_LINES: ReadonlySet<ExportStyle> = new Set(["legajo"]);

/** Whether the LaTeX and Word exports of a profile break their lines where Typst does, which measure.typ tells. */
export function copiesLines(project: Project, profileId: string): boolean {
  return COPIES_LINES.has(resolveStyled(project, profileId).style);
}
