import { useAppStore } from "../state/store";

export function StatusBar() {
  const mesh = useAppStore((state) => state.mesh);
  const selections = useAppStore((state) => state.selections);
  const items = useAppStore((state) => state.items);
  const activeItemId = useAppStore((state) => state.activeItemId);
  const activeItem = items.find((item) => item.id === activeItemId);

  return (
    <footer className="status-bar">
      <span>{mesh ? `${new Intl.NumberFormat().format(mesh.triangleCount)} triangles` : "Ready"}</span>
      <span>
        {activeItem
          ? `${activeItem.status} / ${selections.length} fill ${selections.length === 1 ? "part" : "parts"}`
          : "Click inside a recessed area to fill it."}
      </span>
    </footer>
  );
}
