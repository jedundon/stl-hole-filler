import type { MeshData, SelectionLoop } from "../../types";
import {
  basisFromNormal,
  getFaceNormal,
  getVertex,
  normalize,
  polygonArea,
  projectPoint,
  type Vec3,
} from "../vector";
import { edgeKey } from "../stl/normalize";

interface BoundaryEdge {
  a: number;
  b: number;
  insideFace: number;
  outsideFace: number;
}

export function extractLoops(mesh: MeshData, faceIndices: number[], planeNormal: Vec3): SelectionLoop | null {
  const faceSet = new Set(faceIndices);
  const edges = collectBoundaryEdges(mesh, faceSet);
  if (edges.length < 3) {
    return null;
  }

  const loops = walkLoops(edges).filter((loop) => loop.length >= 3);
  if (loops.length === 0) {
    return null;
  }

  const origin = getVertex(mesh.positions, loops[0][0]);
  const { u, v } = basisFromNormal(planeNormal);
  const loopAreas = loops.map((loop) => {
    const projected = loop.map((index) => projectPoint(getVertex(mesh.positions, index), origin, u, v));
    return polygonArea(projected);
  });

  let outerIndex = 0;
  let largestArea = 0;
  loopAreas.forEach((area, index) => {
    if (Math.abs(area) > largestArea) {
      largestArea = Math.abs(area);
      outerIndex = index;
    }
  });

  const outer = ensureWinding(loops[outerIndex], loopAreas[outerIndex], true);
  const holes = loops
    .filter((_, index) => index !== outerIndex)
    .map((loop, index) => {
      const originalIndex = index < outerIndex ? index : index + 1;
      return ensureWinding(loop, loopAreas[originalIndex], false);
    });

  return { outer, holes };
}

export function estimateOpeningNormal(mesh: MeshData, faceIndices: number[]): Vec3 {
  const faceSet = new Set(faceIndices);
  const edges = collectBoundaryEdges(mesh, faceSet);
  const normal: Vec3 = [0, 0, 0];

  edges.forEach((edge) => {
    if (edge.outsideFace >= 0) {
      const outside = getFaceNormal(mesh.faceNormals, edge.outsideFace);
      normal[0] += outside[0];
      normal[1] += outside[1];
      normal[2] += outside[2];
    }
  });

  if (Math.hypot(normal[0], normal[1], normal[2]) < 1e-6 && faceIndices.length > 0) {
    return getFaceNormal(mesh.faceNormals, faceIndices[0]);
  }

  return normalize(normal);
}

export function boundarySharpness(mesh: MeshData, faceIndices: number[]) {
  const faceSet = new Set(faceIndices);
  const edges = collectBoundaryEdges(mesh, faceSet);
  const angles: number[] = [];

  edges.forEach((edge) => {
    if (edge.outsideFace < 0) {
      return;
    }
    const inside = getFaceNormal(mesh.faceNormals, edge.insideFace);
    const outside = getFaceNormal(mesh.faceNormals, edge.outsideFace);
    const dot = Math.max(-1, Math.min(1, inside[0] * outside[0] + inside[1] * outside[1] + inside[2] * outside[2]));
    angles.push(Math.acos(dot));
  });

  if (angles.length === 0) {
    return 0;
  }
  return angles.reduce((sum, angle) => sum + angle, 0) / angles.length;
}

function collectBoundaryEdges(mesh: MeshData, faceSet: Set<number>): BoundaryEdge[] {
  const edges: BoundaryEdge[] = [];

  faceSet.forEach((face) => {
    for (let edge = 0; edge < 3; edge += 1) {
      const a = mesh.indices[face * 3 + edge];
      const b = mesh.indices[face * 3 + ((edge + 1) % 3)];
      const faces = mesh.edgeFaces.get(edgeKey(a, b)) ?? [];
      const outsideFace = faces.find((candidate) => !faceSet.has(candidate)) ?? -1;
      if (outsideFace >= 0 || faces.length === 1) {
        edges.push({ a, b, insideFace: face, outsideFace });
      }
    }
  });

  return edges;
}

function walkLoops(edges: BoundaryEdge[]) {
  const unused = new Map<string, BoundaryEdge>();
  const incident = new Map<number, BoundaryEdge[]>();

  edges.forEach((edge) => {
    unused.set(edgeKey(edge.a, edge.b), edge);
    const aList = incident.get(edge.a) ?? [];
    aList.push(edge);
    incident.set(edge.a, aList);
    const bList = incident.get(edge.b) ?? [];
    bList.push(edge);
    incident.set(edge.b, bList);
  });

  const loops: number[][] = [];

  while (unused.size > 0) {
    const first = unused.values().next().value as BoundaryEdge;
    const loop = [first.a, first.b];
    unused.delete(edgeKey(first.a, first.b));
    const start = first.a;
    let previous = first.a;
    let current = first.b;

    for (let guard = 0; guard < edges.length + 2; guard += 1) {
      if (current === start) {
        loop.pop();
        break;
      }
      const next = (incident.get(current) ?? []).find((edge) => {
        if (!unused.has(edgeKey(edge.a, edge.b))) {
          return false;
        }
        const other = edge.a === current ? edge.b : edge.a;
        return other !== previous || (incident.get(current) ?? []).length === 1;
      });
      if (!next) {
        break;
      }
      unused.delete(edgeKey(next.a, next.b));
      const nextVertex = next.a === current ? next.b : next.a;
      loop.push(nextVertex);
      previous = current;
      current = nextVertex;
    }

    loops.push(removeConsecutiveDuplicates(loop));
  }

  return loops;
}

function removeConsecutiveDuplicates(loop: number[]) {
  return loop.filter((value, index) => value !== loop[(index + loop.length - 1) % loop.length]);
}

function ensureWinding(loop: number[], area: number, wantPositive: boolean) {
  const hasPositive = area > 0;
  return hasPositive === wantPositive ? loop : [...loop].reverse();
}
