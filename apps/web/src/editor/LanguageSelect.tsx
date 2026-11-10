import { LANGUAGES, setLanguage, t, useLanguage, type Language } from "./i18n";

/** The interface language, always in sight: in the header and on the welcome screen. The choice is remembered. */
export function LanguageSelect() {
  const lang = useLanguage((s) => s.lang);
  return (
    <select
      aria-label={t.uiLanguage}
      title={t.uiLanguage}
      className="rounded border border-line bg-surface px-2 py-1 text-sm"
      value={lang}
      onChange={(e) => setLanguage(e.target.value as Language)}
    >
      {Object.entries(LANGUAGES).map(([id, l]) => (
        <option key={id} value={id} lang={id}>
          {l.name}
        </option>
      ))}
    </select>
  );
}
