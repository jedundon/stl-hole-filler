import { Vector3 } from 'three'
import type { BoundaryLoops, NormalizedGeometry, OpeningPlane } from '../../types'

const MIN_BOUNDARY_DIHEDRAL_COS = Math.cos((60 * Math.PI) / 180) // ~60° wall

/**
 * Classify extracted boundary loops into outer + inner (islands).
 * Also validates that the selection is actually a recess (not outer surface).
 * Returns null if the click was not on a real recess.
 */
export function classifyLoops(
  loops: number[][],
  plane: OpeningPlane,
  faceIndices: number[],
  geo: NormalizedGeometry,
): BoundaryLoops | null {
  if (loops.length === 0) return null

  const { positions, faceNormals, adjacency } = geo
  const { origin, normal } = plane

  // Build two orthogonal axes in the opening plane
  const tangent = new Vector3()
  const bitangent = new Vector3()
  const ref = Math.abs(normal.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0)
  tangent.crossVectors(normal, ref).normalize()
  bitangent.crossVectors(normal, tangent).normalize()

  // Project loop vertices to 2D
  const project = (vi: number): [number, number] => {
    const dx = positions[vi*3] - origin.x
    const dy = positions[vi*3+1] - origin.y
    const dz = positions[vi*3+2] - origin.z
    return [dx*tangent.x + dy*tangent.y + dz*tangent.z,
            dx*bitangent.x + dy*bitangent.y + dz*bitangent.z]
  }

  // Signed area of a 2D polygon
  const signedArea = (loop2d: [number, number][]) => {
    let area = 0
    for (let i = 0; i < loop2d.length; i++) {
      const [x0, y0] = loop2d[i]
      const [x1, y1] = loop2d[(i+1) % loop2d.length]
      area += x0 * y1 - x1 * y0
    }
    return area / 2
  }

  const loops2d = loops.map(loop => loop.map(vi => project(vi)))
  const areas = loops2d.map(signedArea)

  // Outer loop = largest absolute area
  let outerIdx = 0
  for (let i = 1; i < areas.length; i++) {
    if (Math.abs(areas[i]) > Math.abs(areas[outerIdx])) outerIdx = i
  }

  // Normalize winding: outer CCW (positive area), inner CW (negative area)
  const normalizeWinding = (loop: number[], area: number, wantPositive: boolean) => {
    const isPositive = area > 0
    if (isPositive !== wantPositive) return [...loop].reverse()
    return loop
  }

  const outerLoop = normalizeWinding(loops[outerIdx], areas[outerIdx], true)
  const innerLoops = loops
    .filter((_, i) => i !== outerIdx)
    .map((loop, i) => {
      const areaIdx = i < outerIdx ? i : i + 1
      return normalizeWinding(loop, areas[areaIdx] ?? -1, false)
    })

  // Validate: check that boundary edges have real walls (dihedral > threshold)
  const faceSet = new Set(faceIndices)
  let wallDotSum = 0
  let wallCount = 0
  for (const face of faceSet) {
    for (let e = 0; e < 3; e++) {
      const nb = adjacency[face*3 + e]
      if (nb === -1 || faceSet.has(nb)) continue
      const dot = faceNormals[face*3]*faceNormals[nb*3]
               + faceNormals[face*3+1]*faceNormals[nb*3+1]
               + faceNormals[face*3+2]*faceNormals[nb*3+2]
      wallDotSum += dot
      wallCount++
    }
  }

  if (wallCount === 0) return null
  const avgWallDot = wallDotSum / wallCount
  // If the average dot is very high, the "walls" are nearly coplanar → not a recess
  if (avgWallDot > MIN_BOUNDARY_DIHEDRAL_COS) return null

  return { outer: outerLoop, inner: innerLoops }
}
