import type { NormalizedGeometry } from '../../types'

const EPSILON = 1e-6

/**
 * Weld coincident vertices, build an indexed mesh, precompute face normals,
 * and build the face-adjacency table needed for flood-fill.
 */
export function normalizeGeometry(rawPositions: Float32Array): NormalizedGeometry {
  const triCount = rawPositions.length / 9
  const positionList: number[] = []
  const indices = new Uint32Array(triCount * 3)
  const vertexMap = new Map<string, number>()

  const key = (x: number, y: number, z: number) =>
    `${x.toFixed(6)}_${y.toFixed(6)}_${z.toFixed(6)}`

  for (let t = 0; t < triCount; t++) {
    for (let v = 0; v < 3; v++) {
      const base = t * 9 + v * 3
      const x = rawPositions[base]
      const y = rawPositions[base + 1]
      const z = rawPositions[base + 2]
      const k = key(x, y, z)
      let idx = vertexMap.get(k)
      if (idx === undefined) {
        idx = positionList.length / 3
        positionList.push(x, y, z)
        vertexMap.set(k, idx)
      }
      indices[t * 3 + v] = idx
    }
  }

  const positions = new Float32Array(positionList)

  // Face normals
  const faceNormals = new Float32Array(triCount * 3)
  for (let t = 0; t < triCount; t++) {
    const i0 = indices[t * 3], i1 = indices[t * 3 + 1], i2 = indices[t * 3 + 2]
    const ax = positions[i0*3], ay = positions[i0*3+1], az = positions[i0*3+2]
    const bx = positions[i1*3], by = positions[i1*3+1], bz = positions[i1*3+2]
    const cx = positions[i2*3], cy = positions[i2*3+1], cz = positions[i2*3+2]
    const ux = bx-ax, uy = by-ay, uz = bz-az
    const vx = cx-ax, vy = cy-ay, vz = cz-az
    let nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx
    const len = Math.sqrt(nx*nx + ny*ny + nz*nz)
    if (len > EPSILON) { nx /= len; ny /= len; nz /= len }
    faceNormals[t*3] = nx; faceNormals[t*3+1] = ny; faceNormals[t*3+2] = nz
  }

  // Edge-to-face map and adjacency
  const edgeToFaces = new Map<string, [number, number]>()
  const edgeKey = (a: number, b: number) =>
    a < b ? `${a}_${b}` : `${b}_${a}`

  for (let t = 0; t < triCount; t++) {
    for (let e = 0; e < 3; e++) {
      const va = indices[t*3 + e]
      const vb = indices[t*3 + ((e+1)%3)]
      const ek = edgeKey(va, vb)
      const existing = edgeToFaces.get(ek)
      if (existing === undefined) {
        edgeToFaces.set(ek, [t, -1])
      } else {
        existing[1] = t
      }
    }
  }

  const adjacency = new Int32Array(triCount * 3).fill(-1)
  for (let t = 0; t < triCount; t++) {
    for (let e = 0; e < 3; e++) {
      const va = indices[t*3 + e]
      const vb = indices[t*3 + ((e+1)%3)]
      const pair = edgeToFaces.get(edgeKey(va, vb))
      if (pair) {
        const neighbor = pair[0] === t ? pair[1] : pair[0]
        adjacency[t*3 + e] = neighbor
      }
    }
  }

  return { positions, indices, faceNormals, adjacency, edgeToFaces }
}
