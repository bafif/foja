import { useEffect, useState } from "react";
import { FONT_FILE, readFont, safePath, toBase64 } from "@foja/core";
import { latexStyleOf } from "@foja/core/export/latex-template";
import { compileProfileLatex, missingFonts } from "../../lib/latex";
import { t } from "../i18n";
import { useEditor } from "../store";

const MAX_BYTES = 15 * 1024 * 1024;

/** The fonts of a XeLaTeX template: the ones it names and Foja does not bring, and the ones the user
 * uploaded (or that came with it), which are kept with the style and found by XeTeX by name. */
export function LatexFonts() {
  const project = useEditor((s) => s.project!);
  const profileId = useEditor((s) => s.profileId);
  const update = useEditor((s) => s.update);
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const style = latexStyleOf(project, profileId);
  const xetex = style?.fill.engine === "xetex";
  const T = t.latexFonts;

  useEffect(() => {
    let live = true;
    setMissing([]);
    if (xetex) void compileProfileLatex(project, profileId)?.then((r) => live && setMissing(missingFonts(r.errors)));
    return () => {
      live = false;
    };
  }, [project, profileId, xetex]);

  if (!style || !xetex) return null;
  const fonts = Object.keys(style.template.binaries ?? {}).filter((p) => FONT_FILE.test(p));

  async function add(files: FileList) {
    setError(undefined);
    const added: Record<string, string> = {};
    for (const file of Array.from(files)) {
      const data = new Uint8Array(await file.arrayBuffer());
      if (!FONT_FILE.test(file.name) || !readFont(data)) return setError(T.notAFont(file.name));
      if (data.length > MAX_BYTES) return setError(T.tooBig(file.name));
      added[`fonts/${safePath(file.name.split(/[\\/]/).pop()!.replace(/[^A-Za-z0-9._ +-]/g, "_"))}`] = toBase64(data);
    }
    update((draft) => {
      const template = draft.templates![style!.id];
      template.binaries = { ...template.binaries, ...added };
    });
  }

  function remove(path: string) {
    update((draft) => {
      const template = draft.templates![style!.id];
      const { [path]: _, ...rest } = template.binaries ?? {};
      template.binaries = rest;
    });
  }

  return (
    <section aria-label={T.title} className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">{T.title}</h3>
      {missing.length > 0 && (
        <p role="status" className="rounded bg-surface-2 p-2 text-sm">
          {T.missing(missing)}
        </p>
      )}
      {fonts.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {fonts.map((path) => (
            <li key={path} className="flex items-center gap-2">
              <span className="font-mono text-xs">{path.split("/").pop()}</span>
              <button type="button" className="text-xs text-muted underline" onClick={() => remove(path)} aria-label={T.remove(path.split("/").pop()!)}>
                {t.remove}
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="flex flex-col gap-1 text-sm">
        {T.upload}
        <input type="file" accept=".otf,.ttf" multiple className="text-sm" onChange={(e) => e.target.files?.length && void add(e.target.files)} />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <p className="text-xs text-muted">{T.hint}</p>
    </section>
  );
}
