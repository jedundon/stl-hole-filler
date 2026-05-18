export function exportName(inputName: string | null) {
  const base = inputName ? inputName.replace(/\.[^.]+$/, "") : "model";
  return `${base}-filled.3mf`;
}

export function zipExportName() {
  return "filled-stl-batch.zip";
}

export function uniqueExportName(inputName: string, usedNames: Set<string>) {
  const preferred = exportName(inputName);
  if (!usedNames.has(preferred)) {
    usedNames.add(preferred);
    return preferred;
  }

  const base = preferred.replace(/\.3mf$/i, "");
  let suffix = 2;
  let candidate = `${base}-${suffix}.3mf`;
  while (usedNames.has(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}.3mf`;
  }
  usedNames.add(candidate);
  return candidate;
}

export function isStlFile(file: File) {
  return file.name.toLowerCase().endsWith(".stl");
}
