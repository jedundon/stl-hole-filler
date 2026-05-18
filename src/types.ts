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

export type BatchItemStatus = "loading" | "ready" | "detecting" | "review" | "reviewed" | "exported" | "error";

export interface SelectionHistory {
  past: Selection[][];
  future: Selection[][];
  groupKey: string | null;
}

export interface BatchItem {
  id: string;
  fileName: string;
  mesh: MeshData | null;
  selections: Selection[];
  history: SelectionHistory;
  checkedSelectionIds: string[];
  status: BatchItemStatus;
  warnings: string[];
  error: string | null;
  exportArtifact: ExportArtifact | null;
}

export interface DetectionProfile {
  id: string;
  sourceSelectionCount: number;
  rules: DetectionRule[];
  createdAt: string;
  summary: string;
}

export interface DetectionRule {
  id: string;
  area: Range;
  depth: Range;
  boundaryAngle: Range;
  loopCount: number;
  fillDepth: number;
}

export interface Range {
  min: number;
  max: number;
}

export interface DetectionProfileSample {
  mesh: MeshData;
  selection: Selection;
}

export interface RecessCandidate {
  selection: Selection;
  metrics: RecessCandidateMetrics;
}

export interface RecessCandidateMetrics {
  area: number;
  depth: number;
  boundaryAngle: number;
  loopCount: number;
}

export interface ProfileDetectionResult {
  selections: Selection[];
  warnings: string[];
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
