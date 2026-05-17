import { useEffect, useRef } from "react";
import { Mesh } from "three";
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from "three-mesh-bvh";
import { useAppStore } from "../state/store";

Mesh.prototype.raycast = acceleratedRaycast;

export function ModelMesh() {
  const mesh = useAppStore((state) => state.mesh);
  const addSelectionFromFace = useAppStore((state) => state.addSelectionFromFace);
  const setHoverFaceIndex = useAppStore((state) => state.setHoverFaceIndex);
  const ref = useRef<Mesh>(null);

  useEffect(() => {
    if (!mesh) {
      return undefined;
    }
    mesh.geometry.computeBoundsTree = computeBoundsTree;
    mesh.geometry.disposeBoundsTree = disposeBoundsTree;
    mesh.geometry.computeBoundsTree({ indirect: true } as Parameters<typeof computeBoundsTree>[0]);
    return () => {
      mesh.geometry.disposeBoundsTree?.();
    };
  }, [mesh]);

  if (!mesh) {
    return null;
  }

  return (
    <mesh
      ref={ref}
      geometry={mesh.geometry}
      onPointerMove={(event) => {
        event.stopPropagation();
        setHoverFaceIndex(typeof event.faceIndex === "number" ? event.faceIndex : null);
      }}
      onPointerLeave={() => setHoverFaceIndex(null)}
      onClick={(event) => {
        event.stopPropagation();
        if (typeof event.faceIndex === "number" && ref.current) {
          const localPoint = ref.current.worldToLocal(event.point.clone());
          addSelectionFromFace(event.faceIndex, [localPoint.x, localPoint.y, localPoint.z]);
        }
      }}
    >
      <meshStandardMaterial color="#c8cfd7" flatShading metalness={0.03} roughness={0.82} />
    </mesh>
  );
}
