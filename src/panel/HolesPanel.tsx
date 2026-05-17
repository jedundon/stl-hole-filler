import { useEffect, useState } from "react";
import { CopyPlus, Download, RotateCcw, RotateCw, SlidersHorizontal } from "lucide-react";
import { useAppStore } from "../state/store";
import { DepthControl } from "./DepthControl";
import { HoleRow } from "./HoleRow";

export function HolesPanel() {
  const selections = useAppStore((state) => state.selections);
  const defaultDepth = useAppStore((state) => state.defaultDepth);
  const setDefaultDepth = useAppStore((state) => state.setDefaultDepth);
  const exportToFile = useAppStore((state) => state.exportToFile);
  const addSimilarSelectionsOnPlane = useAppStore((state) => state.addSimilarSelectionsOnPlane);
  const applyDepthToVisibleSelections = useAppStore((state) => state.applyDepthToVisibleSelections);
  const undoSelectionChange = useAppStore((state) => state.undoSelectionChange);
  const redoSelectionChange = useAppStore((state) => state.redoSelectionChange);
  const canUndo = useAppStore((state) => state.selectionHistoryPast.length > 0);
  const canRedo = useAppStore((state) => state.selectionHistoryFuture.length > 0);
  const isExporting = useAppStore((state) => state.isExporting);
  const hasModel = useAppStore((state) => Boolean(state.mesh));
  const exportArtifact = useAppStore((state) => state.exportArtifact);
  const visibleSelectionCount = selections.filter((selection) => selection.visible).length;
  const [bulkDepth, setBulkDepth] = useState(defaultDepth);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      if (isEditableElement(event.target)) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "z" && event.shiftKey) {
        event.preventDefault();
        redoSelectionChange();
      } else if (key === "z") {
        event.preventDefault();
        undoSelectionChange();
      } else if (key === "y") {
        event.preventDefault();
        redoSelectionChange();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [redoSelectionChange, undoSelectionChange]);

  return (
    <aside className="holes-panel">
      <div className="panel-title">
        <div>
          <h2>Fills</h2>
          <p>{selections.length === 0 ? "Click a recessed area to add it." : `${selections.length} selected`}</p>
        </div>
        <SlidersHorizontal size={18} />
      </div>

      <div className="default-depth">
        <span>Default depth</span>
        <DepthControl value={defaultDepth} onChange={setDefaultDepth} />
      </div>

      {selections.length > 0 && (
        <div className="bulk-actions">
          <div className="history-actions" aria-label="Selection history">
            <button
              className="icon-button"
              title="Undo selection change"
              aria-label="Undo selection change"
              disabled={!canUndo}
              onClick={undoSelectionChange}
            >
              <RotateCcw size={16} />
            </button>
            <button
              className="icon-button"
              title="Redo selection change"
              aria-label="Redo selection change"
              disabled={!canRedo}
              onClick={redoSelectionChange}
            >
              <RotateCw size={16} />
            </button>
          </div>
          <button className="bulk-action-button" onClick={addSimilarSelectionsOnPlane}>
            <CopyPlus size={16} />
            <span>Select similar on plane</span>
          </button>
          <div className="bulk-depth">
            <span>Visible fill depth</span>
            <DepthControl value={bulkDepth} onChange={setBulkDepth} compact />
            <button
              className="bulk-action-button"
              disabled={visibleSelectionCount === 0}
              onClick={() => applyDepthToVisibleSelections(bulkDepth)}
            >
              Apply to {visibleSelectionCount} visible {visibleSelectionCount === 1 ? "fill" : "fills"}
            </button>
          </div>
        </div>
      )}

      {selections.length === 0 ? (
        <div className="empty-panel">
          <div className="mini-diagram">
            <span />
            <span />
            <span />
          </div>
          <p>{hasModel ? "Click the floor of flat engraved text or a logo pocket." : "Load an STL to begin."}</p>
        </div>
      ) : (
        <ul className="holes-list">
          {selections.map((selection) => (
            <HoleRow key={selection.id} selection={selection} />
          ))}
        </ul>
      )}

      <button
        className="export-button"
        disabled={selections.length === 0 || isExporting}
        onClick={() => void exportToFile()}
      >
        <Download size={18} />
        <span>{isExporting ? "Building 3MF..." : "Export 3MF"}</span>
      </button>
      {exportArtifact && (
        <a className="download-link" href={exportArtifact.url} download={exportArtifact.fileName}>
          <Download size={16} />
          <span>
            Download {exportArtifact.fileName} ({formatBytes(exportArtifact.byteLength)})
          </span>
        </a>
      )}
    </aside>
  );
}

function isEditableElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.matches("input, textarea, select, [contenteditable='true']");
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
