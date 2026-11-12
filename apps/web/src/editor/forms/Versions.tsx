// The versions of the project: turn them on, save one with a name, and for each, see how the
// profile looked, what changed since, restore it (one Ctrl+Z away), name it or delete it.

import { useEffect, useMemo, useState } from "react";
import { compareVersion, deleteVersion, renameVersion, snapshot, startHistory, styleOf, versionProject, type Change, type History, type Project, type Version, type VersionProject } from "@foja/core";
import { t, useLanguage } from "../i18n";
import { renderThumb } from "../preview";
import { safeSvg } from "../Preview";
import { SvgView } from "../SvgView";
import { useEditor } from "../store";
import { Button, Field, Panel, TextInput } from "../ui";

const SHOWN = 60;

export function VersionsPanel() {
  const history = useEditor((s) => s.history);
  const setHistory = useEditor((s) => s.setHistory);
  const [name, setName] = useState("");
  const [open, setOpen] = useState<Version>();
  const [confirmOff, setConfirmOff] = useState(false);
  const [message, setMessage] = useState<string>();
  const project = () => useEditor.getState().project!;

  if (!history)
    return (
      <Panel title={t.versions.title}>
        <p className="text-sm">{t.versions.off}</p>
        <div>
          <Button variant="primary" onClick={() => setHistory(startHistory(project(), new Date()))}>
            {t.versions.turnOn}
          </Button>
        </div>
      </Panel>
    );

  return (
    <Panel title={t.versions.title}>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          setHistory(snapshot(history, project(), new Date(), name.trim()));
          setName("");
        }}
      >
        <div className="min-w-0 flex-1">
          <Field label={t.versions.name}>{(id) => <TextInput id={id} value={name} onChange={setName} placeholder={t.versions.namePlaceholder} />}</Field>
        </div>
        <Button type="submit" variant="primary" disabled={!name.trim()}>
          {t.versions.save}
        </Button>
      </form>
      {message && (
        <p role="status" className="rounded bg-surface-2 px-2 py-1 text-sm">
          {message}
        </p>
      )}
      <ul className="flex flex-col gap-2" aria-label={t.versions.title}>
        {history.versions
          .map((v, i) => (
            <VersionRow key={`${i}-${v.date}`} history={history} version={v} open={open === v} onOpen={() => setOpen(open === v ? undefined : v)} onRestored={() => setMessage(t.versions.restored)} />
          ))
          .reverse()}
      </ul>
      <p className="text-xs text-muted">{t.versions.thinning}</p>
      <div className="flex flex-wrap items-center gap-2">
        {confirmOff ? (
          <>
            <span className="text-sm">{t.versions.confirmOff(history.versions.length)}</span>
            <Button variant="danger" onClick={() => (setHistory(undefined), setConfirmOff(false))}>
              {t.versions.yesOff}
            </Button>
            <Button onClick={() => setConfirmOff(false)}>{t.cancel}</Button>
          </>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmOff(true)}>
            {t.versions.turnOff}
          </Button>
        )}
      </div>
    </Panel>
  );
}

function useDate(version: Version): string {
  const lang = useLanguage((s) => s.lang);
  return new Date(version.date).toLocaleString(lang, { dateStyle: "medium", timeStyle: "short" });
}

function VersionRow({ history, version, open, onOpen, onRestored }: { history: History; version: Version; open: boolean; onOpen: () => void; onRestored: () => void }) {
  const setHistory = useEditor((s) => s.setHistory);
  const date = useDate(version);
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState(version.name ?? "");
  const [deleting, setDeleting] = useState(false);

  function restore() {
    const { project, replace } = useEditor.getState();
    if (!project) return;
    // What is there now stays as a named version: restoring can be undone after a reload too.
    setHistory(snapshot(history, project, new Date(), t.versions.beforeRestore(version.name, date)));
    replace(versionProject(history, version));
    onRestored();
  }

  return (
    <li data-testid="version" className="flex flex-col gap-2 rounded border border-line p-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-medium">{version.name ?? t.versions.automatic}</span>
        <span className="text-xs text-muted">{date}</span>
        <span className="ml-auto flex flex-wrap gap-1">
          <Button variant="ghost" expanded={open} onClick={onOpen}>
            {open ? t.versions.hide : t.versions.open}
          </Button>
          <Button onClick={restore}>{t.versions.restore}</Button>
          <Button variant="ghost" expanded={naming} onClick={() => setNaming(!naming)}>
            {version.name ? t.versions.rename : t.versions.giveName}
          </Button>
          {deleting ? (
            <>
              <Button variant="danger" onClick={() => setHistory(deleteVersion(history, version))}>
                {t.yesDelete}
              </Button>
              <Button onClick={() => setDeleting(false)}>{t.cancel}</Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setDeleting(true)}>
              {t.versions.delete}
            </Button>
          )}
        </span>
      </div>
      {naming && (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setHistory(renameVersion(history, version, draft));
            setNaming(false);
          }}
        >
          <div className="min-w-0 flex-1">
            <TextInput label={t.versions.name} value={draft} onChange={setDraft} placeholder={t.versions.namePlaceholder} />
          </div>
          <Button type="submit">{t.versions.saveName}</Button>
        </form>
      )}
      {open && <VersionDetails history={history} version={version} />}
    </li>
  );
}

function VersionDetails({ history, version }: { history: History; version: Version }) {
  const project = useEditor((s) => s.project!);
  const profileId = useEditor((s) => s.profileId);
  // By the version alone: a save changes the history, not this version.
  const old = useMemo(() => versionProject(history, version), [version]);
  const changes = useMemo(() => compareVersion(history, version, project), [version, project]);
  const hidden = changes.length - SHOWN;
  const shownProfile = old.profiles[profileId] ? profileId : Object.keys(old.profiles)[0];
  const [svg, setSvg] = useState<string>();
  useEffect(() => {
    let live = true;
    void renderThumb(old, shownProfile, styleOf(old, shownProfile).id).then((s) => live && setSvg(s && safeSvg(s)));
    return () => {
      live = false;
    };
  }, [old, shownProfile]);

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-2">
      <p className="text-sm">{t.versions.changes(changes.length)}</p>
      {changes.length > 0 && (
        <ul data-testid="version-changes" className="flex flex-col gap-1 text-sm">
          {changes.slice(0, SHOWN).map((c) => (
            <ChangeRow key={c.path.join("/")} change={c} before={version.project} after={project} />
          ))}
        </ul>
      )}
      {hidden > 0 && <p className="text-xs text-muted">{t.versions.more(hidden)}</p>}
      <p className="text-xs text-muted">{t.versions.preview}</p>
      <div className="max-h-[32rem] overflow-auto rounded bg-white shadow-sm" data-testid="version-preview">
        {svg && <SvgView svg={svg} />}
      </div>
    </div>
  );
}

// Elements of these lists go by their id in a change's path: not something a person reads.
const LISTS = new Set(["items", "sections", "blocks"]);

function fieldName(key: string): string {
  const own = (t.versions.fields as Record<string, string>)[key];
  const general = (t as unknown as Record<string, unknown>)[key];
  if (own) return own;
  if (typeof general === "string") return general;
  if (general && typeof general === "object" && typeof (general as { label?: unknown }).label === "string") return (general as { label: string }).label;
  return key;
}

/** Where a change is, for a person: the titles of what it is in, then the field. */
function where(path: string[], before: VersionProject, after: Project): string {
  const find = (...keys: string[]): unknown => {
    const pick = (root: unknown) => keys.reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), root);
    return pick(after) ?? pick(before);
  };
  const named = (...keys: string[]) => {
    const value = find(...keys);
    return typeof value === "string" && value ? value : keys.at(-2)!;
  };
  const [top, id, ...rest] = path;
  let parts: string[];
  let tail = rest;
  switch (top) {
    case "person":
      [parts, tail] = [[t.personal], path.slice(1)];
      break;
    case "contacts":
      parts = [t.contacts, t.contactKinds[id as keyof typeof t.contactKinds] ?? id];
      break;
    case "skills":
      parts = [t.skills, named("skills", id, "title")];
      break;
    case "entries":
      parts = id === undefined ? [t.entries] : [t.entries, named("entries", id, "title")];
      break;
    case "profiles":
      parts = id === undefined ? [t.profile] : [t.profile, named("profiles", id, "name")];
      if (rest[0] === "sections" && rest[1] && rest[1] !== "order") {
        const sections = [find("profiles", id, "sections"), (before.profiles[id] as { sections?: unknown } | undefined)?.sections];
        const section = sections.flatMap((s) => (Array.isArray(s) ? s : [])).find((s: { id?: string }) => s.id === rest[1]) as { title?: string } | undefined;
        [parts, tail] = [[...parts, section?.title || rest[1]], rest.slice(2)];
      }
      break;
    case "templates":
      parts = [t.versions.fields.templates, named("templates", id, "name")];
      break;
    default:
      [parts, tail] = [[], path];
  }
  const fields = tail.filter((key, i) => !LISTS.has(tail[i - 1] ?? "") || key === "order").map(fieldName);
  return [...parts, ...fields].join(" › ");
}

/** A value of a change as text; the parts of a name go together with spaces. */
function show(value: unknown, key?: string): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "string") return value || "—";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "✓" : "✗";
  if (Array.isArray(value)) return value.map((v) => show(v)).join(key === "givenNames" || key === "familyNames" ? " " : ", ");
  const o = value as Record<string, unknown>;
  const label = o.title ?? o.name ?? o.text ?? o.heading;
  return typeof label === "string" ? label : JSON.stringify(value);
}

function ChangeRow({ change, before, after }: { change: Change; before: VersionProject; after: Project }) {
  const photo = change.path[0] === "assets";
  const kind = !("before" in change) ? t.versions.added : !("after" in change) ? t.versions.removed : t.versions.changed;
  return (
    <li className="rounded bg-surface-2 px-2 py-1">
      <div className="text-xs text-muted">
        {photo ? t.photo : where(change.path, before, after)} · {kind}
      </div>
      {!photo && (
        <div className="flex flex-col gap-0.5 break-words">
          {"before" in change && <del className="line-clamp-3 text-danger">{show(change.before, change.path.at(-1))}</del>}
          {"after" in change && <ins className="line-clamp-3 no-underline">{show(change.after, change.path.at(-1))}</ins>}
        </div>
      )}
    </li>
  );
}
