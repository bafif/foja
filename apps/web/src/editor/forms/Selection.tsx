import { useState } from "react";
import { LENGTHS, byLength, entryKey, itemKey, lengthOf, nextFit, setShown, shortKeepsEntries, shown, skillKey, type FitStep, type Layout, type Priority, type Profile, type Project } from "@foja/core";
import { t } from "../i18n";
import { countPages } from "../preview";
import { newUndoStep, undo, useEditor } from "../store";
import { Button, Field, Panel, Select, TextArea } from "../ui";

const clip = (text: string) => (text.length > 70 ? `${text.slice(0, 67)}…` : text).replace(/\*\*/g, "");

/** What a profile shows of the bank: its length, its short summary, the checkboxes with its
 * exceptions, and the button that fits it on one page. */
export function SelectionForm() {
  const project = useEditor((s) => s.project!);
  const profileId = useEditor((s) => s.profileId);
  const update = useEditor((s) => s.update);
  const [fit, setFit] = useState<{ running?: boolean; message?: string; undoable?: boolean }>({});
  const S = t.selection;
  const profile = project.profiles[profileId];
  if (!profile) return null;
  const length = lengthOf(profile.layout);
  const edit = (fn: (p: Profile) => Profile | void) =>
    update((p) => {
      const next = fn(p.profiles[profileId]);
      if (next) p.profiles[profileId] = next;
    });
  /** Sets a layout option; the default (normal length, automatic summary) is stored as nothing. */
  const setLayout = (key: "length" | "summaryLength", value: string | undefined) =>
    edit((p) => {
      const layout: Record<string, unknown> = { ...p.layout, [key]: value };
      if (value === undefined || (key === "length" && value === "normal")) delete layout[key];
      if (Object.keys(layout).length) p.layout = layout as Layout;
      else delete p.layout;
    });

  /** A checkbox of the bank: ticked when the thing goes in, marked when it is an exception. */
  const box = (label: string, at: string, priority: Priority | undefined, depth = 0) => {
    const on = shown(profile, at, priority);
    return (
      <label key={at} className="flex items-center gap-2 text-sm" style={{ paddingLeft: `${depth * 1.25}rem` }}>
        <input type="checkbox" checked={on} onChange={(e) => edit((p) => setShown(p, at, priority, e.target.checked))} />
        <span className={on ? "" : "text-muted line-through"}>{label}</span>
        {priority && priority !== "normal" && <span className="text-xs text-muted">({t.priority[priority]})</span>}
        {on !== byLength(length, priority) && <span className="rounded bg-accent-soft px-1 text-xs text-accent">{S.exception}</span>}
      </label>
    );
  };

  async function fitToPage() {
    setFit({ running: true });
    let p: Project = project;
    const steps: FitStep[] = [];
    let pages = await countPages(p, profileId);
    while (pages !== undefined && pages > 1) {
      const next = nextFit(p, profileId);
      if (!next) break;
      p = { ...p, profiles: { ...p.profiles, [profileId]: next.profile } };
      steps.push(next.step);
      pages = await countPages(p, profileId);
    }
    // One edit for the whole fit: one undo takes it back.
    if (steps.length) {
      newUndoStep();
      update((draft) => void (draft.profiles[profileId] = structuredClone(p.profiles[profileId])));
    }
    const done = steps.map((s) => describe(project, s)).join(", ");
    const message = pages === undefined ? S.fitFailed : steps.length === 0 ? (pages <= 1 ? S.alreadyFits : S.nothingToDo) : pages <= 1 ? S.fitted(done) : S.notEnough(done);
    setFit({ message, undoable: steps.length > 0 });
  }

  const entries = profile.sections.flatMap((s) => s.blocks.flatMap((b) => (b.type === "entry" && project.entries[b.entry] ? [b.entry] : [])));
  const groups = profile.skills.flat().filter((g) => project.skills[g]);

  return (
    <Panel title={S.title}>
      <Field label={S.length} hint={t.priority.hint}>
        {() => (
          <div role="radiogroup" aria-label={S.length} className="inline-flex w-fit overflow-hidden rounded border border-line text-sm">
            {LENGTHS.map((l) => (
              <button key={l} type="button" role="radio" aria-checked={length === l} onClick={() => setLayout("length", l)} className={`px-3 py-1 ${length === l ? "bg-accent text-on-accent" : "hover:bg-surface-2"}`}>
                {S.lengths[l]}
              </button>
            ))}
          </div>
        )}
      </Field>
      {length === "short" && !shortKeepsEntries(project, profileId) && (
        <p role="status" className="text-sm text-danger">
          {S.noEntries}
        </p>
      )}
      <Field label={S.summaryShort}>
        {(fid) => (
          <TextArea
            id={fid}
            rows={3}
            value={profile.summaryShort ?? ""}
            onChange={(v) =>
              edit((p) => {
                if (v) p.summaryShort = v;
                else delete p.summaryShort;
              })
            }
          />
        )}
      </Field>
      <Field label={S.summaryLength}>
        {(fid) => (
          <Select<"auto" | "short" | "long">
            id={fid}
            value={profile.layout?.summaryLength ?? "auto"}
            options={[
              ["auto", S.summaryLengths.auto],
              ["short", S.summaryLengths.short],
              ["long", S.summaryLengths.long],
            ]}
            onChange={(v) => setLayout("summaryLength", v === "auto" ? undefined : v)}
          />
        )}
      </Field>

      <section className="flex flex-col gap-1" aria-label={S.checks}>
        <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">{S.checks}</h3>
        <p className="text-xs text-muted">{S.checksHint}</p>
        {entries.map((id) => {
          const e = project.entries[id];
          return (
            <div key={id} className="flex flex-col gap-0.5">
              {box(e.place ? `${e.title} · ${e.place}` : e.title, entryKey(id), e.priority)}
              {shown(profile, entryKey(id), e.priority) && (e.items ?? []).map((it) => box(clip(it.heading ?? it.text), itemKey(id, it.id), it.priority, 1))}
            </div>
          );
        })}
        {groups.length > 0 && <h4 className="mt-2 text-xs font-medium text-muted">{S.skills}</h4>}
        {groups.map((g) => (
          <div key={g} className="flex flex-col gap-0.5">
            <span className="text-sm">{project.skills[g].title}</span>
            {project.skills[g].items.map((s) => box(s.text, skillKey(g, s.id), s.priority, 1))}
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => void fitToPage()} disabled={fit.running}>
          {fit.running ? S.fitting : S.fit}
        </Button>
        {fit.undoable && (
          <Button variant="ghost" onClick={() => (undo(), setFit({}))}>
            {S.undo}
          </Button>
        )}
      </div>
      {fit.message && (
        <p role="status" className="text-sm" data-testid="fit-result">
          {fit.message}
        </p>
      )}
    </Panel>
  );
}

/** The name of the thing at a bank path: an entry's title, an item's heading or text, a skill. */
function nameAt(project: Project, key: string): string {
  const [kind, a, b, c] = key.split("/");
  if (kind === "skills") return project.skills[a]?.items.find((s) => s.id === b)?.text ?? key;
  const entry = project.entries[a];
  if (!c) return entry?.title ?? key;
  const item = entry?.items?.find((it) => it.id === c);
  return item ? (item.heading ?? item.text) : key;
}

function describe(project: Project, step: FitStep): string {
  const S = t.selection;
  if (step.kind === "length") return S.stepLength(S.lengths[step.length].toLowerCase());
  if (step.kind === "summary") return S.stepSummary;
  return S.stepExtra(clip(nameAt(project, step.key)));
}
