import { Eye, EyeOff, Trash2 } from "lucide-react";
import type { Selection } from "../types";
import { useAppStore } from "../state/store";
import { DepthControl } from "./DepthControl";

interface HoleRowProps {
  selection: Selection;
}

export function HoleRow({ selection }: HoleRowProps) {
  const updateSelection = useAppStore((state) => state.updateSelection);
  const removeSelection = useAppStore((state) => state.removeSelection);

  return (
    <li className="hole-row">
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
