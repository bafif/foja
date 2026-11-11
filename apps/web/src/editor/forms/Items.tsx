import { freshId, type Item } from "@foja/core";
import { t } from "../i18n";
import { useProblem } from "../store";
import { Button, ListControls, TextArea, TextInput, move } from "../ui";
import { PriorityControl, setPriority } from "./Priority";

/** A list of `{heading?, text}`; `onChange` receives a new array. `base` is its JSON pointer. */
export function ItemsEditor({ items, onChange, base }: { items: Item[]; onChange: (items: Item[]) => void; base: string }) {
  const edit = (fn: (list: Item[]) => void) => {
    const list = structuredClone(items);
    fn(list);
    onChange(list);
  };
  return (
    <div className="flex flex-col gap-2">
      {items.map((it, i) => (
        <ItemRow
          key={it.id}
          item={it}
          path={`${base}/${i}`}
          edit={(fn) => edit((l) => fn(l[i]))}
          below={<PriorityControl name={it.heading || it.text || t.text} value={it.priority} onChange={(v) => edit((l) => setPriority(l[i], v))} />}
        >
          <ListControls index={i} length={items.length} move={(a, b) => edit((l) => move(l, a, b))} remove={() => edit((l) => l.splice(i, 1))} labels={t} />
        </ItemRow>
      ))}
      <div>
        <Button onClick={() => edit((l) => l.push({ id: freshId("item", l.map((x) => x.id)), text: "" }))}>{t.addItem}</Button>
      </div>
    </div>
  );
}

/** An item's fields; `below` goes under them (the priority of a bank item), `children` beside. */
export function ItemRow({
  item,
  path,
  edit,
  children,
  below,
}: {
  item: { heading?: string; text: string };
  path: string;
  edit: (fn: (it: { heading?: string; text: string }) => void) => void;
  children?: React.ReactNode;
  below?: React.ReactNode;
}) {
  const problem = useProblem(`${path}/text`);
  return (
    // On a narrow screen the controls beside the fields go under them, so the fields keep a usable width.
    <div className="flex flex-wrap justify-end gap-2 rounded border border-line p-2">
      <div className="flex min-w-[13rem] flex-1 flex-col gap-1">
        <TextInput
          value={item.heading ?? ""}
          placeholder={t.heading}
          label={t.heading}
          onChange={(v) =>
            edit((it) => {
              if (v) it.heading = v;
              else delete it.heading;
            })
          }
        />
        <TextArea rows={2} label={t.text} value={item.text} onChange={(v) => edit((it) => (it.text = v))} />
        {problem && <p className="text-xs text-red-700 dark:text-red-400">{problem}</p>}
        {below}
      </div>
      {children}
    </div>
  );
}
