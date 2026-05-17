import { useMemo } from "react";
import type { Selection } from "../types";
import { buildFillMesh, makeThreeFillGeometry } from "../geometry/fill/extrude";
import { useAppStore } from "../state/store";

interface FillSolidProps {
  selection: Selection;
}

export function FillSolid({ selection }: FillSolidProps) {
  const mesh = useAppStore((state) => state.mesh);
  const geometry = useMemo(() => {
    if (!mesh) {
      return null;
    }
    return makeThreeFillGeometry(buildFillMesh(mesh, selection));
  }, [mesh, selection]);

  if (!geometry) {
    return null;
  }

  return (
    <mesh geometry={geometry} renderOrder={1}>
      <meshStandardMaterial color={selection.color} transparent opacity={0.28} roughness={0.55} depthWrite={false} />
    </mesh>
  );
}
