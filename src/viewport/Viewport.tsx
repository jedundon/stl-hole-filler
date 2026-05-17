import { Bounds, GizmoHelper, GizmoViewport, OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Focus, Home, RotateCcw, RotateCw } from "lucide-react";
import { Suspense, useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { Color, MOUSE, PerspectiveCamera, Quaternion, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useAppStore } from "../state/store";
import type { MeshData } from "../types";
import { FillPreview } from "./FillPreview";
import { ModelMesh } from "./ModelMesh";

interface ViewActions {
  frame: () => void;
  reset: () => void;
  rotateLeft: () => void;
  rotateRight: () => void;
}

const DEFAULT_CAMERA_POSITION = new Vector3(90, 90, 70);
const DEFAULT_CAMERA_UP = new Vector3(0, 1, 0);
const CAMERA_TARGET = new Vector3(0, 0, 0);

export function Viewport() {
  const mesh = useAppStore((state) => state.mesh);
  const selections = useAppStore((state) => state.selections);
  const actionsRef = useRef<ViewActions | null>(null);
  const hasModel = Boolean(mesh);

  const frameModel = useCallback(() => actionsRef.current?.frame(), []);
  const resetView = useCallback(() => actionsRef.current?.reset(), []);
  const rotateLeft = useCallback(() => actionsRef.current?.rotateLeft(), []);
  const rotateRight = useCallback(() => actionsRef.current?.rotateRight(), []);

  useEffect(() => {
    if (!hasModel) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isEditableElement(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "q") {
        event.preventDefault();
        rotateLeft();
      } else if (key === "e") {
        event.preventDefault();
        rotateRight();
      } else if (key === "f") {
        event.preventDefault();
        frameModel();
      } else if (key === "r") {
        event.preventDefault();
        resetView();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [frameModel, hasModel, resetView, rotateLeft, rotateRight]);

  return (
    <>
      <Canvas
        className="viewport"
        camera={{ position: [90, 90, 70], fov: 45, near: 0.1, far: 10000 }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
        onCreated={({ scene }) => {
          scene.background = new Color("#f6f7f8");
        }}
        onDoubleClick={() => frameModel()}
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
                    <FillPreview key={selection.id} selection={selection} />
                  ) : null,
                )}
              </group>
            </Bounds>
          )}
        </Suspense>
        <CameraControlsBridge mesh={mesh} actionsRef={actionsRef} />
        <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
          <GizmoViewport axisColors={["#d14b45", "#2f9f60", "#3b74d8"]} labelColor="#111827" />
        </GizmoHelper>
      </Canvas>
      {hasModel && (
        <div className="viewport-toolbar" aria-label="View controls">
          <button
            className="viewport-tool-button"
            type="button"
            title="Rotate view left 90 degrees"
            aria-label="Rotate view left 90 degrees"
            onClick={rotateLeft}
          >
            <RotateCcw size={16} />
          </button>
          <button
            className="viewport-tool-button"
            type="button"
            title="Rotate view right 90 degrees"
            aria-label="Rotate view right 90 degrees"
            onClick={rotateRight}
          >
            <RotateCw size={16} />
          </button>
          <button
            className="viewport-tool-button"
            type="button"
            title="Frame model"
            aria-label="Frame model"
            onClick={frameModel}
          >
            <Focus size={16} />
          </button>
          <button
            className="viewport-tool-button"
            type="button"
            title="Reset view"
            aria-label="Reset view"
            onClick={resetView}
          >
            <Home size={16} />
          </button>
        </div>
      )}
    </>
  );
}

function CameraControlsBridge({
  mesh,
  actionsRef,
}: {
  mesh: MeshData | null;
  actionsRef: MutableRefObject<ViewActions | null>;
}) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();

  useEffect(() => {
    if (!mesh) {
      actionsRef.current = null;
      return undefined;
    }

    const controls = controlsRef.current;
    const perspectiveCamera = camera as PerspectiveCamera;
    const viewportAspect = size.width / Math.max(size.height, 1);

    const frame = () => {
      if (!controls) {
        return;
      }
      const direction = perspectiveCamera.position.clone().sub(controls.target);
      if (direction.lengthSq() === 0) {
        direction.copy(DEFAULT_CAMERA_POSITION);
      }
      applyFramedView(
        perspectiveCamera,
        controls,
        mesh,
        direction.normalize(),
        perspectiveCamera.up,
        viewportAspect,
      );
    };

    const reset = () => {
      if (!controls) {
        return;
      }
      applyFramedView(
        perspectiveCamera,
        controls,
        mesh,
        DEFAULT_CAMERA_POSITION.clone().normalize(),
        DEFAULT_CAMERA_UP,
        viewportAspect,
      );
    };

    const rotate = (angle: number) => {
      if (!controls) {
        return;
      }
      const viewDirection = controls.target.clone().sub(perspectiveCamera.position).normalize();
      if (viewDirection.lengthSq() === 0) {
        return;
      }
      const rotation = new Quaternion().setFromAxisAngle(viewDirection, angle);
      perspectiveCamera.up.applyQuaternion(rotation).normalize();
      perspectiveCamera.lookAt(controls.target);
      controls.update();
    };

    actionsRef.current = {
      frame,
      reset,
      rotateLeft: () => rotate(Math.PI / 2),
      rotateRight: () => rotate(-Math.PI / 2),
    };

    return () => {
      actionsRef.current = null;
    };
  }, [actionsRef, camera, mesh, size.height, size.width]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      mouseButtons={{ LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.PAN }}
    />
  );
}

function applyFramedView(
  camera: PerspectiveCamera,
  controls: OrbitControlsImpl,
  mesh: MeshData,
  direction: Vector3,
  up: Vector3,
  viewportAspect: number,
) {
  const radius = Math.hypot(...mesh.bounds.size) * 0.5 || 1;
  const verticalFov = (camera.fov * Math.PI) / 180;
  const horizontalFov =
    2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(viewportAspect, 0.1));
  const distance =
    Math.max(radius / Math.sin(verticalFov / 2), radius / Math.sin(horizontalFov / 2)) * 1.25;
  const target = CAMERA_TARGET.clone();

  controls.target.copy(target);
  camera.position.copy(target).add(direction.multiplyScalar(distance));
  camera.up.copy(up).normalize();
  camera.near = Math.max(distance / 1000, 0.01);
  camera.far = Math.max(distance * 1000, 10000);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  controls.update();
}

function isEditableElement(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    target.matches("input, textarea, select, [contenteditable='true']")
  );
}
