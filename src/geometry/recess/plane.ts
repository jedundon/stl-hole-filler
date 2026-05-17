import { Vector3 } from 'three'
import type { NormalizedGeometry, OpeningPlane } from '../../types'

/**
 * Fit the opening plane for a recess.
 * Normal = area-weighted average of faces OUTSIDE the set adjacent to the boundary.
 * Origin = centroid of all boundary vertices.
 */
export function fitOpeningPlane(
  faceIndices: number[],
  boundaryVertices: number[],
  geo: NormalizedGeometry,
): OpeningPlane {
  const { positions, faceNormals, adjacency, indices } = geo
  const faceSet = new Set(faceIndices)

  // Gather outward-facing neighbor normals (area-weighted)
  const normal = new Vector3()
  for (const face of faceSet) {
    for (let e = 0; e < 3; e++) {
      const nb = adjacency[face*3 + e]
      if (nb === -1 || faceSet.has(nb)) continue
      const nx = faceNormals[nb*3], ny = faceNormals[nb*3+1], nz = faceNormals[nb*3+2]
      // Weight by 1 (all face normals are already unit, area implicit from count)
      normal.x += nx; normal.y += ny; normal.z += nz
    }
  }

  if (normal.lengthSq() < 1e-10) {
    // Fallback: use seed face normal
    const f = faceIndices[0]
    normal.set(faceNormals[f*3], faceNormals[f*3+1], faceNormals[f*3+2])
  }
  normal.normalize()

  // Centroid of boundary vertices projected to their mean position
  const origin = new Vector3()
  for (const vi of boundaryVertices) {
    origin.x += positions[vi*3]
    origin.y += positions[vi*3+1]
    origin.z += positions[vi*3+2]
  }
  if (boundaryVertices.length > 0) origin.divideScalar(boundaryVertices.length)

  // Project origin onto the plane defined by the max-dot boundary vertex
  // (the vertex furthest in the normal direction — this puts the plane at the outer surface)
  let maxDot = -Infinity
  for (const vi of boundaryVertices) {
    const d = positions[vi*3]*normal.x + positions[vi*3+1]*normal.y + positions[vi*3+2]*normal.z
    if (d > maxDot) maxDot = d
  }

  // Snap origin to the outermost boundary vertex plane
  const curDot = origin.dot(normal)
  origin.addScaledVector(normal, maxDot - curDot)

  // Also compute recess depth: max distance from opening plane inward among floor faces
  let minDot = Infinity
  for (const face of faceIndices) {
    for (let v = 0; v < 3; v++) {
      const vi = indices[face*3+v]
      const d = positions[vi*3]*normal.x + positions[vi*3+1]*normal.y + positions[vi*3+2]*normal.z
      if (d < minDot) minDot = d
    }
  }

  return { origin, normal }
}

export function computeRecessDepth(
  faceIndices: number[],
  plane: OpeningPlane,
  geo: NormalizedGeometry,
): number {
  const { positions, indices } = geo
  const { origin, normal } = plane
  const originDot = origin.dot(normal)
  let minDot = Infinity
  for (const face of faceIndices) {
    for (let v = 0; v < 3; v++) {
      const vi = indices[face*3+v]
      const d = positions[vi*3]*normal.x + positions[vi*3+1]*normal.y + positions[vi*3+2]*normal.z
      if (d < minDot) minDot = d
    }
  }
  return Math.max(0.1, originDot - minDot)
}
