import { Canvas } from '@react-three/fiber'
import { OrbitControls, Center, Environment } from '@react-three/drei'
import { ModelMesh } from './ModelMesh'
import { SelectionOverlay } from './SelectionOverlay'
import { FillPreview } from './FillPreview'
import { useStore } from '../store/useStore'

export function Viewport() {
  const phase = useStore(s => s.phase)

  return (
    <div className="flex-1 relative bg-slate-900">
      <Canvas
        camera={{ position: [0, 0, 150], fov: 45, near: 0.1, far: 10000 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#0f172a']} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[50, 100, 75]} intensity={1.2} castShadow={false} />
        <directionalLight position={[-50, -30, -50]} intensity={0.3} />

        <Center>
          <ModelMesh />
          <SelectionOverlay />
          <FillPreview />
        </Center>

        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
        <Environment preset="city" />
      </Canvas>

      {phase === 'idle' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-slate-500 text-sm">Drop an STL file to begin</p>
        </div>
      )}
    </div>
  )
}
