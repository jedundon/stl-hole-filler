import type { BufferGeometry } from "three";

export interface MeshData {
  geometry: BufferGeometry;
  positions: Float32Array;
  indices: Uint32Array;
  faceNormals: Float32Array;
  adjacency: Int32Array;
  edgeFaces: Map<string, number[]>;
  triangleCount: number;
  bounds: {
    size: [number, number, number];
    center: [number, number, number];
  };
}

export interface PlaneData {
  origin: [number, number, number];
  normal: [number, number, number];
}

export interface SelectionLoop {
  outer: number[];
  holes: number[][];
}

export interface Selection {
  id: string;
  label: string;
  faceIndices: number[];
  loop: SelectionLoop;
  plane: PlaneData;
  depth: number;
  color: string;
  visible: boolean;
}

export interface FillMesh {
  vertices: number[];
  triangles: number[];
  groups: {
    topCap: FillMeshIndexGroup;
    bottomCap: FillMeshIndexGroup;
    sideWalls: FillMeshIndexGroup;
  };
  topLoopRanges: FillMeshLoopRange[];
}

export interface FillMeshIndexGroup {
  start: number;
  count: number;
}

export interface FillMeshLoopRange {
  start: number;
  count: number;
}

export interface Toast {
  id: string;
  message: string;
  tone?: "info" | "success" | "warning" | "error";
}

export interface ExportArtifact {
  fileName: string;
  byteLength: number;
  url: string;
}
