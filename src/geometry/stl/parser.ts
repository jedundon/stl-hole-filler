/**
 * Parse binary or ASCII STL into a flat Float32Array of positions.
 * Returns 9 floats per triangle (v0.xyz, v1.xyz, v2.xyz). Normals are discarded
 * and recomputed from geometry in the normalize step.
 */
export function parseSTL(buffer: ArrayBuffer): Float32Array {
  if (isASCII(buffer)) return parseASCII(buffer)
  return parseBinary(buffer)
}

function isASCII(buffer: ArrayBuffer): boolean {
  const view = new Uint8Array(buffer, 0, Math.min(256, buffer.byteLength))
  const text = new TextDecoder().decode(view)
  return text.trimStart().startsWith('solid')
}

function parseBinary(buffer: ArrayBuffer): Float32Array {
  const view = new DataView(buffer)
  const triCount = view.getUint32(80, true)
  const positions = new Float32Array(triCount * 9)
  let offset = 84
  for (let i = 0; i < triCount; i++) {
    offset += 12 // skip face normal
    const base = i * 9
    for (let v = 0; v < 3; v++) {
      positions[base + v * 3 + 0] = view.getFloat32(offset, true); offset += 4
      positions[base + v * 3 + 1] = view.getFloat32(offset, true); offset += 4
      positions[base + v * 3 + 2] = view.getFloat32(offset, true); offset += 4
    }
    offset += 2 // attribute byte count
  }
  return positions
}

function parseASCII(buffer: ArrayBuffer): Float32Array {
  const text = new TextDecoder().decode(buffer)
  const vertexRe = /vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)/g
  const coords: number[] = []
  let match: RegExpExecArray | null
  while ((match = vertexRe.exec(text)) !== null) {
    coords.push(parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3]))
  }
  return new Float32Array(coords)
}
