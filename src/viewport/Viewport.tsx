import { Bounds, GizmoHelper, GizmoViewport, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { Color, MOUSE } from "three";
import { useAppStore } from "../state/store";
import { FillOverlay } from "./FillOverlay";
import { FillSolid } from "./FillSolid";
import { ModelMesh } from "./ModelMesh";

export function Viewport() {
  const mesh = useAppStore((state) => state.mesh);
  const selections = useAppStore((state) => state.selections);

  return (
    <Canvas
      className="viewport"
      camera={{ position: [90, 90, 70], fov: 45, near: 0.1, far: 10000 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
      onCreated={({ scene }) => {
        scene.background = new Color("#f6f7f8");
      }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[80, 120, 80]} intensity={2.4} />
      <directionalLight position={[-60, -80, 40]} intensity={0.5} />
      <Suspense fallback={null}>
        {mesh && (
          <Bounds fit clip observe margin={1.25}>
            <group position={[-mesh.bounds.center[0], -mesh.bounds.center[1], -mesh.bounds.center[2]]}>
              <ModelMesh />
              {selections.map((selection) =>
                selection.visible ? (
                  <group key={selection.id}>
                    <FillOverlay selection={selection} />
                    <FillSolid selection={selection} />
                  </group>
                ) : null,
              )}
            </group>
          </Bounds>
        )}
      </Suspense>
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        mouseButtons={{ LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.PAN }}
      />
      <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
        <GizmoViewport axisColors={["#d14b45", "#2f9f60", "#3b74d8"]} labelColor="#111827" />
      </GizmoHelper>
    </Canvas>
  );
}
