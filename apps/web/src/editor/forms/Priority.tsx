import { PRIORITIES, type Priority } from "@foja/core";
import { t } from "../i18n";

/** The priority of a thing of the bank, in three states; `normal` is stored as nothing. */
export function PriorityControl({ name, value, onChange }: { name: string; value?: Priority; onChange: (value: Priority | undefined) => void }) {
  const current = value ?? "normal";
  return (
    <div role="radiogroup" aria-label={t.priority.of(name)} title={t.priority.hint} className="inline-flex w-fit shrink-0 overflow-hidden rounded border border-line text-xs">
      {PRIORITIES.map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={current === p}
          onClick={() => onChange(p === "normal" ? undefined : p)}
          className={`px-2 py-0.5 ${current === p ? "bg-accent text-on-accent" : "hover:bg-surface-2"}`}
        >
          {t.priority[p]}
        </button>
      ))}
    </div>
  );
}

/** Sets or clears `priority` on a thing of the bank. */
export function setPriority(thing: { priority?: Priority }, value: Priority | undefined) {
  if (value) thing.priority = value;
  else delete thing.priority;
}
