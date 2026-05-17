import { create } from "zustand";
import type { ExportArtifact, MeshData, Selection, Toast } from "../types";
import { detectRecessSelection, detectSimilarSelectionsOnPlane } from "../geometry/recess/detect";
import { normalizeMesh } from "../geometry/stl/normalize";
import { parseStl } from "../geometry/stl/parser";
import { exportSelections } from "../export/exportFlow";
import { isStlFile } from "../lib/filename";

interface AppState {
  fileName: string | null;
  mesh: MeshData | null;
  selections: Selection[];
  selectionHistoryPast: Selection[][];
  selectionHistoryFuture: Selection[][];
  selectionHistoryGroupKey: string | null;
  hoverFaceIndex: number | null;
  defaultDepth: number;
  isLoading: boolean;
  isExporting: boolean;
  warning: string | null;
  toast: Toast | null;
  exportArtifact: ExportArtifact | null;
  loadFile: (file: File) => Promise<void>;
  addSelectionFromFace: (faceIndex: number, point?: [number, number, number]) => void;
  addSimilarSelectionsOnPlane: () => void;
  removeSelection: (id: string) => void;
  updateSelection: (id: string, patch: Partial<Selection>) => void;
  applyDepthToVisibleSelections: (depth: number) => void;
  undoSelectionChange: () => void;
  redoSelectionChange: () => void;
  setDefaultDepth: (depth: number) => void;
  setHoverFaceIndex: (faceIndex: number | null) => void;
  exportToFile: () => Promise<void>;
  reset: () => void;
  clearToast: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  fileName: null,
  mesh: null,
  selections: [],
  selectionHistoryPast: [],
  selectionHistoryFuture: [],
  selectionHistoryGroupKey: null,
  hoverFaceIndex: null,
  defaultDepth: 2,
  isLoading: false,
  isExporting: false,
  warning: null,
  toast: null,
  exportArtifact: null,

  async loadFile(file) {
    if (!isStlFile(file)) {
      setToast(set, "Please choose an STL file.", "error");
      return;
    }
    revokeExportArtifact(get().exportArtifact);
    set({
      isLoading: true,
      warning: null,
      selections: [],
      selectionHistoryPast: [],
      selectionHistoryFuture: [],
      selectionHistoryGroupKey: null,
      mesh: null,
      fileName: file.name,
      exportArtifact: null,
    });
    try {
      const raw = parseStl(await file.arrayBuffer());
      const mesh = normalizeMesh(raw);
      const warning =
        mesh.triangleCount > 1_000_000
          ? `This model has ${formatNumber(mesh.triangleCount)} triangles. Performance may be slow.`
          : null;
      set({ mesh, warning, isLoading: false });
      setToast(set, "Model loaded. Click a recessed flat area to add a fill.", "success");
    } catch (error) {
      console.error(error);
      set({
        isLoading: false,
        mesh: null,
        selections: [],
        selectionHistoryPast: [],
        selectionHistoryFuture: [],
        selectionHistoryGroupKey: null,
        fileName: null,
      });
      setToast(set, "Could not read that STL. Try a valid binary or ASCII STL.", "error");
    }
  },

  addSelectionFromFace(faceIndex, point) {
    const { mesh, selections, defaultDepth } = get();
    if (!mesh) {
      return;
    }

    const existing = selections.find((selection) => selection.faceIndices.includes(faceIndex));
    if (existing) {
      commitSelectionChange(set, get, selections.filter((selection) => selection.id !== existing.id));
      return;
    }

    const selection = detectRecessSelection(mesh, faceIndex, selections.length, defaultDepth, point);
    if (!selection) {
      setToast(set, "Could not find a recessed region there. Try the center of a flat-bottomed pocket.", "warning");
      return;
    }
    commitSelectionChange(set, get, [...selections, selection]);
  },

  addSimilarSelectionsOnPlane() {
    const { mesh, selections, defaultDepth } = get();
    const reference = selections[selections.length - 1];
    if (!mesh || !reference) {
      setToast(set, "Select one recessed area first.", "warning");
      return;
    }

    const matches = detectSimilarSelectionsOnPlane(mesh, reference, selections, defaultDepth);
    if (matches.length === 0) {
      setToast(set, "No other matching recessed regions found on that plane.", "warning");
      return;
    }

    commitSelectionChange(set, get, [...selections, ...matches]);
    setToast(set, `Added ${matches.length} similar ${matches.length === 1 ? "fill" : "fills"} on this plane.`, "success");
  },

  removeSelection(id) {
    const { selections } = get();
    const nextSelections = selections.filter((selection) => selection.id !== id);
    if (nextSelections.length === selections.length) {
      return;
    }
    commitSelectionChange(set, get, nextSelections);
  },

  updateSelection(id, patch) {
    const { selections } = get();
    let changed = false;
    const nextSelections = selections.map((selection) => {
      if (selection.id !== id) {
        return selection;
      }
      const nextSelection = { ...selection, ...patch };
      changed = Object.keys(patch).some((key) => {
        const selectionKey = key as keyof Selection;
        return selection[selectionKey] !== nextSelection[selectionKey];
      });
      return changed ? nextSelection : selection;
    });
    if (!changed) {
      return;
    }
    commitSelectionChange(set, get, nextSelections, `update:${id}:${Object.keys(patch).sort().join(",")}`);
  },

  applyDepthToVisibleSelections(depth) {
    const nextDepth = clampDepth(depth);
    const { selections } = get();
    let changed = false;
    const nextSelections = selections.map((selection) => {
      if (!selection.visible || selection.depth === nextDepth) {
        return selection;
      }
      changed = true;
      return { ...selection, depth: nextDepth };
    });
    if (!changed) {
      setToast(set, "No visible fills needed that depth change.", "info");
      return;
    }
    commitSelectionChange(set, get, nextSelections);
    setToast(set, `Applied ${nextDepth.toFixed(1)} mm depth to visible fills.`, "success");
  },

  undoSelectionChange() {
    const { selectionHistoryPast, selectionHistoryFuture, selections } = get();
    const previousSelections = selectionHistoryPast[selectionHistoryPast.length - 1];
    if (!previousSelections) {
      return;
    }
    revokeExportArtifact(get().exportArtifact);
    set({
      selections: previousSelections,
      selectionHistoryPast: selectionHistoryPast.slice(0, -1),
      selectionHistoryFuture: [selections, ...selectionHistoryFuture],
      selectionHistoryGroupKey: null,
      exportArtifact: null,
    });
  },

  redoSelectionChange() {
    const { selectionHistoryPast, selectionHistoryFuture, selections } = get();
    const nextSelections = selectionHistoryFuture[0];
    if (!nextSelections) {
      return;
    }
    revokeExportArtifact(get().exportArtifact);
    set({
      selections: nextSelections,
      selectionHistoryPast: [...selectionHistoryPast, selections],
      selectionHistoryFuture: selectionHistoryFuture.slice(1),
      selectionHistoryGroupKey: null,
      exportArtifact: null,
    });
  },

  setDefaultDepth(depth) {
    set({ defaultDepth: clampDepth(depth) });
  },

  setHoverFaceIndex(faceIndex) {
    set({ hoverFaceIndex: faceIndex });
  },

  async exportToFile() {
    const { mesh, selections, fileName, exportArtifact } = get();
    if (!mesh || selections.length === 0) {
      setToast(set, "Add at least one fill before exporting.", "warning");
      return;
    }
    set({ isExporting: true });
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const artifact = await exportSelections(mesh, selections, fileName, exportArtifact);
      set({ exportArtifact: artifact });
      setToast(set, `3MF ready: ${artifact.fileName} (${formatBytes(artifact.byteLength)}).`, "success");
    } catch (error) {
      console.error(error);
      setToast(set, "Export failed. The model may be too large for this browser session.", "error");
    } finally {
      set({ isExporting: false });
    }
  },

  reset() {
    revokeExportArtifact(get().exportArtifact);
    set({
      fileName: null,
      mesh: null,
      selections: [],
      selectionHistoryPast: [],
      selectionHistoryFuture: [],
      selectionHistoryGroupKey: null,
      hoverFaceIndex: null,
      warning: null,
      toast: null,
      exportArtifact: null,
      isLoading: false,
      isExporting: false,
    });
  },

  clearToast() {
    set({ toast: null });
  },
}));

const MAX_SELECTION_HISTORY = 50;

function commitSelectionChange(
  set: (state: Partial<AppState>) => void,
  get: () => AppState,
  selections: Selection[],
  groupKey: string | null = null,
) {
  const state = get();
  const selectionHistoryPast =
    groupKey && groupKey === state.selectionHistoryGroupKey
      ? state.selectionHistoryPast
      : [...state.selectionHistoryPast.slice(-(MAX_SELECTION_HISTORY - 1)), state.selections];
  revokeExportArtifact(state.exportArtifact);
  set({
    selections,
    selectionHistoryPast,
    selectionHistoryFuture: [],
    selectionHistoryGroupKey: groupKey,
    exportArtifact: null,
  });
}

function clampDepth(value: number) {
  return Math.max(0.1, Math.min(40, Number.isFinite(value) ? value : 2));
}

function setToast(
  set: (state: Partial<AppState>) => void,
  message: string,
  tone: Toast["tone"] = "info",
) {
  const toast = { id: crypto.randomUUID(), message, tone };
  set({ toast });
  window.setTimeout(() => {
    useAppStore.setState((state) => (state.toast?.id === toast.id ? { toast: null } : state));
  }, 3600);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function revokeExportArtifact(artifact: ExportArtifact | null) {
  if (artifact) {
    URL.revokeObjectURL(artifact.url);
  }
}
