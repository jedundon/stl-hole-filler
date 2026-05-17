export type Vec3 = [number, number, number];
export type Vec2 = [number, number];

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

export function dot(a: Vec3, b: Vec3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function length(v: Vec3) {
  return Math.hypot(v[0], v[1], v[2]);
}

export function normalize(v: Vec3): Vec3 {
  const len = length(v);
  return len > 1e-9 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 0, 1];
}

export function triangleNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  return normalize(cross(sub(b, a), sub(c, a)));
}

export function angleBetween(a: Vec3, b: Vec3) {
  const value = Math.max(-1, Math.min(1, dot(normalize(a), normalize(b))));
  return Math.acos(value);
}

export function getVertex(positions: Float32Array, index: number): Vec3 {
  const i = index * 3;
  return [positions[i], positions[i + 1], positions[i + 2]];
}

export function getFaceNormal(faceNormals: Float32Array, faceIndex: number): Vec3 {
  const i = faceIndex * 3;
  return [faceNormals[i], faceNormals[i + 1], faceNormals[i + 2]];
}

export function basisFromNormal(normal: Vec3): { u: Vec3; v: Vec3; n: Vec3 } {
  const n = normalize(normal);
  const helper: Vec3 = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
  const u = normalize(cross(helper, n));
  const v = normalize(cross(n, u));
  return { u, v, n };
}

export function projectPoint(point: Vec3, origin: Vec3, u: Vec3, v: Vec3): Vec2 {
  const d = sub(point, origin);
  return [dot(d, u), dot(d, v)];
}

export function polygonArea(points: Vec2[]) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area / 2;
}
