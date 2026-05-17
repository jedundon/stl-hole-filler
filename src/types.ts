import type * as THREE from 'three'

export interface NormalizedGeometry {
  positions: Float32Array   // 3 floats per vertex
  indices: Uint32Array      // 3 indices per triangle
  faceNormals: Float32Array // 3 floats per face, precomputed
  /** adjacency[faceIdx * 3 + edgeSlot] = adjacent face index, or -1 if boundary */
  adjacency: Int32Array
  /** edgeMap: key="${minV}_${maxV}" → [faceA, faceB] */
  edgeToFaces: Map<string, [number, number]>
}

export interface OpeningPlane {
  origin: THREE.Vector3
  normal: THREE.Vector3   // points outward (away from model interior)
}

export interface BoundaryLoops {
  outer: number[]         // vertex indices, CCW in opening plane 2D
  inner: number[][]       // vertex indices per island, CW in opening plane 2D
}

export interface Selection {
  id: string
  label: string
  faceIndices: number[]
  loops: BoundaryLoops
  plane: OpeningPlane
  depth: number           // mm, extrusion depth into the body
  color: string           // hex
  visible: boolean
  fillGeometry: THREE.BufferGeometry | null
}

export type AppPhase = 'idle' | 'loaded' | 'exporting'
