import { strToU8, zip } from 'fflate'
import type { BufferGeometry } from 'three'

interface Part {
  id: number
  name: string
  geometry: BufferGeometry
}

/**
 * Build a 3MF archive containing one object per part.
 * Each object is a separate mesh component so slicers treat them as
 * individually paintable parts of a single model.
 */
export async function write3MF(parts: Part[]): Promise<Uint8Array> {
  const objectsXml = parts.map(p => buildObjectXml(p)).join('\n')

  const componentItems = parts
    .map(p => `      <component objectid="${p.id}" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>`)
    .join('\n')

  const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US"
  xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"
  xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06">
  <resources>
${objectsXml}
    <object id="${parts.length + 1}" type="model">
      <components>
${componentItems}
      </components>
    </object>
  </resources>
  <build>
    <item objectid="${parts.length + 1}" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>
  </build>
</model>`

  const relsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rel0" Target="/3D/model.model" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`

  return new Promise((resolve, reject) => {
    zip(
      {
        '[Content_Types].xml': strToU8(contentTypesXml),
        '_rels/.rels': strToU8(relsXml),
        '3D/model.model': strToU8(modelXml),
      },
      { level: 6 },
      (err, data) => {
        if (err) reject(err)
        else resolve(data)
      },
    )
  })
}

function buildObjectXml(part: Part): string {
  const pos = part.geometry.getAttribute('position')
  if (!pos) throw new Error(`Part "${part.name}" has no position attribute`)

  const vertexCount = pos.count
  const vertices: string[] = []
  for (let i = 0; i < vertexCount; i++) {
    vertices.push(`        <vertex x="${pos.getX(i).toFixed(6)}" y="${pos.getY(i).toFixed(6)}" z="${pos.getZ(i).toFixed(6)}"/>`)
  }

  // Non-indexed: every 3 vertices is a triangle
  const triCount = vertexCount / 3
  const triangles: string[] = []
  for (let i = 0; i < triCount; i++) {
    triangles.push(`        <triangle v1="${i*3}" v2="${i*3+1}" v3="${i*3+2}"/>`)
  }

  return `    <object id="${part.id}" name="${part.name}" type="model">
      <mesh>
        <vertices>
${vertices.join('\n')}
        </vertices>
        <triangles>
${triangles.join('\n')}
        </triangles>
      </mesh>
    </object>`
}
