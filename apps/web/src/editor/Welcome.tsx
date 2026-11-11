import { useState } from "react";
import { installed, ios } from "./device";
import { t } from "./i18n";
import { LanguageSelect } from "./LanguageSelect";
import { EXAMPLE_IDS, emptyProject, exampleProject, parseProject } from "./projects";
import { useEditor } from "./store";

export function Welcome() {
  const load = useEditor((s) => s.load);
  const [error, setError] = useState<string>();
  return (
    <main className="mx-auto flex min-h-full max-w-xl flex-col justify-center gap-6 p-6">
      <div className="flex justify-end">
        <LanguageSelect />
      </div>
      <h1 className="text-3xl font-semibold">{t.welcomeTitle}</h1>
      <p className="text-muted">{t.welcomeText}</p>
      {ios() && !installed() && (
        <p data-testid="ios-install" className="rounded border border-line bg-surface-2 p-3 text-sm">
          {t.iosKeep}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button className="rounded bg-accent px-4 py-2 text-on-accent hover:opacity-90" onClick={() => load(exampleProject())}>
          {t.startExample}
        </button>
        <button className="rounded border border-line px-4 py-2 hover:bg-surface-2" onClick={() => load(emptyProject())}>
          {t.startEmpty}
        </button>
        <ImportButton onError={setError} />
      </div>
      <p data-testid="example-profiles" className="text-sm text-muted">
        {t.exampleProfiles}
      </p>
      <section className="flex flex-col gap-2" aria-labelledby="more-examples">
        <h2 id="more-examples" className="text-lg font-semibold">
          {t.moreExamples}
        </h2>
        <p className="text-sm text-muted">{t.moreExamplesText}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {EXAMPLE_IDS.map((id) => (
            <button
              key={id}
              data-example={id}
              className="flex flex-col items-start gap-1 rounded border border-line p-3 text-left hover:border-accent hover:bg-surface-2"
              onClick={() => load(exampleProject(id))}
            >
              <span className="font-semibold">{t.examples[id].name}</span>
              <span className="text-xs text-muted">{t.examples[id].description}</span>
            </button>
          ))}
        </div>
      </section>
      {error && (
        <pre role="alert" className="text-sm whitespace-pre-wrap text-red-700">
          {t.importFailed}
          {"\n"}
          {error}
        </pre>
      )}
    </main>
  );
}

export function ImportButton({ onError, className }: { onError: (message?: string) => void; className?: string }) {
  const load = useEditor((s) => s.load);
  return (
    <label className={className ?? "cursor-pointer rounded border border-line px-4 py-2 hover:bg-surface-2"}>
      {t.importJson}
      <input
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            load(parseProject(await file.text()));
            onError(undefined);
          } catch (err) {
            onError((err as Error).message);
          }
        }}
      />
    </label>
  );
}
