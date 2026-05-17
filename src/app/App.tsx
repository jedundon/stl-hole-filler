import { useCallback } from "react";
import { Header } from "../panel/Header";
import { HolesPanel } from "../panel/HolesPanel";
import { StatusBar } from "../panel/StatusBar";
import { DropZone } from "../panel/DropZone";
import { Viewport } from "../viewport/Viewport";
import { useAppStore } from "../state/store";

export function App() {
  const mesh = useAppStore((state) => state.mesh);
  const isLoading = useAppStore((state) => state.isLoading);
  const warning = useAppStore((state) => state.warning);
  const toast = useAppStore((state) => state.toast);
  const loadFile = useAppStore((state) => state.loadFile);

  const handleDrop = useCallback(
    (files: FileList | File[]) => {
      const file = Array.from(files)[0];
      if (file) {
        void loadFile(file);
      }
    },
    [loadFile],
  );

  return (
    <div className="app" onDragOver={(event) => event.preventDefault()}>
      <Header />
      <main className="workspace">
        <section
          className="viewport-shell"
          onDrop={(event) => {
            event.preventDefault();
            handleDrop(event.dataTransfer.files);
          }}
        >
          <Viewport />
          {!mesh && <DropZone isLoading={isLoading} onFiles={handleDrop} />}
          {warning && <div className="warning-banner">{warning}</div>}
          {toast && <div className={`toast toast-${toast.tone ?? "info"}`}>{toast.message}</div>}
        </section>
        <HolesPanel />
      </main>
      <StatusBar />
    </div>
  );
}
