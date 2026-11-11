import { useMemo, useState } from "react";
import {
  BUILTIN_STYLES,
  ENTRY_FIELDS,
  HEADER_FIELDS,
  freshId,
  importData,
  importStyle,
  macroArgs,
  proposeMapping,
  readTemplate,
  readUpload,
  type EntryField,
  type HeaderField,
  type Mapping,
  type Project,
  type Template,
} from "@foja/core";
import { warmLatex } from "../../lib/latex";
import { t } from "../i18n";
import { useEditor } from "../store";
import { Button, Check, Field, Panel, Select, TextInput } from "../ui";

const clip = (text: string) => (text.length > 60 ? `${text.slice(0, 57)}…` : text);

/** Upload a Typst or LaTeX template, review which argument is which field, and bring in its
 * data, its look, or both. Everything here is fixed rules (core/src/importer); nothing runs but
 * Typst, and LaTeX in its worker for a LaTeX template's look. */
export function ImportTemplate() {
  const project = useEditor((s) => s.project!);
  const update = useEditor((s) => s.update);
  const load = useEditor((s) => s.load);
  const setProfile = useEditor((s) => s.setProfile);
  const T = t.importer;
  const [template, setTemplate] = useState<Template>();
  const [mapping, setMapping] = useState<Mapping>();
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [data, setData] = useState(true);
  const [look, setLook] = useState(true);
  const [into, setInto] = useState<"add" | "new">("add");

  async function read(file: File) {
    setError(undefined);
    try {
      const next = readTemplate(await readUpload(file.name, new Uint8Array(await file.arrayBuffer())));
      setTemplate(next);
      setMapping(proposeMapping(next));
      setName(file.name.replace(/\.(typ|tex|zip|tar\.gz|tgz)$/i, ""));
      setLook(next.missing.length === 0);
      // LaTeX's first start downloads the engine and makes its format: begin while the form is read.
      if (next.engine === "latex") warmLatex(next.latexEngine);
    } catch (e) {
      setTemplate(undefined);
      setError(T.failed((e as Error).message));
    }
  }

  const preview = useMemo(() => (template && mapping ? importData(template, mapping, { name: name || "x", language: project.language }) : undefined), [template, mapping, name, project.language]);
  const canLook = !!template && template.missing.length === 0;

  function run() {
    if (!template || !mapping) return;
    const label = name.trim() || T.title;
    const base: Project | undefined = into === "add" ? project : undefined;
    let next: Project;
    let profileId: string | undefined;
    if (data || !base) ({ project: next, profileId } = importData(template, mapping, { name: label, language: project.language, into: base }));
    else next = structuredClone(base);
    if (look && canLook) {
      const id = freshId(label, [...BUILTIN_STYLES.map((s) => s.id), ...Object.keys(next.templates ?? {})], "estilo");
      next.templates = { ...next.templates, [id]: importStyle(template, mapping, id, label) };
      const target = profileId ?? useEditor.getState().profileId;
      next.profiles[target].layout = { ...next.profiles[target].layout, template: id };
    }
    if (into === "new") load(next, profileId);
    else {
      update((draft) => {
        Object.assign(draft, next);
      });
      if (profileId) setProfile(profileId);
    }
    setTemplate(undefined);
  }

  const setHeader = (key: string, f: HeaderField) => setMapping((m) => m && { ...m, header: { ...m.header, [key]: f } });
  const setField = (macro: string, key: string, f: EntryField) => setMapping((m) => m && { ...m, macros: { ...m.macros, [macro]: { ...m.macros[macro], [key]: f } } });
  const headerOptions: [HeaderField, string][] = HEADER_FIELDS.map((f) => [f, (T.headerFields as Record<string, string>)[f] ?? t.contactKinds[f as keyof typeof t.contactKinds]]);
  const entryOptions: [EntryField, string][] = ENTRY_FIELDS.map((f) => [f, T.entryFields[f]]);

  return (
    <Panel title={T.title}>
      <p className="text-sm text-muted">{T.hint}</p>
      <Field label={T.file}>
        {(fid) => <input id={fid} type="file" accept=".typ,.tex,.zip,.tar.gz,.tgz" className="text-sm" onChange={(e) => e.target.files?.[0] && void read(e.target.files[0])} />}
      </Field>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {template && mapping && (
        <>
          {template.engine === "latex" && <p className="rounded bg-surface-2 p-2 text-sm">{T.latex(template.latexEngine === "xetex")}</p>}
          {template.missing.length > 0 && <p className="rounded bg-surface-2 p-2 text-sm">{T.missing(template.missing.join(", "))}</p>}
          {template.fonts.length > 0 && <p className="text-xs text-muted">{T.fonts(template.fonts.join(", "))}</p>}
          <p className="text-xs text-muted">{template.license ? T.license(template.license) : T.noLicense}</p>

          {template.header && (
            <ArgTable title={`${T.header} · ${template.header.fn}`} rows={template.header.args.map((a) => ({ key: a.key, sample: a.text }))}>
              {(key) => <Select<HeaderField> value={mapping.header[key] ?? "keep"} options={headerOptions} onChange={(f) => setHeader(key, f)} />}
            </ArgTable>
          )}
          {Object.entries(template.macros).map(([macro, calls]) => (
            <ArgTable key={macro} title={T.macro(macro, calls.length)} rows={macroArgs(calls).map((a) => ({ key: a.key, sample: a.sample.list?.join(" · ") ?? a.sample.text }))}>
              {(key) => <Select<EntryField> value={mapping.macros[macro]?.[key] ?? "omit"} options={entryOptions} onChange={(f) => setField(macro, key, f)} />}
            </ArgTable>
          ))}

          <section aria-label={T.preview} className="flex flex-col gap-1 rounded border border-line p-2 text-sm">
            <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">{T.preview}</h3>
            {preview && preview.entries > 0 ? (
              preview.project.profiles[preview.profileId].sections.map((s) => (
                <div key={s.id}>
                  <strong>{s.title}</strong>
                  <ul className="ml-4 list-disc">
                    {s.blocks.map((b, i) => {
                      if (b.type !== "entry") return <li key={i}>{clip(b.text)}</li>;
                      const e = preview.project.entries[b.entry];
                      return <li key={i}>{[e.title, e.place, [e.start, e.end === null ? "…" : e.end].filter(Boolean).join(" – "), e.items?.length ? `${e.items.length} ${t.items.toLowerCase()}` : ""].filter(Boolean).join(" · ")}</li>;
                    })}
                  </ul>
                </div>
              ))
            ) : (
              <p className="text-muted">{T.previewNone}</p>
            )}
          </section>

          <Field label={T.name}>{(fid) => <TextInput id={fid} value={name} onChange={setName} />}</Field>
          <Check label={T.data} checked={data} onChange={setData} />
          {canLook && <Check label={T.look} checked={look} onChange={setLook} />}
          <div className="flex flex-col gap-1 text-sm" role="radiogroup">
            {(["add", "new"] as const).map((v) => (
              <label key={v} className="flex items-center gap-2">
                <input type="radio" name="foja-import-into" checked={into === v} onChange={() => setInto(v)} />
                {T[v]}
              </label>
            ))}
          </div>
          <div>
            <Button variant="primary" onClick={run} disabled={!data && !(look && canLook)}>
              {T.import}
            </Button>
          </div>
        </>
      )}
    </Panel>
  );
}

function ArgTable({ title, rows, children }: { title: string; rows: { key: string; sample: string }[]; children: (key: string) => React.ReactNode }) {
  const T = t.importer;
  return (
    <section aria-label={title} className="flex flex-col gap-1">
      <h3 className="font-mono text-xs font-semibold text-muted">{title}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="font-medium">{T.argument}</th>
            <th className="font-medium">{T.example}</th>
            <th className="font-medium">{T.field}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-line align-middle">
              <td className="py-1 pr-2 font-mono text-xs">{r.key}</td>
              <td className="py-1 pr-2">{clip(r.sample)}</td>
              <td className="py-1" aria-label={`${T.field}: ${r.key}`}>
                {children(r.key)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
