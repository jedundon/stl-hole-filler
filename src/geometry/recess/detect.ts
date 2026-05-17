import type { NormalizedGeometry } from '../../types'

const NORMAL_DOT_THRESHOLD = Math.cos((15 * Math.PI) / 180)  // 15° tolerance
const WALL_DIHEDRAL_THRESHOLD = Math.cos((60 * Math.PI) / 180) // stop BFS when angle > 60°
const MAX_FACES = 50_000

/**
 * Flood-fill from a clicked face index to find all coplanar faces that form
 * a recessed region. Returns the set of face indices, or null if the seed face
 * has no distinct recess neighbours.
 */
export function detectRecess(
  seedFaceIdx: number,
  geo: NormalizedGeometry,
): number[] | null {
  const { faceNormals, adjacency } = geo
  const triCount = faceNormals.length / 3

  const snx = faceNormals[seedFaceIdx*3]
  const sny = faceNormals[seedFaceIdx*3+1]
  const snz = faceNormals[seedFaceIdx*3+2]

  const visited = new Uint8Array(triCount)
  const queue: number[] = [seedFaceIdx]
  visited[seedFaceIdx] = 1
  const result: number[] = []

  while (queue.length > 0 && result.length < MAX_FACES) {
    const face = queue.pop()!
    result.push(face)

    for (let e = 0; e < 3; e++) {
      const neighbor = adjacency[face*3 + e]
      if (neighbor === -1 || visited[neighbor]) continue

      const nnx = faceNormals[neighbor*3]
      const nny = faceNormals[neighbor*3+1]
      const nnz = faceNormals[neighbor*3+2]

      // Dihedral between current face and neighbor (dot of their normals)
      const dot = snx*nnx + sny*nny + snz*nnz
      if (dot < WALL_DIHEDRAL_THRESHOLD) continue  // wall — stop here

      // Normal similarity to seed face
      const seedDot = snx*nnx + sny*nny + snz*nnz
      if (seedDot < NORMAL_DOT_THRESHOLD) continue

      visited[neighbor] = 1
      queue.push(neighbor)
    }
  }

  return result.length > 0 ? result : null
}
