import { iosBrowser } from "./device";
import { t } from "./i18n";

/** How to add Foja to the Home Screen of an iPhone or iPad, where no browser lets a page install itself. */
export function InstallSteps() {
  const browser = iosBrowser();
  return (
    <div data-testid="install-steps" className="flex flex-col gap-1 text-xs">
      <ol className="list-decimal pl-5">
        {t.installSteps[browser].map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="text-muted">{t.installElse[browser]}</p>
    </div>
  );
}
