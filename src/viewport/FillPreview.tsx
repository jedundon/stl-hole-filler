import { useMemo } from "react";
import { BufferAttribute, BufferGeometry } from "three";
import type { FillMesh, Selection } from "../types";
import { buildFillMesh, makeThreeFillGeometry } from "../geometry/fill/extrude";
import { useAppStore } from "../state/store";

interface FillPreviewProps {
  selection: Selection;
}

const disabledRaycast = () => undefined;

export function FillPreview({ selection }: FillPreviewProps) {
  const mesh = useAppStore((state) => state.mesh);
  const preview = useMemo(() => {
    if (!mesh) {
      return null;
    }
    const fill = buildFillMesh(mesh, selection);
    return {
      fillGeometry: makeThreeFillGeometry(fill),
      outlineGeometry: makeFillOutlineGeometry(fill),
    };
  }, [mesh, selection]);

  if (!preview) {
    return null;
  }

  return (
    <group>
      <mesh geometry={preview.fillGeometry} renderOrder={2} raycast={disabledRaycast}>
        <meshStandardMaterial
          attach="material-0"
          color={selection.color}
          roughness={0.48}
          metalness={0.02}
          transparent
          opacity={0.94}
          polygonOffset
          polygonOffsetFactor={-4}
          polygonOffsetUnits={-4}
        />
        <meshStandardMaterial
          attach="material-1"
          color={selection.color}
          roughness={0.7}
          metalness={0.02}
          transparent
          opacity={0.16}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      <lineSegments geometry={preview.outlineGeometry} renderOrder={3} raycast={disabledRaycast}>
        <lineBasicMaterial color={selection.color} transparent opacity={0.96} depthTest={false} depthWrite={false} />
      </lineSegments>
    </group>
  );
}

function makeFillOutlineGeometry(fill: FillMesh) {
  const vertices: number[] = [];

  fill.topLoopRanges.forEach((range) => {
    for (let i = 0; i < range.count; i += 1) {
      const current = range.start + i;
      const next = range.start + ((i + 1) % range.count);
      pushVertex(vertices, fill.vertices, current);
      pushVertex(vertices, fill.vertices, next);
    }
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(vertices), 3));
  return geometry;
}

function pushVertex(target: number[], source: number[], vertexIndex: number) {
  const offset = vertexIndex * 3;
  target.push(source[offset], source[offset + 1], source[offset + 2]);
}
