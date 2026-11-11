// Editor state: the project (with undo history), the profile being edited, what is selected, and
// the validation problems of the current project.

import { create } from "zustand";
import { migrate, validate, type Problem, type Project } from "@foja/core";
import { savePrevious } from "./storage";

export type Selection =
  | { kind: "person" }
  | { kind: "contacts" }
  | { kind: "skills" }
  | { kind: "entries" }
  | { kind: "entry"; id: string }
  | { kind: "profile" }
  | { kind: "layout" }
  | { kind: "style"; id: string }
  | { kind: "import" }
  | { kind: "section"; index: number };

export interface EditorState {
  project: Project | null;
  profileId: string;
  selection: Selection;
  problems: Problem[];
  saveState: "saved" | "saving" | "unsaved";
  /** On narrow screens, the one pane shown. */
  pane: "nav" | "edit" | "preview";
  setPane(pane: EditorState["pane"]): void;
  /** Replaces the project (new, example, import, restore) and forgets the undo history. */
  load(project: Project, profileId?: string): void;
  /** Changes the project: `fn` edits a copy. */
  update(fn: (draft: Project) => void): void;
  setProfile(id: string): void;
  select(selection: Selection): void;
  setSaveState(state: EditorState["saveState"]): void;
}

// The undo history: the projects before and after the current one, at most 200 back. One undo step
// per burst of edits: an edit records the project it replaces only after a pause of 800 ms.
const LIMIT = 200;
let past: Project[] = [];
let future: Project[] = [];
let lastEdit = 0;

function record(replaced: Project) {
  const now = Date.now();
  if (now - lastEdit > 800) {
    past.push(replaced);
    if (past.length > LIMIT) past.shift();
  }
  lastEdit = now;
  future = [];
}

/** Makes the next edit an undo step of its own, however soon it comes (fitting to a page). */
export const newUndoStep = () => {
  lastEdit = 0;
};

export const useEditor = create<EditorState>()((set, get) => ({
  project: null,
  profileId: "",
  selection: { kind: "profile" },
  problems: [],
  saveState: "saved",
  pane: "edit",
  setPane(pane) {
    set({ pane });
  },
  load(loaded, profileId) {
    // A project saved or exported by an older Foja comes up to the current format.
    const project = migrate(loaded) as Project;
    // Keep what this replaces, so a misclick on "new project" can be undone from the menu.
    const replaced = get().project;
    if (replaced && replaced !== project) void savePrevious({ project: replaced, profileId: get().profileId }).catch(() => undefined);
    const id = profileId && project.profiles[profileId] ? profileId : Object.keys(project.profiles)[0];
    set({ project, profileId: id, problems: validate(project), selection: { kind: "profile" } });
    past = [];
    future = [];
  },
  update(fn) {
    const current = get().project;
    if (!current) return;
    // The assets (the photo, megabytes of base64) are shared, not copied: an edit replaces an
    // asset object, it never changes one in place. This keeps typing and undo light.
    const { assets, ...rest } = current;
    const draft = structuredClone(rest) as Project;
    if (assets) draft.assets = { ...assets };
    fn(draft);
    record(current);
    set({ project: draft, saveState: "unsaved" });
  },
  setProfile(profileId) {
    set({ profileId, selection: { kind: "profile" } });
  },
  select(selection) {
    set({ selection, pane: "edit" });
  },
  setSaveState(saveState) {
    set({ saveState });
  },
}));

// Derived state kept in sync with the project, whatever changed it (an edit, undo, a load).
useEditor.subscribe((state, prev) => {
  if (state.project === prev.project || !state.project) return;
  const patch: Partial<EditorState> = { problems: validate(state.project) };
  if (!state.project.profiles[state.profileId]) patch.profileId = Object.keys(state.project.profiles)[0] ?? "";
  if (state.selection.kind === "entry" && !state.project.entries[state.selection.id]) patch.selection = { kind: "entries" };
  if (state.selection.kind === "style" && !state.project.templates?.[state.selection.id]) patch.selection = { kind: "layout" };
  const sections = state.project.profiles[patch.profileId ?? state.profileId]?.sections.length ?? 0;
  if (state.selection.kind === "section" && state.selection.index >= sections) patch.selection = { kind: "profile" };
  if (state.project !== prev.project && prev.project) patch.saveState = "unsaved";
  useEditor.setState(patch);
});

/** Goes one step back in the history (or forward, from `from` to `to`); the next edit is a step of its own. */
function step(from: Project[], to: Project[]) {
  const current = useEditor.getState().project;
  const project = from.pop();
  if (!current || !project) return;
  to.push(current);
  lastEdit = 0;
  useEditor.setState({ project });
}
export const undo = () => step(past, future);
export const redo = () => step(future, past);

/** The current profile; only call where a project is loaded. */
export function useProfile() {
  return useEditor((s) => s.project!.profiles[s.profileId]);
}

const escape = (key: string | number) => String(key).replace(/~/g, "~0").replace(/\//g, "~1");
export const pointer = (...parts: (string | number)[]) => "/" + parts.map(escape).join("/");

/** The first problem reported exactly at `path`. */
export function useProblem(path: string): string | undefined {
  return useEditor((s) => s.problems.find((p) => p.path === path)?.message);
}
