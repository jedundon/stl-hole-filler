export interface RawTriangleMesh {
  positions: Float32Array;
}

const textDecoder = new TextDecoder();

export function parseStl(buffer: ArrayBuffer): RawTriangleMesh {
  if (looksBinary(buffer)) {
    return parseBinaryStl(buffer);
  }
  return parseAsciiStl(buffer);
}

function looksBinary(buffer: ArrayBuffer) {
  if (buffer.byteLength < 84) {
    return false;
  }
  const view = new DataView(buffer);
  const count = view.getUint32(80, true);
  const expected = 84 + count * 50;
  if (expected === buffer.byteLength) {
    return true;
  }
  const header = textDecoder.decode(buffer.slice(0, Math.min(80, buffer.byteLength))).toLowerCase();
  return !header.trimStart().startsWith("solid");
}

function parseBinaryStl(buffer: ArrayBuffer): RawTriangleMesh {
  const view = new DataView(buffer);
  const count = view.getUint32(80, true);
  const positions = new Float32Array(count * 9);
  let offset = 84;
  let cursor = 0;

  for (let t = 0; t < count; t += 1) {
    offset += 12;
    for (let v = 0; v < 3; v += 1) {
      positions[cursor++] = view.getFloat32(offset, true);
      positions[cursor++] = view.getFloat32(offset + 4, true);
      positions[cursor++] = view.getFloat32(offset + 8, true);
      offset += 12;
    }
    offset += 2;
  }

  return { positions };
}

function parseAsciiStl(buffer: ArrayBuffer): RawTriangleMesh {
  const source = textDecoder.decode(buffer);
  const vertices = [...source.matchAll(/vertex\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)/gi)];

  if (vertices.length === 0 || vertices.length % 3 !== 0) {
    throw new Error("ASCII STL has no complete triangles");
  }

  const positions = new Float32Array(vertices.length * 3);
  vertices.forEach((match, index) => {
    positions[index * 3] = Number(match[1]);
    positions[index * 3 + 1] = Number(match[2]);
    positions[index * 3 + 2] = Number(match[3]);
  });

  return { positions };
}
