export function exportName(inputName: string | null) {
  const base = inputName ? inputName.replace(/\.[^.]+$/, "") : "model";
  return `${base}-filled.3mf`;
}

export function isStlFile(file: File) {
  return file.name.toLowerCase().endsWith(".stl");
}
