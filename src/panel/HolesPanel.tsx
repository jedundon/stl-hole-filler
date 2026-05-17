import { CopyPlus, Download, SlidersHorizontal } from "lucide-react";
import { useAppStore } from "../state/store";
import { DepthControl } from "./DepthControl";
import { HoleRow } from "./HoleRow";

export function HolesPanel() {
  const selections = useAppStore((state) => state.selections);
  const defaultDepth = useAppStore((state) => state.defaultDepth);
  const setDefaultDepth = useAppStore((state) => state.setDefaultDepth);
  const exportToFile = useAppStore((state) => state.exportToFile);
  const addSimilarSelectionsOnPlane = useAppStore((state) => state.addSimilarSelectionsOnPlane);
  const isExporting = useAppStore((state) => state.isExporting);
  const hasModel = useAppStore((state) => Boolean(state.mesh));
  const exportArtifact = useAppStore((state) => state.exportArtifact);

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

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
