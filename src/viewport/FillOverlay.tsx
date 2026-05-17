import { useMemo } from "react";
import { BufferAttribute, BufferGeometry } from "three";
import type { Selection } from "../types";
import { useAppStore } from "../state/store";

interface FillOverlayProps {
  selection: Selection;
}

export function FillOverlay({ selection }: FillOverlayProps) {
  const mesh = useAppStore((state) => state.mesh);

  const geometry = useMemo(() => {
    if (!mesh) {
      return null;
    }
    const vertices: number[] = [];
    const indices: number[] = [];
    selection.faceIndices.forEach((face) => {
      const start = vertices.length / 3;
      for (let corner = 0; corner < 3; corner += 1) {
        const vertexIndex = mesh.indices[face * 3 + corner];
        vertices.push(
          mesh.positions[vertexIndex * 3],
          mesh.positions[vertexIndex * 3 + 1],
          mesh.positions[vertexIndex * 3 + 2],
        );
      }
      indices.push(start, start + 1, start + 2);
    });
    const overlay = new BufferGeometry();
    overlay.setAttribute("position", new BufferAttribute(new Float32Array(vertices), 3));
    overlay.setIndex(indices);
    overlay.computeVertexNormals();
    return overlay;
  }, [mesh, selection]);

  if (!geometry) {
    return null;
  }

  return (
    <mesh geometry={geometry} renderOrder={2}>
      <meshBasicMaterial
        color={selection.color}
        transparent
        opacity={0.58}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-3}
        polygonOffsetUnits={-3}
      />
    </mesh>
  );
}
