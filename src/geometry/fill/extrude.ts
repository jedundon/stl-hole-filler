import { BufferGeometry, BufferAttribute, Vector3 } from 'three'
import earcut from 'earcut'
import type { BoundaryLoops, OpeningPlane } from '../../types'

/**
 * Build a watertight fill prism for a recess selection.
 * Top cap = flush with opening plane (outer surface level).
 * Bottom cap = translated inward by depth.
 * Side walls close all loops, inner loops included.
 */
export function extrudeFill(
  loops: BoundaryLoops,
  plane: OpeningPlane,
  depth: number,
): BufferGeometry {
  const { origin, normal } = plane
  const { outer, inner } = loops

  // Build 2D projection axes
  const tangent = new Vector3()
  const bitangent = new Vector3()
  const ref = Math.abs(normal.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0)
  tangent.crossVectors(normal, ref).normalize()
  bitangent.crossVectors(normal, tangent).normalize()

  // All loops: outer first, then inner
  const allLoops = [outer, ...inner]

  // Build flat 2D array for earcut + hole indices
  const flatCoords: number[] = []
  const holeIndices: number[] = []

  for (let li = 0; li < allLoops.length; li++) {
    if (li > 0) holeIndices.push(flatCoords.length / 2)
    for (const vi of allLoops[li]) {
      flatCoords.push(vi) // placeholder — we store vertex indices first, convert below
    }
  }

  // Convert vertex indices to 3D positions (will be provided as indices into geo.positions)
  // Since we're building from already-projected loops, we receive 3D vertex index arrays.
  // We need 3D coords. Store them separately.
  // NOTE: `vi` here are actual 3D vertex positions packed into the loop arrays.
  // The caller stores THREE.Vector3-like packed vertex index arrays.
  // We'll re-derive 2D here from the 3D loop vertex positions that the caller packed.

  // The loops contain raw 3D coords packed as [x,y,z, x,y,z, ...] per loop.
  // Let's redefine: loops.outer and loops.inner are number[][] of vertex indices into geo.positions.
  // But we don't have geo here. Instead, the caller should pre-project.
  // Refactored: accept pre-projected 2D loops.
  throw new Error('Use extrudeFillFrom3D instead')
}

/**
 * Build a watertight fill prism given 3D vertex coordinate arrays per loop.
 * outerPts and innerPts: each is an array of [x, y, z] triplets.
 */
export function extrudeFillFrom3D(
  outerPts: Float32Array,   // 3 floats per vertex, CCW in opening plane
  innerPts: Float32Array[], // 3 floats per vertex each, CW in opening plane
  plane: OpeningPlane,
  depth: number,
): BufferGeometry {
  const { normal } = plane
  const inward = normal.clone().multiplyScalar(-depth)

  const allPts = [outerPts, ...innerPts]

  // Project to 2D for earcut
  const ref = Math.abs(normal.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0)
  const tangent = new Vector3().crossVectors(normal, ref).normalize()
  const bitangent = new Vector3().crossVectors(normal, tangent).normalize()

  const flat2d: number[] = []
  const holeIndices: number[] = []

  for (let li = 0; li < allPts.length; li++) {
    if (li > 0) holeIndices.push(flat2d.length / 2)
    const pts = allPts[li]
    for (let i = 0; i < pts.length; i += 3) {
      flat2d.push(pts[i]*tangent.x + pts[i+1]*tangent.y + pts[i+2]*tangent.z)
      flat2d.push(pts[i]*bitangent.x + pts[i+1]*bitangent.y + pts[i+2]*bitangent.z)
    }
  }

  const capTriangles = earcut(flat2d, holeIndices.length > 0 ? holeIndices : undefined, 2)

  // Vertex counts per loop
  const loopVertCount = allPts.map(p => p.length / 3)
  const totalVerts = loopVertCount.reduce((a, b) => a + b, 0)

  // We'll build: top ring (totalVerts), bottom ring (totalVerts), then triangles
  const positions: number[] = []

  // Top ring vertices (original positions)
  for (const pts of allPts) {
    for (let i = 0; i < pts.length; i += 3) {
      positions.push(pts[i], pts[i+1], pts[i+2])
    }
  }
  // Bottom ring = top shifted inward
  for (const pts of allPts) {
    for (let i = 0; i < pts.length; i += 3) {
      positions.push(pts[i] + inward.x, pts[i+1] + inward.y, pts[i+2] + inward.z)
    }
  }

  const triPositions: number[] = []

  const addTri = (a: number, b: number, c: number) => {
    for (const idx of [a, b, c]) {
      triPositions.push(positions[idx*3], positions[idx*3+1], positions[idx*3+2])
    }
  }

  // Top cap (earcut indices are into the flat ring order, offset from 0)
  for (let i = 0; i < capTriangles.length; i += 3) {
    addTri(capTriangles[i], capTriangles[i+1], capTriangles[i+2])
  }

  // Bottom cap (flipped winding)
  for (let i = 0; i < capTriangles.length; i += 3) {
    addTri(
      capTriangles[i+2] + totalVerts,
      capTriangles[i+1] + totalVerts,
      capTriangles[i+0] + totalVerts,
    )
  }

  // Side walls for each loop
  let loopOffset = 0
  for (let li = 0; li < allPts.length; li++) {
    const n = loopVertCount[li]
    const isInner = li > 0
    for (let i = 0; i < n; i++) {
      const t0 = loopOffset + i
      const t1 = loopOffset + (i + 1) % n
      const b0 = t0 + totalVerts
      const b1 = t1 + totalVerts
      if (isInner) {
        // Reversed winding for inner walls
        addTri(t0, b0, t1)
        addTri(t1, b0, b1)
      } else {
        addTri(t0, t1, b0)
        addTri(t1, b1, b0)
      }
    }
    loopOffset += n
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(triPositions), 3))
  geo.computeVertexNormals()
  return geo
}

/**
 * Convert loop vertex indices into packed Float32Array of 3D coords.
 */
export function loopToFloat32(vertexIndices: number[], positions: Float32Array): Float32Array {
  const out = new Float32Array(vertexIndices.length * 3)
  for (let i = 0; i < vertexIndices.length; i++) {
    const vi = vertexIndices[i]
    out[i*3] = positions[vi*3]
    out[i*3+1] = positions[vi*3+1]
    out[i*3+2] = positions[vi*3+2]
  }
  return out
}
