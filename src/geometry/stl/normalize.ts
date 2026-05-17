import { BufferAttribute, BufferGeometry, Box3, Vector3 } from "three";
import type { MeshData } from "../../types";
import { getVertex, triangleNormal } from "../vector";
import type { RawTriangleMesh } from "./parser";

const WELD_PRECISION = 1e5;

export function normalizeMesh(raw: RawTriangleMesh): MeshData {
  const positions: number[] = [];
  const indices: number[] = [];
  const vertexMap = new Map<string, number>();

  for (let i = 0; i < raw.positions.length; i += 3) {
    const x = raw.positions[i];
    const y = raw.positions[i + 1];
    const z = raw.positions[i + 2];
    const key = `${Math.round(x * WELD_PRECISION)},${Math.round(y * WELD_PRECISION)},${Math.round(z * WELD_PRECISION)}`;
    let index = vertexMap.get(key);
    if (index === undefined) {
      index = positions.length / 3;
      vertexMap.set(key, index);
      positions.push(x, y, z);
    }
    indices.push(index);
  }

  const positionArray = new Float32Array(positions);
  const indexArray = indices.length > 65535 ? new Uint32Array(indices) : new Uint32Array(indices);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positionArray, 3));
  geometry.setIndex(new BufferAttribute(indexArray, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const faceNormals = buildFaceNormals(positionArray, indexArray);
  const { adjacency, edgeFaces } = buildAdjacency(indexArray);
  const box = geometry.boundingBox ?? new Box3().setFromBufferAttribute(geometry.getAttribute("position") as BufferAttribute);
  const size = new Vector3();
  const center = new Vector3();
  box.getSize(size);
  box.getCenter(center);

  return {
    geometry,
    positions: positionArray,
    indices: indexArray,
    faceNormals,
    adjacency,
    edgeFaces,
    triangleCount: indexArray.length / 3,
    bounds: {
      size: [size.x, size.y, size.z],
      center: [center.x, center.y, center.z],
    },
  };
}

function buildFaceNormals(positions: Float32Array, indices: Uint32Array) {
  const normals = new Float32Array(indices.length);
  for (let face = 0; face < indices.length / 3; face += 1) {
    const a = getVertex(positions, indices[face * 3]);
    const b = getVertex(positions, indices[face * 3 + 1]);
    const c = getVertex(positions, indices[face * 3 + 2]);
    const normal = triangleNormal(a, b, c);
    normals[face * 3] = normal[0];
    normals[face * 3 + 1] = normal[1];
    normals[face * 3 + 2] = normal[2];
  }
  return normals;
}

function buildAdjacency(indices: Uint32Array) {
  const faceCount = indices.length / 3;
  const adjacency = new Int32Array(faceCount * 3);
  adjacency.fill(-1);
  const edgeFaces = new Map<string, number[]>();

  for (let face = 0; face < faceCount; face += 1) {
    for (let edge = 0; edge < 3; edge += 1) {
      const a = indices[face * 3 + edge];
      const b = indices[face * 3 + ((edge + 1) % 3)];
      const key = edgeKey(a, b);
      const faces = edgeFaces.get(key) ?? [];
      faces.push(face);
      edgeFaces.set(key, faces);
    }
  }

  for (let face = 0; face < faceCount; face += 1) {
    for (let edge = 0; edge < 3; edge += 1) {
      const a = indices[face * 3 + edge];
      const b = indices[face * 3 + ((edge + 1) % 3)];
      const faces = edgeFaces.get(edgeKey(a, b)) ?? [];
      const neighbor = faces.length === 2 ? faces.find((candidate) => candidate !== face) : undefined;
      adjacency[face * 3 + edge] = neighbor ?? -1;
    }
  }

  return { adjacency, edgeFaces };
}

export function edgeKey(a: number, b: number) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}
