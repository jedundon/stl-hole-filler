export const selectionPalette = [
  "#e24d42",
  "#2f80ed",
  "#18a058",
  "#d88a1d",
  "#8b5cf6",
  "#0f9ea8",
  "#d53f8c",
  "#667085",
];

export function colorForIndex(index: number) {
  return selectionPalette[index % selectionPalette.length];
}
