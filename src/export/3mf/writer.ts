import { strToU8, zipSync } from "fflate";
import type { PartMesh } from "./model-xml";
import { buildModelXml } from "./model-xml";
import { contentTypesXml, modelRelationshipsXml, rootRelationshipsXml } from "./relationships";

export function write3mf(parts: PartMesh[]) {
  const modelXml = buildModelXml(parts);

  return zipSync({
    "[Content_Types].xml": strToU8(contentTypesXml),
    "_rels/.rels": strToU8(rootRelationshipsXml),
    "3D/3dmodel.model": strToU8(modelXml),
    "3D/_rels/3dmodel.model.rels": strToU8(modelRelationshipsXml),
  });
}
