import { FolderOpen, RotateCcw } from "lucide-react";
import { useRef } from "react";
import { useAppStore } from "../state/store";

export function Header() {
  const inputRef = useRef<HTMLInputElement>(null);
  const fileName = useAppStore((state) => state.fileName);
  const itemCount = useAppStore((state) => state.items.length);
  const reset = useAppStore((state) => state.reset);
  const loadFiles = useAppStore((state) => state.loadFiles);
  const hasItems = useAppStore((state) => state.items.length > 0);

  return (
    <header className="header">
      <div className="brand">
        <div className="brand-mark">SF</div>
        <div>
          <h1>STL Hole Filler</h1>
          <p>{fileName ? `${fileName}${itemCount > 1 ? ` + ${itemCount - 1} more` : ""}` : "No model loaded"}</p>
        </div>
      </div>
      <div className="header-actions">
        <button className="icon-button" title="Open STL" onClick={() => inputRef.current?.click()}>
          <FolderOpen size={18} />
        </button>
        <button
          className="icon-button"
          title="New"
          disabled={!hasItems}
          onClick={() => {
            if (!hasItems || window.confirm("Start over? You'll lose your current batch and selections.")) {
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
        multiple
        onChange={(event) => {
          if (event.target.files?.length) {
            void loadFiles(event.target.files);
          }
          event.currentTarget.value = "";
        }}
      />
    </header>
  );
}
