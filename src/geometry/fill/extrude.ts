import earcut from "earcut";
import { BufferAttribute, BufferGeometry } from "three";
import type { FillMesh, FillMeshLoopRange, MeshData, Selection } from "../../types";
import {
  add,
  basisFromNormal,
  dot,
  getVertex,
  projectPoint,
  scale,
  sub,
  type Vec3,
} from "../vector";

const TOP_LIFT_MM = 0;

export function buildFillMesh(mesh: MeshData, selection: Selection): FillMesh {
  const normal = selection.plane.normal as Vec3;
  const origin = selection.plane.origin as Vec3;
  const { u, v } = basisFromNormal(normal);
  const loops = [selection.loop.outer, ...selection.loop.holes];
  const vertices3d: Vec3[] = [];
  const vertices2d: number[] = [];
  const holeIndices: number[] = [];
  const topLoopRanges: FillMeshLoopRange[] = [];

  loops.forEach((loop, loopIndex) => {
    if (loopIndex > 0) {
      holeIndices.push(vertices3d.length);
    }
    topLoopRanges.push({ start: vertices3d.length, count: loop.length });
    loop.forEach((vertexIndex) => {
      const base = getVertex(mesh.positions, vertexIndex);
      const surfaceOffset = dot(sub(origin, base), normal);
      const surfacePoint = add(base, scale(normal, surfaceOffset));
      const top = add(surfacePoint, scale(normal, TOP_LIFT_MM));
      vertices3d.push(top);
      const projected = projectPoint(top, origin, u, v);
      vertices2d.push(projected[0], projected[1]);
    });
  });

  const topCount = vertices3d.length;
  const bottomOffset = topCount;
  const inward = scale(normal, -selection.depth);
  for (let i = 0; i < topCount; i += 1) {
    vertices3d.push(add(vertices3d[i], inward));
  }

  const triangles: number[] = [];
  const cap = earcut(vertices2d, holeIndices, 2);
  if (cap.length === 0) {
    throw new Error("Could not triangulate fill cap.");
  }
  const topCapStart = triangles.length;
  for (let i = 0; i < cap.length; i += 3) {
    triangles.push(cap[i], cap[i + 1], cap[i + 2]);
  }
  const topCapCount = triangles.length - topCapStart;

  const bottomCapStart = triangles.length;
  for (let i = 0; i < cap.length; i += 3) {
    triangles.push(bottomOffset + cap[i + 2], bottomOffset + cap[i + 1], bottomOffset + cap[i]);
  }
  const bottomCapCount = triangles.length - bottomCapStart;

  const sideWallsStart = triangles.length;
  let cursor = 0;
  loops.forEach((loop, loopIndex) => {
    const count = loop.length;
    for (let i = 0; i < count; i += 1) {
      const a = cursor + i;
      const b = cursor + ((i + 1) % count);
      const c = bottomOffset + b;
      const d = bottomOffset + a;

      if (loopIndex === 0) {
        triangles.push(a, b, c, a, c, d);
      } else {
        triangles.push(a, c, b, a, d, c);
      }
    }
    cursor += count;
  });
  const sideWallsCount = triangles.length - sideWallsStart;

  assertWatertight(triangles);

  return {
    vertices: vertices3d.flatMap((point) => point),
    triangles,
    groups: {
      topCap: { start: topCapStart, count: topCapCount },
      bottomCap: { start: bottomCapStart, count: bottomCapCount },
      sideWalls: { start: sideWallsStart, count: sideWallsCount },
    },
    topLoopRanges,
  };
}

function assertWatertight(triangles: number[]) {
  const edgeCounts = new Map<string, number>();
  for (let i = 0; i < triangles.length; i += 3) {
    const a = triangles[i];
    const b = triangles[i + 1];
    const c = triangles[i + 2];
    addEdge(edgeCounts, a, b);
    addEdge(edgeCounts, b, c);
    addEdge(edgeCounts, c, a);
  }

  const openEdges = [...edgeCounts.values()].filter((count) => count !== 2).length;
  if (openEdges > 0) {
    throw new Error(`Generated fill is not watertight (${openEdges} open/non-manifold edges).`);
  }
}

function addEdge(edgeCounts: Map<string, number>, a: number, b: number) {
  const key = a < b ? `${a}:${b}` : `${b}:${a}`;
  edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
}

export function makeThreeFillGeometry(fill: FillMesh) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(fill.vertices), 3));
  geometry.setIndex(fill.triangles);
  geometry.clearGroups();
  geometry.addGroup(fill.groups.topCap.start, fill.groups.topCap.count, 0);
  geometry.addGroup(fill.groups.bottomCap.start, fill.groups.bottomCap.count, 1);
  geometry.addGroup(fill.groups.sideWalls.start, fill.groups.sideWalls.count, 1);
  geometry.computeVertexNormals();
  return geometry;
}

export function approximateDepthSpan(mesh: MeshData, selection: Selection) {
  const normal = selection.plane.normal as Vec3;
  const origin = selection.plane.origin as Vec3;
  const distances = selection.faceIndices.map((face) => {
    const vertex = getVertex(mesh.positions, mesh.indices[face * 3]);
    return Math.abs((sub(vertex, origin)[0] * normal[0]) + (sub(vertex, origin)[1] * normal[1]) + (sub(vertex, origin)[2] * normal[2]));
  });
  return Math.max(...distances, 0);
}
