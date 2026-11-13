import { useEffect, useRef, useState } from "react";
import type { ExportFormat, ExportedFile } from "@foja/core/export";
import { svgToJpegs } from "../lib/jpg";
import { canShareFiles, shareable } from "./device";
import { desktop } from "./desktop";
import { download } from "./download";
import { openInOverleaf } from "./overleaf";
import { t } from "./i18n";
import { styleOf } from "@foja/core";
import type { MeasuredWord } from "@foja/core";
import { copiesLines } from "@foja/core/export/style";
import { compilePdf, measureLines, renderThumb } from "./preview";
import { useEditor } from "./store";
import { templateFiles, wordFonts } from "./template";

type Choice = ExportFormat | "all";
const CHOICES: Choice[] = ["pdf", "jpg", "docx", "typ", "tex", "md", "json", "jsonresume", "all"];
const MEMORY = "foja.export";

function remembered(): { format: Choice; dpi: number } {
  try {
    return { format: "pdf", dpi: 150, ...JSON.parse(localStorage.getItem(MEMORY) ?? "{}") };
  } catch {
    return { format: "pdf", dpi: 150 };
  }
}

/** Where Typst breaks the lines of the profile, measured when first asked for. */
type Lines = () => Promise<MeasuredWord[] | undefined>;

async function build(format: Choice, dpi: number, lines: Lines): Promise<ExportedFile> {
  const { project, profileId, history } = useEditor.getState();
  const { exportFiles, exportStem, bundleExports } = await import("@foja/core/export");
  // The project file carries the versions; the other formats ignore them.
  const file = history ? { ...project!, history } : project!;
  const stem = exportStem(project!, profileId);
  const pdf = async (): Promise<ExportedFile> => ({ name: `${stem}.pdf`, mime: "application/pdf", data: await compilePdf(project!, profileId) });
  const jpgs = async (): Promise<ExportedFile[]> => {
    // A fresh render of this very project and profile, not the preview (which can lag behind or
    // be the last good one before an error).
    const svg = await renderThumb(project!, profileId, styleOf(project!, profileId).id);
    if (!svg) throw new Error(t.compileError);
    const pages = await svgToJpegs(svg, dpi);
    return pages.map((data, i) => ({ name: pages.length === 1 ? `${stem}.jpg` : `${stem}-${i + 1}.jpg`, mime: "image/jpeg", data }));
  };
  if (format === "pdf") return pdf();
  if (format === "jpg") {
    const files = await jpgs();
    return files.length === 1 ? files[0] : bundleExports(project!, profileId, files);
  }
  if (format === "all") {
    const inputs = { template: await templateFiles(), wordFonts: await wordFonts(), measured: await lines() };
    const files = [await pdf(), ...(await jpgs())];
    for (const f of ["docx", "typ", "tex", "md", "json", "jsonresume"] as const) files.push(...(await exportFiles(file, profileId, f, inputs)));
    return bundleExports(project!, profileId, files);
  }
  const files = await exportFiles(file, profileId, format, {
    template: format === "typ" ? await templateFiles() : undefined,
    wordFonts: format === "docx" ? await wordFonts() : undefined,
    measured: format === "docx" || format === "tex" ? await lines() : undefined,
  });
  // JSON: the project file, which is what Foja imports; the resolved profile is in "all".
  return files[0];
}

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [choice, setChoice] = useState(remembered);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  // On a phone the file is built first and then shared: the share sheet needs a fresh tap, and
  // building a PDF can take longer than the browser keeps the first one valid.
  const [ready, setReady] = useState<{ built: ExportedFile; file: File }>();
  // What the format had no place for (JSON Resume): the dialog stays open to say it.
  const [left, setLeft] = useState<string>();
  const sharing = canShareFiles();
  // Loaded up front: "Open in Overleaf" builds the zip inside the click, where a new tab is allowed.
  const [exporters, setExporters] = useState<typeof import("@foja/core/export")>();
  // Where Typst breaks the lines, which LaTeX and Word copy: measured once, as soon as one of them is chosen, so that
  // "Open in Overleaf", which cannot wait, finds it done.
  const lines = useRef<{ promise: Promise<MeasuredWord[] | undefined>; words?: MeasuredWord[] }>(undefined);
  const measured = () => {
    if (!lines.current) {
      const { project, profileId } = useEditor.getState();
      const promise = copiesLines(project!, profileId) ? measureLines(project!, profileId) : Promise.resolve(undefined);
      const current: { promise: typeof promise; words?: MeasuredWord[] } = { promise };
      void promise.then((words) => (current.words = words));
      lines.current = current;
    }
    return lines.current.promise;
  };
  useEffect(() => {
    if (choice.format === "tex" || choice.format === "docx" || choice.format === "all") void measured();
  }, [choice.format]);
  // A webview cannot post a form to a new tab: Overleaf is a browser action.
  const overleaf = choice.format === "tex" && !desktop();

  useEffect(() => {
    dialog.current?.showModal();
    void import("@foja/core/export").then(setExporters);
  }, []);

  function toOverleaf() {
    if (!exporters) return;
    setError(undefined);
    try {
      const { project, profileId } = useEditor.getState();
      openInOverleaf(exporters.overleafProject(project!, profileId, lines.current?.words));
    } catch (e) {
      setError(`${t.exportFailed} ${(e as Error).message}`);
    }
  }

  function choose(next: typeof choice) {
    setChoice(next);
    setReady(undefined);
    setLeft(undefined);
  }

  async function share() {
    if (!ready) return;
    setError(undefined);
    try {
      await navigator.share({ files: [ready.file], title: ready.file.name });
      onClose();
    } catch (e) {
      // Closing the share sheet without picking anything is not an error.
      if ((e as Error).name !== "AbortError") setError(`${t.exportFailed} ${(e as Error).message}`);
    }
  }

  async function run() {
    setBusy(true);
    setError(undefined);
    try {
      localStorage.setItem(MEMORY, JSON.stringify(choice));
    } catch {
      // Storage can be unavailable (private windows); the choice is just not remembered.
    }
    try {
      const built = await build(choice.format, choice.dpi, measured);
      const note = built.left?.length ? t.jsonResumeLeft(built.left.join(", ")) : undefined;
      setLeft(note);
      const file = shareable(built.name, built.data, built.mime);
      if (file) {
        setReady({ built, file });
        return;
      }
      await download(built.name, built.data, built.mime);
      if (!note) onClose();
    } catch (e) {
      setError(`${t.exportFailed} ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialog} onClose={onClose} className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg bg-surface p-0 text-ink shadow-xl backdrop:bg-black/40">
      <form
        method="dialog"
        className="flex flex-col gap-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <h2 className="text-lg font-semibold">{t.exportTitle}</h2>
        <fieldset className="flex flex-col gap-1">
          <legend className="sr-only">{t.format}</legend>
          {CHOICES.map((f) => (
            <label key={f} className="flex items-center gap-2 text-sm">
              <input type="radio" name="format" value={f} checked={choice.format === f} onChange={() => choose({ ...choice, format: f })} />
              {t.formats[f]}
            </label>
          ))}
        </fieldset>
        {(choice.format === "jpg" || choice.format === "all") && (
          <label className="flex items-center gap-2 text-sm">
            {t.dpi}
            <select className="rounded border border-line px-2 py-1" value={choice.dpi} onChange={(e) => choose({ ...choice, dpi: Number(e.target.value) })}>
              {[72, 150, 300].map((d) => (
                <option key={d} value={d}>
                  {d} dpi
                </option>
              ))}
            </select>
          </label>
        )}
        {overleaf && (
          <p data-testid="overleaf-note" className="text-sm text-muted">
            {t.overleafNote}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm whitespace-pre-wrap text-red-700">
            {error}
          </p>
        )}
        {left && (
          <p data-testid="export-left" className="text-sm text-muted">
            {left}
          </p>
        )}
        {ready && (
          <p role="status" className="text-sm break-all">
            {t.exportReady} <strong>{ready.file.name}</strong>
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="rounded border border-line px-3 py-1 text-sm" onClick={onClose}>
            {t.close}
          </button>
          {ready ? (
            <>
              <button
                type="button"
                className="rounded border border-line px-3 py-1 text-sm"
                onClick={() => (void download(ready.built.name, ready.built.data, ready.built.mime), onClose())}
              >
                {t.downloadButton}
              </button>
              <button type="button" className="rounded bg-accent px-3 py-1 text-sm text-on-accent" onClick={() => void share()}>
                {t.shareButton}
              </button>
            </>
          ) : (
            <>
              {overleaf && (
                <button type="button" disabled={!exporters} className="rounded border border-line px-3 py-1 text-sm disabled:opacity-50" onClick={toOverleaf}>
                  {t.overleafButton}
                </button>
              )}
              <button type="submit" disabled={busy} className="rounded bg-accent px-3 py-1 text-sm text-on-accent disabled:opacity-50">
                {busy ? t.exporting : sharing ? t.prepareButton : desktop() ? t.saveAsButton : t.downloadButton}
              </button>
            </>
          )}
        </div>
      </form>
    </dialog>
  );
}
