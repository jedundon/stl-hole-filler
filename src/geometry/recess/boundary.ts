import type { NormalizedGeometry } from '../../types'

/**
 * Extract all closed boundary loops from a set of face indices.
 * A boundary edge is one used by exactly one face within the set.
 * Returns an array of vertex-index cycles (one per loop).
 */
export function extractBoundaryLoops(
  faceIndices: number[],
  geo: NormalizedGeometry,
): number[][] {
  const { indices } = geo
  const faceSet = new Set(faceIndices)

  // Collect boundary half-edges: (from, to) where the face is in the set
  // but the adjacent face is not.
  const halfEdgeNext = new Map<number, number>() // from → to

  for (const face of faceSet) {
    for (let e = 0; e < 3; e++) {
      const va = indices[face*3 + e]
      const vb = indices[face*3 + ((e+1)%3)]
      // Check if this directed edge's reverse (vb→va) belongs to a face NOT in the set
      // (i.e., this is a boundary half-edge of the face set)
      // A boundary edge: the face across it is outside or nonexistent
      // We detect this by checking: does any face in faceSet share edge (vb→va)?
      halfEdgeNext.set(va, vb) // tentative; may be overwritten if interior
    }
  }

  // Remove interior half-edges: if both (va→vb) and (vb→va) are in halfEdgeNext
  // and their respective faces are both in faceSet, it's interior.
  // Simpler: rebuild by checking adjacency directly.
  halfEdgeNext.clear()
  for (const face of faceSet) {
    for (let e = 0; e < 3; e++) {
      const va = indices[face*3 + e]
      const vb = indices[face*3 + ((e+1)%3)]
      // Find the face on the other side of this edge
      let neighborInSet = false
      // Check all faces sharing this edge via edgeToFaces
      const ek = va < vb ? `${va}_${vb}` : `${vb}_${va}`
      const pair = geo.edgeToFaces.get(ek)
      if (pair) {
        const other = pair[0] === face ? pair[1] : pair[0]
        if (other !== -1 && faceSet.has(other)) neighborInSet = true
      }
      if (!neighborInSet) {
        // Boundary half-edge: va→vb belongs to the face set; the other side doesn't.
        halfEdgeNext.set(va, vb)
      }
    }
  }

  // Walk all cycles
  const loops: number[][] = []
  const used = new Set<number>()

  for (const startV of halfEdgeNext.keys()) {
    if (used.has(startV)) continue
    const loop: number[] = []
    let cur = startV
    for (let safety = 0; safety < 100_000; safety++) {
      if (used.has(cur)) break
      used.add(cur)
      loop.push(cur)
      const next = halfEdgeNext.get(cur)
      if (next === undefined || next === startV) break
      cur = next
    }
    if (loop.length >= 3) loops.push(loop)
  }

  return loops
}
