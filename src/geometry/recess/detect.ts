import type {
  DetectionProfile,
  DetectionProfileSample,
  DetectionRule,
  MeshData,
  ProfileDetectionResult,
  RecessCandidate,
  RecessCandidateMetrics,
  Selection,
} from "../../types";
import { colorForIndex } from "../../lib/palette";
import { dot, getFaceNormal, getVertex, sub, type Vec3 } from "../vector";
import { edgeKey } from "../stl/normalize";
import { boundarySharpness, extractLoops } from "./boundary";

const NORMAL_COS_TOLERANCE = Math.cos((12 * Math.PI) / 180);
const MIN_BOUNDARY_ANGLE = (28 * Math.PI) / 180;
const MAX_REGION_FACES = 25000;
const MIN_PLANE_TOLERANCE = 0.025;
const PLANE_MATCH_COS_TOLERANCE = Math.cos((8 * Math.PI) / 180);

export function detectRecessCandidates(mesh: MeshData, defaultDepth: number): RecessCandidate[] {
  const visited = new Set<number>();
  const candidates: RecessCandidate[] = [];

  for (let face = 0; face < mesh.triangleCount; face += 1) {
    if (visited.has(face)) {
      continue;
    }

    const faceIndices = floodPlanarRegion(mesh, face);
    faceIndices.forEach((regionFace) => visited.add(regionFace));
    const selection = buildSelectionFromRegion(mesh, faceIndices, candidates.length, defaultDepth);
    if (selection) {
      candidates.push({ selection, metrics: measureCandidate(mesh, selection) });
    }
  }

  return candidates;
}

export function buildDetectionProfile(samples: DetectionProfileSample[]): DetectionProfile | null {
  if (samples.length === 0) {
    return null;
  }

  const rules = samples.map(({ mesh, selection }) => {
    const metrics = measureCandidate(mesh, selection);
    return {
      id: crypto.randomUUID(),
      area: expandedRange(metrics.area, 0.35, 0.08),
      depth: expandedRange(metrics.depth, 0.55, 0.08),
      boundaryAngle: expandedRange(metrics.boundaryAngle, 0.3, (10 * Math.PI) / 180),
      loopCount: metrics.loopCount,
      fillDepth: selection.depth,
    };
  });

  const loopCounts = [...new Set(rules.map((rule) => rule.loopCount))].sort((a, b) => a - b);
  return {
    id: crypto.randomUUID(),
    sourceSelectionCount: samples.length,
    rules,
    createdAt: new Date().toISOString(),
    summary: `${samples.length} reviewed ${samples.length === 1 ? "fill" : "fills"}, ${loopCounts.length} loop ${loopCounts.length === 1 ? "shape" : "shapes"}`,
  };
}

export function applyDetectionProfile(
  mesh: MeshData,
  profile: DetectionProfile,
  existingSelections: Selection[],
): ProfileDetectionResult {
  const existingFaces = new Set(existingSelections.flatMap((selection) => selection.faceIndices));
  const selections: Selection[] = [];
  const warnings: string[] = [];
  const candidates = detectRecessCandidates(mesh, averageProfileDepth(profile));

  candidates.forEach((candidate) => {
    if (candidate.selection.faceIndices.some((face) => existingFaces.has(face))) {
      return;
    }

    const matchingRules = profile.rules.filter((rule) => matchesRule(candidate.metrics, rule));
    if (matchingRules.length === 0) {
      return;
    }
    if (matchingRules.length > 1) {
      warnings.push("One recessed pocket matched multiple profile rules; the first matching reviewed fill was used.");
    }

    const rule = matchingRules[0];
    const index = existingSelections.length + selections.length;
    selections.push({
      ...candidate.selection,
      id: crypto.randomUUID(),
      label: `Hole ${index + 1}`,
      depth: rule.fillDepth,
      color: colorForIndex(index),
      visible: true,
    });
  });

  if (candidates.length === 0) {
    warnings.push("No recessed planar pockets were found.");
  } else if (selections.length === 0) {
    warnings.push(`Found ${candidates.length} recessed ${candidates.length === 1 ? "candidate" : "candidates"}, but none matched the current profile.`);
  }

  return { selections, warnings };
}

export function detectRecessSelection(
  mesh: MeshData,
  faceIndex: number,
  index: number,
  defaultDepth: number,
  point?: Vec3,
): Selection | null {
  if (faceIndex < 0 || faceIndex >= mesh.triangleCount) {
    return null;
  }

  for (const candidate of nearbyCandidateFaces(mesh, faceIndex, point)) {
    const selection = buildSelectionFromSeed(mesh, candidate, index, defaultDepth);
    if (selection) {
      return selection;
    }
  }

  return null;
}

export function detectSimilarSelectionsOnPlane(
  mesh: MeshData,
  reference: Selection,
  existingSelections: Selection[],
  defaultDepth: number,
): Selection[] {
  const visited = new Set<number>();
  const existingFaces = new Set(existingSelections.flatMap((selection) => selection.faceIndices));
  const matches: Selection[] = [];
  const referenceNormal = reference.plane.normal as Vec3;
  const referenceOrigin = reference.plane.origin as Vec3;
  const referenceFloorOffset = averageSignedDistance(mesh, reference.faceIndices, referenceOrigin, referenceNormal);
  const planeTolerance = Math.max(MIN_PLANE_TOLERANCE, modelDiagonal(mesh) * 0.0015);
  const floorTolerance = Math.max(0.08, planeTolerance * 3);

  for (let face = 0; face < mesh.triangleCount; face += 1) {
    if (visited.has(face) || existingFaces.has(face)) {
      continue;
    }

    const region = floodPlanarRegion(mesh, face);
    region.forEach((regionFace) => visited.add(regionFace));
    if (region.some((regionFace) => existingFaces.has(regionFace))) {
      continue;
    }

    const selection = buildSelectionFromRegion(mesh, region, existingSelections.length + matches.length, defaultDepth);
    if (!selection) {
      continue;
    }

    if (
      dot(selection.plane.normal as Vec3, referenceNormal) >= PLANE_MATCH_COS_TOLERANCE &&
      Math.abs(dot(sub(selection.plane.origin as Vec3, referenceOrigin), referenceNormal)) <= planeTolerance &&
      Math.abs(averageSignedDistance(mesh, selection.faceIndices, referenceOrigin, referenceNormal) - referenceFloorOffset) <= floorTolerance
    ) {
      matches.push(selection);
    }
  }

  return matches;
}

function buildSelectionFromSeed(
  mesh: MeshData,
  faceIndex: number,
  index: number,
  defaultDepth: number,
): Selection | null {
  const faceIndices = floodPlanarRegion(mesh, faceIndex);
  return buildSelectionFromRegion(mesh, faceIndices, index, defaultDepth);
}

function buildSelectionFromRegion(
  mesh: MeshData,
  faceIndices: number[],
  index: number,
  defaultDepth: number,
): Selection | null {
  if (faceIndices.length < 2) {
    return null;
  }

  if (boundarySharpness(mesh, faceIndices) < MIN_BOUNDARY_ANGLE) {
    return null;
  }

  if (!isRecessFloor(mesh, faceIndices)) {
    return null;
  }

  const normal = averageNormal(mesh, faceIndices);
  const loop = extractLoops(mesh, faceIndices, normal);
  if (!loop) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    label: `Hole ${index + 1}`,
    faceIndices,
    loop,
    plane: {
      origin: estimateOpeningPlaneOrigin(mesh, faceIndices, vertexCentroid(mesh.positions, loop.outer), normal),
      normal,
    },
    depth: defaultDepth,
    color: colorForIndex(index),
    visible: true,
  };
}

function nearbyCandidateFaces(mesh: MeshData, faceIndex: number, point?: Vec3) {
  const candidates: number[] = [];
  const queued = new Set<number>([faceIndex]);
  const queue = [{ face: faceIndex, depth: 0 }];

  while (queue.length > 0) {
    const { face, depth } = queue.shift()!;
    candidates.push(face);
    if (depth >= 2) {
      continue;
    }
    for (let edge = 0; edge < 3; edge += 1) {
      const neighbor = mesh.adjacency[face * 3 + edge];
      if (neighbor >= 0 && !queued.has(neighbor)) {
        queued.add(neighbor);
        queue.push({ face: neighbor, depth: depth + 1 });
      }
    }
  }

  if (point) {
    const radius = Math.max(1.25, modelDiagonal(mesh) * 0.08);
    const radiusSquared = radius * radius;
    const spatialCandidates: Array<{ face: number; distance: number }> = [];

    for (let face = 0; face < mesh.triangleCount; face += 1) {
      const centroid = getFaceCentroid(mesh, face);
      const distance =
        (centroid[0] - point[0]) ** 2 +
        (centroid[1] - point[1]) ** 2 +
        (centroid[2] - point[2]) ** 2;
      if (distance <= radiusSquared) {
        spatialCandidates.push({ face, distance });
      }
    }

    spatialCandidates
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 200)
      .forEach(({ face }) => {
        if (!queued.has(face)) {
          queued.add(face);
          candidates.push(face);
        }
      });
  }

  return candidates;
}

function floodPlanarRegion(mesh: MeshData, startFace: number) {
  const seedNormal = getFaceNormal(mesh.faceNormals, startFace);
  const seedOrigin = getFaceCentroid(mesh, startFace);
  const planeTolerance = Math.max(MIN_PLANE_TOLERANCE, modelDiagonal(mesh) * 0.001);
  const visited = new Set<number>([startFace]);
  const queue = [startFace];

  while (queue.length > 0 && visited.size < MAX_REGION_FACES) {
    const face = queue.shift()!;
    const currentNormal = getFaceNormal(mesh.faceNormals, face);
    for (let edge = 0; edge < 3; edge += 1) {
      const neighbor = mesh.adjacency[face * 3 + edge];
      if (neighbor < 0 || visited.has(neighbor)) {
        continue;
      }
      const normal = getFaceNormal(mesh.faceNormals, neighbor);
      const matchesSeedNormal = dot(seedNormal, normal) >= NORMAL_COS_TOLERANCE;
      const isSmoothNeighbor = dot(currentNormal, normal) >= NORMAL_COS_TOLERANCE;
      if (matchesSeedNormal && isSmoothNeighbor && faceLiesOnPlane(mesh, neighbor, seedOrigin, seedNormal, planeTolerance)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return [...visited];
}

function faceLiesOnPlane(mesh: MeshData, faceIndex: number, origin: Vec3, normal: Vec3, tolerance: number) {
  for (let corner = 0; corner < 3; corner += 1) {
    const vertex = getVertex(mesh.positions, mesh.indices[faceIndex * 3 + corner]);
    if (Math.abs(dot(sub(vertex, origin), normal)) > tolerance) {
      return false;
    }
  }
  return true;
}

function isRecessFloor(mesh: MeshData, faceIndices: number[]) {
  const faceSet = new Set(faceIndices);
  const normal = averageNormal(mesh, faceIndices);
  const center = averageCentroid(mesh, faceIndices);
  const offsets: number[] = [];

  faceSet.forEach((face) => {
    for (let edge = 0; edge < 3; edge += 1) {
      const a = mesh.indices[face * 3 + edge];
      const b = mesh.indices[face * 3 + ((edge + 1) % 3)];
      const outsideFace = (mesh.edgeFaces.get(edgeKey(a, b)) ?? []).find((candidate) => !faceSet.has(candidate));
      if (outsideFace !== undefined) {
        offsets.push(dot(sub(getFaceCentroid(mesh, outsideFace), center), normal));
      }
    }
  });

  if (offsets.length === 0) {
    return false;
  }

  const averageOffset = offsets.reduce((sum, offset) => sum + offset, 0) / offsets.length;
  return averageOffset > Math.max(MIN_PLANE_TOLERANCE, modelDiagonal(mesh) * 0.001);
}

function estimateOpeningPlaneOrigin(mesh: MeshData, faceIndices: number[], floorOrigin: Vec3, normal: Vec3): Vec3 {
  const faceSet = new Set(faceIndices);
  const positiveOffsets: number[] = [];

  faceSet.forEach((face) => {
    for (let edge = 0; edge < 3; edge += 1) {
      const a = mesh.indices[face * 3 + edge];
      const b = mesh.indices[face * 3 + ((edge + 1) % 3)];
      const outsideFace = (mesh.edgeFaces.get(edgeKey(a, b)) ?? []).find((candidate) => !faceSet.has(candidate));
      if (outsideFace === undefined) {
        continue;
      }

      for (let corner = 0; corner < 3; corner += 1) {
        const vertex = getVertex(mesh.positions, mesh.indices[outsideFace * 3 + corner]);
        const offset = dot(sub(vertex, floorOrigin), normal);
        if (offset > MIN_PLANE_TOLERANCE) {
          positiveOffsets.push(offset);
        }
      }
    }
  });

  const openingOffset = positiveOffsets.length > 0 ? Math.max(...positiveOffsets) : 0;
  return [
    floorOrigin[0] + normal[0] * openingOffset,
    floorOrigin[1] + normal[1] * openingOffset,
    floorOrigin[2] + normal[2] * openingOffset,
  ];
}

function averageNormal(mesh: MeshData, faceIndices: number[]): Vec3 {
  const normal: Vec3 = [0, 0, 0];
  faceIndices.forEach((face) => {
    const faceNormal = getFaceNormal(mesh.faceNormals, face);
    normal[0] += faceNormal[0];
    normal[1] += faceNormal[1];
    normal[2] += faceNormal[2];
  });
  const length = Math.hypot(normal[0], normal[1], normal[2]);
  return length > 1e-9 ? [normal[0] / length, normal[1] / length, normal[2] / length] : getFaceNormal(mesh.faceNormals, faceIndices[0]);
}

function averageCentroid(mesh: MeshData, faceIndices: number[]): Vec3 {
  const center: Vec3 = [0, 0, 0];
  faceIndices.forEach((face) => {
    const centroid = getFaceCentroid(mesh, face);
    center[0] += centroid[0];
    center[1] += centroid[1];
    center[2] += centroid[2];
  });
  return [center[0] / faceIndices.length, center[1] / faceIndices.length, center[2] / faceIndices.length];
}

function averageSignedDistance(mesh: MeshData, faceIndices: number[], origin: Vec3, normal: Vec3) {
  const center = averageCentroid(mesh, faceIndices);
  return dot(sub(center, origin), normal);
}

function measureCandidate(mesh: MeshData, selection: Selection): RecessCandidateMetrics {
  return {
    area: regionArea(mesh, selection.faceIndices),
    depth: openingDepth(mesh, selection),
    boundaryAngle: boundarySharpness(mesh, selection.faceIndices),
    loopCount: 1 + selection.loop.holes.length,
  };
}

function regionArea(mesh: MeshData, faceIndices: number[]) {
  let area = 0;
  faceIndices.forEach((face) => {
    const a = getVertex(mesh.positions, mesh.indices[face * 3]);
    const b = getVertex(mesh.positions, mesh.indices[face * 3 + 1]);
    const c = getVertex(mesh.positions, mesh.indices[face * 3 + 2]);
    const ab = sub(b, a);
    const ac = sub(c, a);
    const cross: Vec3 = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    area += Math.hypot(cross[0], cross[1], cross[2]) * 0.5;
  });
  return area;
}

function openingDepth(mesh: MeshData, selection: Selection) {
  const origin = selection.plane.origin as Vec3;
  const normal = selection.plane.normal as Vec3;
  const distances = selection.faceIndices.map((face) => {
    const vertex = getVertex(mesh.positions, mesh.indices[face * 3]);
    return Math.abs(dot(sub(vertex, origin), normal));
  });
  return distances.reduce((sum, distance) => sum + distance, 0) / Math.max(distances.length, 1);
}

function expandedRange(value: number, percent: number, minimumPadding: number) {
  const padding = Math.max(Math.abs(value) * percent, minimumPadding);
  return {
    min: Math.max(0, value - padding),
    max: value + padding,
  };
}

function matchesRule(metrics: RecessCandidateMetrics, rule: DetectionRule) {
  return (
    metrics.loopCount === rule.loopCount &&
    inRange(metrics.area, rule.area) &&
    inRange(metrics.depth, rule.depth) &&
    inRange(metrics.boundaryAngle, rule.boundaryAngle)
  );
}

function inRange(value: number, range: { min: number; max: number }) {
  return value >= range.min && value <= range.max;
}

function averageProfileDepth(profile: DetectionProfile) {
  const total = profile.rules.reduce((sum, rule) => sum + rule.fillDepth, 0);
  return total / Math.max(profile.rules.length, 1);
}

function getFaceCentroid(mesh: MeshData, faceIndex: number): Vec3 {
  const a = getVertex(mesh.positions, mesh.indices[faceIndex * 3]);
  const b = getVertex(mesh.positions, mesh.indices[faceIndex * 3 + 1]);
  const c = getVertex(mesh.positions, mesh.indices[faceIndex * 3 + 2]);
  return [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
}

function modelDiagonal(mesh: MeshData) {
  const [x, y, z] = mesh.bounds.size;
  return Math.hypot(x, y, z);
}

function vertexCentroid(positions: Float32Array, vertices: number[]): [number, number, number] {
  const sum: [number, number, number] = [0, 0, 0];
  vertices.forEach((vertex) => {
    sum[0] += positions[vertex * 3];
    sum[1] += positions[vertex * 3 + 1];
    sum[2] += positions[vertex * 3 + 2];
  });
  return [sum[0] / vertices.length, sum[1] / vertices.length, sum[2] / vertices.length];
}
