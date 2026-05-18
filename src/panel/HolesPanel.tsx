import { useEffect, useState } from "react";
import {
  CheckCircle2,
  CheckSquare,
  CopyPlus,
  Download,
  Eye,
  EyeOff,
  FileArchive,
  RotateCcw,
  RotateCw,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { useAppStore } from "../state/store";
import { DepthControl } from "./DepthControl";
import { HoleRow } from "./HoleRow";

export function HolesPanel() {
  const items = useAppStore((state) => state.items);
  const activeItemId = useAppStore((state) => state.activeItemId);
  const profile = useAppStore((state) => state.profile);
  const selections = useAppStore((state) => state.selections);
  const defaultDepth = useAppStore((state) => state.defaultDepth);
  const setDefaultDepth = useAppStore((state) => state.setDefaultDepth);
  const setActiveItem = useAppStore((state) => state.setActiveItem);
  const buildProfileFromSelections = useAppStore((state) => state.buildProfileFromSelections);
  const runBatchDetection = useAppStore((state) => state.runBatchDetection);
  const markActiveItemReviewed = useAppStore((state) => state.markActiveItemReviewed);
  const exportToFile = useAppStore((state) => state.exportToFile);
  const exportAllToZip = useAppStore((state) => state.exportAllToZip);
  const addSimilarSelectionsOnPlane = useAppStore((state) => state.addSimilarSelectionsOnPlane);
  const undoSelectionChange = useAppStore((state) => state.undoSelectionChange);
  const redoSelectionChange = useAppStore((state) => state.redoSelectionChange);
  const isBatchEditing = useAppStore((state) => state.isBatchEditing);
  const checkedSelectionIds = useAppStore((state) => state.checkedSelectionIds);
  const enterBatchEditing = useAppStore((state) => state.enterBatchEditing);
  const exitBatchEditing = useAppStore((state) => state.exitBatchEditing);
  const selectAllSelections = useAppStore((state) => state.selectAllSelections);
  const selectNoSelections = useAppStore((state) => state.selectNoSelections);
  const invertCheckedSelections = useAppStore((state) => state.invertCheckedSelections);
  const applyDepthToCheckedSelections = useAppStore((state) => state.applyDepthToCheckedSelections);
  const updateCheckedSelections = useAppStore((state) => state.updateCheckedSelections);
  const removeCheckedSelections = useAppStore((state) => state.removeCheckedSelections);
  const canUndo = useAppStore((state) => state.selectionHistoryPast.length > 0);
  const canRedo = useAppStore((state) => state.selectionHistoryFuture.length > 0);
  const isExporting = useAppStore((state) => state.isExporting);
  const isDetecting = useAppStore((state) => state.isDetecting);
  const isBatchExporting = useAppStore((state) => state.isBatchExporting);
  const hasModel = useAppStore((state) => Boolean(state.mesh));
  const exportArtifact = useAppStore((state) => state.exportArtifact);
  const batchExportArtifact = useAppStore((state) => state.batchExportArtifact);
  const [bulkDepth, setBulkDepth] = useState(defaultDepth);
  const checkedCount = checkedSelectionIds.length;
  const hasCheckedSelections = checkedCount > 0;
  const totalSelections = items.reduce((sum, item) => sum + item.selections.length, 0);
  const reviewedCount = items.filter((item) => item.status === "reviewed" || item.status === "exported").length;

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

  const deleteCheckedSelections = () => {
    if (!hasCheckedSelections) {
      return;
    }
    const confirmed = window.confirm(
      `Delete ${checkedCount} checked ${checkedCount === 1 ? "fill" : "fills"}? You can undo this action.`,
    );
    if (confirmed) {
      removeCheckedSelections();
    }
  };

  return (
    <aside className="holes-panel">
      {items.length > 0 && (
        <section className="queue-section" aria-label="Batch queue">
          <div className="queue-header">
            <div>
              <h2>Batch</h2>
              <p>{items.length === 1 ? "1 file" : `${items.length} files`} / {reviewedCount} reviewed</p>
            </div>
            {profile && <span className="profile-pill">{profile.summary}</span>}
          </div>
          <div className="queue-list">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === activeItemId ? "queue-item active" : "queue-item"}
                onClick={() => setActiveItem(item.id)}
              >
                <span className="queue-file-name">{item.fileName}</span>
                <span className={`queue-status status-${item.status}`}>
                  {item.status}
                  {item.selections.length > 0 ? ` / ${item.selections.length}` : ""}
                </span>
              </button>
            ))}
          </div>
          <div className="profile-actions">
            <button
              className="bulk-action-button"
              disabled={totalSelections === 0}
              onClick={buildProfileFromSelections}
            >
              <Wand2 size={16} />
              <span>Build profile</span>
            </button>
            <button
              className="bulk-action-button"
              disabled={!profile || isDetecting}
              onClick={() => void runBatchDetection()}
            >
              <CopyPlus size={16} />
              <span>{isDetecting ? "Detecting..." : "Run batch"}</span>
            </button>
            <button
              className="bulk-action-button"
              disabled={selections.length === 0}
              onClick={markActiveItemReviewed}
            >
              <CheckCircle2 size={16} />
              <span>Mark reviewed</span>
            </button>
          </div>
        </section>
      )}

      {isBatchEditing ? (
        <div className="batch-title">
          <div className="batch-title-row">
            <div>
              <h2>{checkedCount} checked</h2>
              <p>Batch edit fills</p>
            </div>
            <button className="icon-button small" title="Done batch editing" onClick={exitBatchEditing}>
              <X size={16} />
            </button>
          </div>
          <div className="batch-toolbar" aria-label="Batch fill tools">
            <div className="batch-helper-row" aria-label="Selection helpers">
              <button type="button" onClick={selectAllSelections}>All</button>
              <button type="button" onClick={selectNoSelections}>None</button>
              <button type="button" onClick={invertCheckedSelections}>Invert</button>
            </div>
            <div className="batch-depth-action">
              <DepthControl value={bulkDepth} onChange={setBulkDepth} compact />
              <button
                className="compact-action-button"
                disabled={!hasCheckedSelections}
                onClick={() => applyDepthToCheckedSelections(bulkDepth)}
              >
                Apply
              </button>
            </div>
            <div className="batch-icon-actions" aria-label="Batch actions">
              <button
                className="icon-button small"
                title="Undo selection change"
                aria-label="Undo selection change"
                disabled={!canUndo}
                onClick={undoSelectionChange}
              >
                <RotateCcw size={16} />
              </button>
              <button
                className="icon-button small"
                title="Redo selection change"
                aria-label="Redo selection change"
                disabled={!canRedo}
                onClick={redoSelectionChange}
              >
                <RotateCw size={16} />
              </button>
              <button
                className="icon-button small"
                title="Show checked fills"
                disabled={!hasCheckedSelections}
                onClick={() => updateCheckedSelections({ visible: true })}
              >
                <Eye size={16} />
              </button>
              <button
                className="icon-button small"
                title="Hide checked fills"
                disabled={!hasCheckedSelections}
                onClick={() => updateCheckedSelections({ visible: false })}
              >
                <EyeOff size={16} />
              </button>
              <button
                className="icon-button small danger"
                title="Delete checked fills"
                disabled={!hasCheckedSelections}
                onClick={deleteCheckedSelections}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="panel-title">
          <div>
            <h2>Fills</h2>
            <p>{selections.length === 0 ? "Click a recessed area to add it." : `${selections.length} selected`}</p>
          </div>
          {selections.length > 0 && (
            <button className="icon-button small" title="Batch edit fills" onClick={enterBatchEditing}>
              <CheckSquare size={16} />
            </button>
          )}
        </div>
      )}

      <div className="default-depth">
        <span>Default depth</span>
        <DepthControl value={defaultDepth} onChange={setDefaultDepth} />
      </div>

      {selections.length > 0 && !isBatchEditing && (
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
            <HoleRow
              key={selection.id}
              selection={selection}
              isBatchEditing={isBatchEditing}
              isChecked={checkedSelectionIds.includes(selection.id)}
            />
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
      {items.length > 1 && (
        <>
          <button
            className="export-button secondary"
            disabled={reviewedCount === 0 || isBatchExporting}
            onClick={() => void exportAllToZip()}
          >
            <FileArchive size={18} />
            <span>{isBatchExporting ? "Building ZIP..." : "Export reviewed ZIP"}</span>
          </button>
          {batchExportArtifact && (
            <a className="download-link" href={batchExportArtifact.url} download={batchExportArtifact.fileName}>
              <Download size={16} />
              <span>
                Download {batchExportArtifact.fileName} ({formatBytes(batchExportArtifact.byteLength)})
              </span>
            </a>
          )}
        </>
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
