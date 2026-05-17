import { useMemo } from 'react'
import { BufferGeometry, BufferAttribute, Float32BufferAttribute } from 'three'
import { useStore } from '../store/useStore'

/**
 * Renders each selection's floor faces as a translucent colored overlay
 * drawn slightly above the surface to avoid z-fighting.
 */
export function SelectionOverlay() {
  const selections = useStore(s => s.selections)
  const rawGeometry = useStore(s => s.rawGeometry)

  if (!rawGeometry) return null

  return (
    <>
      {selections.filter(s => s.visible).map(sel => (
        <FloorOverlay key={sel.id} sel={sel} positions={rawGeometry.positions} indices={rawGeometry.indices} />
      ))}
    </>
  )
}

function FloorOverlay({
  sel,
  positions,
  indices,
}: {
  sel: ReturnType<typeof useStore.getState>['selections'][number]
  positions: Float32Array
  indices: Uint32Array
}) {
  const geo = useMemo(() => {
    const g = new BufferGeometry()
    const verts: number[] = []
    // Normal direction for nudging — use the plane normal
    const nx = sel.plane.normal.x * 0.002
    const ny = sel.plane.normal.y * 0.002
    const nz = sel.plane.normal.z * 0.002
    for (const fi of sel.faceIndices) {
      for (let v = 0; v < 3; v++) {
        const vi = indices[fi*3+v]
        verts.push(
          positions[vi*3] + nx,
          positions[vi*3+1] + ny,
          positions[vi*3+2] + nz,
        )
      }
    }
    g.setAttribute('position', new Float32BufferAttribute(verts, 3))
    g.computeVertexNormals()
    return g
  }, [sel.faceIndices, sel.plane.normal, positions, indices])

  return (
    <mesh geometry={geo}>
      <meshBasicMaterial color={sel.color} transparent opacity={0.35} depthWrite={false} />
    </mesh>
  )
}
