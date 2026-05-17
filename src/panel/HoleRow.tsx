import { Eye, EyeOff, Trash2 } from "lucide-react";
import type { Selection } from "../types";
import { useAppStore } from "../state/store";
import { DepthControl } from "./DepthControl";

interface HoleRowProps {
  selection: Selection;
  isBatchEditing?: boolean;
  isChecked?: boolean;
}

export function HoleRow({ selection, isBatchEditing = false, isChecked = false }: HoleRowProps) {
  const updateSelection = useAppStore((state) => state.updateSelection);
  const removeSelection = useAppStore((state) => state.removeSelection);
  const toggleCheckedSelection = useAppStore((state) => state.toggleCheckedSelection);

  return (
    <li className={isBatchEditing ? "hole-row batch-row" : "hole-row"}>
      {isBatchEditing && (
        <label className="batch-check" title={`Include ${selection.label} in batch edits`}>
          <input
            type="checkbox"
            checked={isChecked}
            onChange={() => toggleCheckedSelection(selection.id)}
          />
          <span className="sr-only">Include {selection.label} in batch edits</span>
        </label>
      )}
      <span className="swatch" style={{ background: selection.color }} />
      <input
        className="hole-name"
        value={selection.label}
        onChange={(event) => updateSelection(selection.id, { label: event.target.value })}
      />
      <button
        className="icon-button small"
        title={selection.visible ? "Hide fill" : "Show fill"}
        onClick={() => updateSelection(selection.id, { visible: !selection.visible })}
      >
        {selection.visible ? <Eye size={16} /> : <EyeOff size={16} />}
      </button>
      <button className="icon-button small" title="Delete fill" onClick={() => removeSelection(selection.id)}>
        <Trash2 size={16} />
      </button>
      <div className="row-depth">
        <DepthControl
          compact
          value={selection.depth}
          onChange={(depth) => updateSelection(selection.id, { depth })}
        />
      </div>
    </li>
  );
}
