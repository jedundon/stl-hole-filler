import type { FillMesh, MeshData } from "../../types";

export interface PartMesh {
  name: string;
  vertices: number[];
  triangles: number[];
}

export function meshDataToPart(mesh: MeshData): PartMesh {
  return {
    name: "body",
    vertices: Array.from(mesh.positions),
    triangles: Array.from(mesh.indices),
  };
}

export function fillToPart(fill: FillMesh, index: number): PartMesh {
  return {
    name: `fill-${index + 1}`,
    vertices: fill.vertices,
    triangles: fill.triangles,
  };
}

export function buildModelXml(parts: PartMesh[]) {
  const meshObjects = parts
    .map((part, index) => {
      const id = index + 1;
      const vertices = chunk(part.vertices, 3)
        .map(([x, y, z]) => `<vertex x="${fmt(x)}" y="${fmt(y)}" z="${fmt(z)}"/>`)
        .join("");
      const triangles = chunk(part.triangles, 3)
        .map(([v1, v2, v3]) => `<triangle v1="${v1}" v2="${v2}" v3="${v3}"/>`)
        .join("");
      return `<object id="${id}" type="model" partnumber="${escapeXml(part.name)}"><mesh><vertices>${vertices}</vertices><triangles>${triangles}</triangles></mesh></object>`;
    })
    .join("");

  const assemblyId = parts.length + 1;
  const components = parts
    .map((_, index) => `<component objectid="${index + 1}"/>`)
    .join("");
  const assemblyObject = `<object id="${assemblyId}" type="model" partnumber="filled-model"><components>${components}</components></object>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <metadata name="Application">STL Hole Filler</metadata>
  <resources>${meshObjects}${assemblyObject}</resources>
  <build><item objectid="${assemblyId}"/></build>
</model>`;
}

function chunk(values: number[], size: number) {
  const chunks: number[][] = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
}

function fmt(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(6)).toString() : "0";
}

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => {
    switch (character) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return character;
    }
  });
}
