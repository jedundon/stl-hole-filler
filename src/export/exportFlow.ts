import type { ExportArtifact, MeshData, Selection } from "../types";
import { buildFillMesh } from "../geometry/fill/extrude";
import { exportName } from "../lib/filename";
import { fillToPart, meshDataToPart } from "./3mf/model-xml";
import { write3mf } from "./3mf/writer";

export async function exportSelections(
  mesh: MeshData,
  selections: Selection[],
  fileName: string | null,
  previousArtifact?: ExportArtifact | null,
): Promise<ExportArtifact> {
  const fills = selections.map((selection) => buildFillMesh(mesh, selection));
  const bytes = write3mf([meshDataToPart(mesh), ...fills.map(fillToPart)]);
  const outputName = exportName(fileName);
  const payload = toExactArrayBuffer(bytes);
  const blob = new Blob([payload], { type: "model/3mf" });

  if (bytes.byteLength === 0) {
    throw new Error("3MF writer produced an empty file.");
  }

  if (previousArtifact) {
    URL.revokeObjectURL(previousArtifact.url);
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = outputName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  return { fileName: outputName, byteLength: bytes.byteLength, url };
}

function toExactArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
