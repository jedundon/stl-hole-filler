import { useRef, useCallback, useEffect } from 'react'
import { ThreeEvent } from '@react-three/fiber'
import { Mesh, BufferGeometry, MeshStandardMaterial } from 'three'
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh'
import { useStore } from '../store/useStore'
import { detectRecess } from '../geometry/recess/detect'
import { extractBoundaryLoops } from '../geometry/recess/boundary'
import { fitOpeningPlane, computeRecessDepth } from '../geometry/recess/plane'
import { classifyLoops } from '../geometry/recess/classify'
import { extrudeFillFrom3D, loopToFloat32 } from '../geometry/fill/extrude'

// Patch prototype once for BVH acceleration
BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree
Mesh.prototype.raycast = acceleratedRaycast

export function ModelMesh() {
  const meshRef = useRef<Mesh>(null)
  const threeGeometry = useStore(s => s.threeGeometry)
  const rawGeometry = useStore(s => s.rawGeometry)
  const addSelection = useStore(s => s.addSelection)
  const phase = useStore(s => s.phase)

  // Build BVH when geometry loads
  useEffect(() => {
    if (!threeGeometry) return
    threeGeometry.computeBoundsTree()
    return () => { threeGeometry.disposeBoundsTree() }
  }, [threeGeometry])

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (!rawGeometry || e.faceIndex == null) return

    const faceIdx = e.faceIndex
    const faceIndices = detectRecess(faceIdx, rawGeometry)
    if (!faceIndices) return

    const loops = extractBoundaryLoops(faceIndices, rawGeometry)
    if (loops.length === 0) return

    const allBoundaryVerts = loops.flat()
    const plane = fitOpeningPlane(faceIndices, allBoundaryVerts, rawGeometry)
    const classified = classifyLoops(loops, plane, faceIndices, rawGeometry)
    if (!classified) return

    const depth = computeRecessDepth(faceIndices, plane, rawGeometry)

    const outerPts = loopToFloat32(classified.outer, rawGeometry.positions)
    const innerPts = classified.inner.map(loop => loopToFloat32(loop, rawGeometry.positions))
    const fillGeometry = extrudeFillFrom3D(outerPts, innerPts, plane, depth + 0.2)

    addSelection({
      faceIndices,
      loops: classified,
      plane,
      depth,
      visible: true,
      fillGeometry,
    })
  }, [rawGeometry, addSelection])

  if (!threeGeometry || phase !== 'loaded') return null

  return (
    <mesh
      ref={meshRef}
      geometry={threeGeometry}
      onClick={handleClick}
    >
      <meshStandardMaterial color="#94a3b8" roughness={0.6} metalness={0.1} />
    </mesh>
  )
}
