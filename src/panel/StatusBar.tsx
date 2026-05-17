import { useAppStore } from "../state/store";

export function StatusBar() {
  const mesh = useAppStore((state) => state.mesh);
  const selections = useAppStore((state) => state.selections);

  return (
    <footer className="status-bar">
      <span>{mesh ? `${new Intl.NumberFormat().format(mesh.triangleCount)} triangles` : "Ready"}</span>
      <span>{selections.length > 0 ? `${selections.length} fill parts` : "Click inside a recessed area to fill it."}</span>
    </footer>
  );
}
