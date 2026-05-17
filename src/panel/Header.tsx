import { FolderOpen, RotateCcw } from "lucide-react";
import { useRef } from "react";
import { useAppStore } from "../state/store";

export function Header() {
  const inputRef = useRef<HTMLInputElement>(null);
  const fileName = useAppStore((state) => state.fileName);
  const reset = useAppStore((state) => state.reset);
  const loadFile = useAppStore((state) => state.loadFile);
  const hasModel = useAppStore((state) => Boolean(state.mesh));

  return (
    <header className="header">
      <div className="brand">
        <div className="brand-mark">SF</div>
        <div>
          <h1>STL Hole Filler</h1>
          <p>{fileName ?? "No model loaded"}</p>
        </div>
      </div>
      <div className="header-actions">
        <button className="icon-button" title="Open STL" onClick={() => inputRef.current?.click()}>
          <FolderOpen size={18} />
        </button>
        <button
          className="icon-button"
          title="New"
          disabled={!hasModel}
          onClick={() => {
            if (!hasModel || window.confirm("Start over? You'll lose your current selections.")) {
              reset();
            }
          }}
        >
          <RotateCcw size={18} />
        </button>
      </div>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept=".stl,model/stl"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void loadFile(file);
          }
          event.currentTarget.value = "";
        }}
      />
    </header>
  );
}
