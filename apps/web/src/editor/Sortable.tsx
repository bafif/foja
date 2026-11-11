// Drag-and-drop reordering with dnd-kit. The handle also works from the keyboard (Space to pick
// up, arrows to move, Space to drop), and the ↑ ↓ buttons stay as the plain alternative.

import { createContext, useContext, type ReactNode } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { Accessibility, KeyboardSensor, PointerActivationConstraints, PointerSensor } from "@dnd-kit/dom";
import { t } from "./i18n";

/** The ids of the list an item is in: its place among them is its index. */
const List = createContext<string[]>([]);

export function SortableList({ ids, onMove, children }: { ids: string[]; onMove: (from: number, to: number) => void; children: ReactNode }) {
  return (
    <DragDropProvider
      // A pointer picks an item up only after moving 4 px, so a click on the handle is a click.
      sensors={[PointerSensor.configure({ activationConstraints: () => [new PointerActivationConstraints.Distance({ value: 4 })] }), KeyboardSensor]}
      plugins={(plugins) => [...plugins.filter((p) => p !== Accessibility), Accessibility.configure({ screenReaderInstructions: { draggable: t.dragInstructions } })]}
      onDragEnd={({ operation, canceled }) => {
        const { source } = operation;
        if (canceled || !isSortable(source) || source.initialIndex === source.index) return;
        onMove(source.initialIndex, source.index);
      }}
    >
      <List.Provider value={ids}>{children}</List.Provider>
    </DragDropProvider>
  );
}

/** An element of a SortableList; `children` gets the drag handle to place. */
export function SortableItem({ id, children, as: Tag = "div", className }: { id: string; children: (handle: ReactNode) => ReactNode; as?: "div" | "li"; className?: string }) {
  const index = useContext(List).indexOf(id);
  const { ref, handleRef, isDragging } = useSortable({ id, index });
  const handle = (
    <button ref={handleRef} type="button" aria-label={t.dragHandle} className="cursor-grab touch-none px-1 text-muted hover:text-muted">
      ⠿
    </button>
  );
  return (
    <Tag ref={ref} className={`${className ?? ""} ${isDragging ? "relative z-10 opacity-80 shadow-lg" : ""}`}>
      {children(handle)}
    </Tag>
  );
}
