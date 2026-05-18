import { zipSync } from "fflate";
import type { BatchItem, ExportArtifact, MeshData, Selection } from "../types";
import { buildFillMesh } from "../geometry/fill/extrude";
import { exportName, uniqueExportName, zipExportName } from "../lib/filename";
import { fillToPart, meshDataToPart } from "./3mf/model-xml";
import { write3mf } from "./3mf/writer";

export interface ExportableItem {
  fileName: string;
  mesh: MeshData;
  selections: Selection[];
}

export function build3mfBytes(mesh: MeshData, selections: Selection[]) {
  const fills = selections.map((selection) => buildFillMesh(mesh, selection));
  return write3mf([meshDataToPart(mesh), ...fills.map(fillToPart)]);
}

export function build3mfArtifact(
  item: ExportableItem,
  previousArtifact?: ExportArtifact | null,
): ExportArtifact {
  const bytes = build3mfBytes(item.mesh, item.selections);
  const outputName = exportName(item.fileName);
  return makeArtifact(outputName, bytes, "model/3mf", previousArtifact);
}

export function buildBatchZipArtifact(
  items: BatchItem[],
  previousArtifact?: ExportArtifact | null,
): ExportArtifact {
  const usedNames = new Set<string>();
  const files: Record<string, Uint8Array> = {};

  items.forEach((item) => {
    if (!item.mesh || item.selections.length === 0 || (item.status !== "reviewed" && item.status !== "exported")) {
      return;
    }
    files[uniqueExportName(item.fileName, usedNames)] = build3mfBytes(item.mesh, item.selections);
  });

  const bytes = zipSync(files);
  return makeArtifact(zipExportName(), bytes, "application/zip", previousArtifact);
}

export async function exportSelections(
  mesh: MeshData,
  selections: Selection[],
  fileName: string | null,
  previousArtifact?: ExportArtifact | null,
): Promise<ExportArtifact> {
  const artifact = build3mfArtifact({ mesh, selections, fileName: fileName ?? "model.stl" }, previousArtifact);

  await new Promise((resolve) => setTimeout(resolve, 0));
  downloadArtifact(artifact);
  return artifact;
}

export function downloadArtifact(artifact: ExportArtifact) {
  const link = document.createElement("a");
  link.href = artifact.url;
  link.download = artifact.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function makeArtifact(
  outputName: string,
  bytes: Uint8Array,
  type: string,
  previousArtifact?: ExportArtifact | null,
) {
  const payload = toExactArrayBuffer(bytes);
  const blob = new Blob([payload], { type });

  if (bytes.byteLength === 0) {
    throw new Error(`${outputName} writer produced an empty file.`);
  }

  if (previousArtifact) {
    URL.revokeObjectURL(previousArtifact.url);
  }

  const url = URL.createObjectURL(blob);
  return { fileName: outputName, byteLength: bytes.byteLength, url };
}

function toExactArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
