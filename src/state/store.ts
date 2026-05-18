import { create } from "zustand";
import type {
  BatchItem,
  DetectionProfile,
  ExportArtifact,
  MeshData,
  Selection,
  SelectionHistory,
  Toast,
} from "../types";
import {
  applyDetectionProfile,
  buildDetectionProfile,
  detectRecessSelection,
  detectSimilarSelectionsOnPlane,
} from "../geometry/recess/detect";
import { normalizeMesh } from "../geometry/stl/normalize";
import { parseStl } from "../geometry/stl/parser";
import {
  build3mfArtifact,
  buildBatchZipArtifact,
  downloadArtifact,
} from "../export/exportFlow";
import { isStlFile } from "../lib/filename";

interface AppState {
  items: BatchItem[];
  activeItemId: string | null;
  profile: DetectionProfile | null;
  batchExportArtifact: ExportArtifact | null;

  fileName: string | null;
  mesh: MeshData | null;
  selections: Selection[];
  selectionHistoryPast: Selection[][];
  selectionHistoryFuture: Selection[][];
  selectionHistoryGroupKey: string | null;
  isBatchEditing: boolean;
  checkedSelectionIds: string[];
  hoverFaceIndex: number | null;
  defaultDepth: number;
  isLoading: boolean;
  isDetecting: boolean;
  isExporting: boolean;
  isBatchExporting: boolean;
  warning: string | null;
  toast: Toast | null;
  exportArtifact: ExportArtifact | null;

  loadFile: (file: File) => Promise<void>;
  loadFiles: (files: FileList | File[]) => Promise<void>;
  setActiveItem: (id: string) => void;
  buildProfileFromSelections: () => void;
  runBatchDetection: () => Promise<void>;
  markActiveItemReviewed: () => void;
  addSelectionFromFace: (faceIndex: number, point?: [number, number, number]) => void;
  addSimilarSelectionsOnPlane: () => void;
  removeSelection: (id: string) => void;
  updateSelection: (id: string, patch: Partial<Selection>) => void;
  enterBatchEditing: () => void;
  exitBatchEditing: () => void;
  toggleCheckedSelection: (id: string) => void;
  selectAllSelections: () => void;
  selectNoSelections: () => void;
  invertCheckedSelections: () => void;
  applyDepthToCheckedSelections: (depth: number) => void;
  updateCheckedSelections: (patch: Partial<Selection>) => void;
  removeCheckedSelections: () => void;
  undoSelectionChange: () => void;
  redoSelectionChange: () => void;
  setDefaultDepth: (depth: number) => void;
  setHoverFaceIndex: (faceIndex: number | null) => void;
  exportToFile: () => Promise<void>;
  exportAllToZip: () => Promise<void>;
  reset: () => void;
  clearToast: () => void;
}

const emptyHistory = (): SelectionHistory => ({ past: [], future: [], groupKey: null });

export const useAppStore = create<AppState>((set, get) => ({
  items: [],
  activeItemId: null,
  profile: null,
  batchExportArtifact: null,

  fileName: null,
  mesh: null,
  selections: [],
  selectionHistoryPast: [],
  selectionHistoryFuture: [],
  selectionHistoryGroupKey: null,
  isBatchEditing: false,
  checkedSelectionIds: [],
  hoverFaceIndex: null,
  defaultDepth: 2,
  isLoading: false,
  isDetecting: false,
  isExporting: false,
  isBatchExporting: false,
  warning: null,
  toast: null,
  exportArtifact: null,

  async loadFile(file) {
    await get().loadFiles([file]);
  },

  async loadFiles(fileList) {
    const files = Array.from(fileList);
    if (files.length === 0) {
      return;
    }

    revokeAllArtifacts(get());
    set({
      items: files.map((file) => makeLoadingItem(file.name)),
      activeItemId: null,
      profile: null,
      batchExportArtifact: null,
      isLoading: true,
      isBatchEditing: false,
      hoverFaceIndex: null,
      ...activeSnapshot(null),
    });

    const items: BatchItem[] = [];
    for (const file of files) {
      items.push(await loadBatchItem(file));
    }

    const activeItem = items.find((item) => item.mesh) ?? items[0] ?? null;
    set({
      items,
      activeItemId: activeItem?.id ?? null,
      isLoading: false,
      isBatchEditing: false,
      ...activeSnapshot(activeItem),
    });

    const readyCount = items.filter((item) => item.mesh).length;
    const errorCount = items.length - readyCount;
    if (readyCount > 0) {
      setToast(
        set,
        readyCount === 1
          ? "Model loaded. Click recessed areas or build a batch profile."
          : `${readyCount} STL files loaded. Review a sample, build a profile, then run batch detection.`,
        "success",
      );
    }
    if (errorCount > 0) {
      setToast(set, `${errorCount} ${errorCount === 1 ? "file could" : "files could"} not be loaded.`, "warning");
    }
  },

  setActiveItem(id) {
    const item = get().items.find((candidate) => candidate.id === id) ?? null;
    if (!item) {
      return;
    }
    set({
      activeItemId: id,
      isBatchEditing: false,
      hoverFaceIndex: null,
      ...activeSnapshot(item),
    });
  },

  buildProfileFromSelections() {
    const samples = get().items.flatMap((item) =>
      item.mesh ? item.selections.map((selection) => ({ mesh: item.mesh!, selection })) : [],
    );
    const profile = buildDetectionProfile(samples);
    if (!profile) {
      setToast(set, "Select and review at least one fill before building a profile.", "warning");
      return;
    }
    set({ profile, batchExportArtifact: null });
    setToast(set, `Profile updated from ${profile.sourceSelectionCount} reviewed ${profile.sourceSelectionCount === 1 ? "fill" : "fills"}.`, "success");
  },

  async runBatchDetection() {
    const { profile } = get();
    if (!profile) {
      setToast(set, "Build a profile from reviewed fills first.", "warning");
      return;
    }

    set({ isDetecting: true });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const previousItems = get().items;
    const nextItems = previousItems.map((item) => {
      if (!item.mesh || item.status === "error") {
        return item;
      }

      const result = applyDetectionProfile(item.mesh, profile, item.selections);
      if (result.selections.length === 0) {
        return {
          ...item,
          status: item.selections.length > 0 ? ("review" as const) : ("ready" as const),
          warnings: [...meshWarnings(item.mesh), ...result.warnings],
        };
      }

      revokeExportArtifact(item.exportArtifact);
      const selections = [...item.selections, ...result.selections];
      return {
        ...item,
        selections,
        history: {
          past: [...item.history.past.slice(-(MAX_SELECTION_HISTORY - 1)), item.selections],
          future: [],
          groupKey: null,
        },
        checkedSelectionIds: pruneCheckedSelectionIds(item.checkedSelectionIds, selections),
        status: "review" as const,
        warnings: meshWarnings(item.mesh),
        exportArtifact: null,
      };
    });

    const activeItem = findActiveItem(nextItems, get().activeItemId);
    set({
      items: nextItems,
      isDetecting: false,
      batchExportArtifact: null,
      ...activeSnapshot(activeItem),
    });

    const added = nextItems.reduce((sum, item, index) => sum + Math.max(0, item.selections.length - previousItems[index].selections.length), 0);
    setToast(
      set,
      added > 0
        ? `Batch detection added ${added} ${added === 1 ? "fill" : "fills"} across the queue.`
        : "Batch detection finished without adding new fills.",
      added > 0 ? "success" : "warning",
    );
  },

  markActiveItemReviewed() {
    const item = activeItem(get());
    if (!item) {
      return;
    }
    if (item.selections.length === 0) {
      setToast(set, "Add at least one fill before marking this file reviewed.", "warning");
      return;
    }
    replaceActiveItem(set, get, { ...item, status: "reviewed" });
    setToast(set, `${item.fileName} marked reviewed.`, "success");
  },

  addSelectionFromFace(faceIndex, point) {
    const item = activeItem(get());
    if (!item?.mesh) {
      return;
    }

    const existing = item.selections.find((selection) => selection.faceIndices.includes(faceIndex));
    if (existing) {
      commitSelectionChange(set, get, item.selections.filter((selection) => selection.id !== existing.id));
      return;
    }

    const selection = detectRecessSelection(item.mesh, faceIndex, item.selections.length, get().defaultDepth, point);
    if (!selection) {
      setToast(set, "Could not find a recessed region there. Try the center of a flat-bottomed pocket.", "warning");
      return;
    }
    commitSelectionChange(set, get, [...item.selections, selection]);
  },

  addSimilarSelectionsOnPlane() {
    const item = activeItem(get());
    const reference = item?.selections[item.selections.length - 1];
    if (!item?.mesh || !reference) {
      setToast(set, "Select one recessed area first.", "warning");
      return;
    }

    const matches = detectSimilarSelectionsOnPlane(item.mesh, reference, item.selections, get().defaultDepth);
    if (matches.length === 0) {
      setToast(set, "No other matching recessed regions found on that plane.", "warning");
      return;
    }

    commitSelectionChange(set, get, [...item.selections, ...matches]);
    setToast(set, `Added ${matches.length} similar ${matches.length === 1 ? "fill" : "fills"} on this plane.`, "success");
  },

  removeSelection(id) {
    const item = activeItem(get());
    if (!item) {
      return;
    }
    const nextSelections = item.selections.filter((selection) => selection.id !== id);
    if (nextSelections.length === item.selections.length) {
      return;
    }
    commitSelectionChange(set, get, nextSelections, null, { removeCheckedIds: [id] });
  },

  updateSelection(id, patch) {
    const item = activeItem(get());
    if (!item) {
      return;
    }
    let changed = false;
    const nextSelections = item.selections.map((selection) => {
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

  enterBatchEditing() {
    replaceActiveCheckedIds(set, get, []);
    set({ isBatchEditing: true, checkedSelectionIds: [] });
  },

  exitBatchEditing() {
    replaceActiveCheckedIds(set, get, []);
    set({ isBatchEditing: false, checkedSelectionIds: [] });
  },

  toggleCheckedSelection(id) {
    const item = activeItem(get());
    if (!item?.selections.some((selection) => selection.id === id)) {
      return;
    }
    const checkedSelectionIds = item.checkedSelectionIds.includes(id)
      ? item.checkedSelectionIds.filter((checkedId) => checkedId !== id)
      : [...item.checkedSelectionIds, id];
    replaceActiveCheckedIds(set, get, checkedSelectionIds);
  },

  selectAllSelections() {
    const item = activeItem(get());
    replaceActiveCheckedIds(set, get, item?.selections.map((selection) => selection.id) ?? []);
  },

  selectNoSelections() {
    replaceActiveCheckedIds(set, get, []);
  },

  invertCheckedSelections() {
    const item = activeItem(get());
    if (!item) {
      return;
    }
    const checkedIds = new Set(item.checkedSelectionIds);
    replaceActiveCheckedIds(
      set,
      get,
      item.selections.map((selection) => selection.id).filter((id) => !checkedIds.has(id)),
    );
  },

  applyDepthToCheckedSelections(depth) {
    updateCheckedSelections(set, get, { depth: clampDepth(depth) }, "No checked fills needed that depth change.");
  },

  updateCheckedSelections(patch) {
    updateCheckedSelections(set, get, patch, "No checked fills needed that change.");
  },

  removeCheckedSelections() {
    const item = activeItem(get());
    if (!item) {
      return;
    }
    const checkedIds = new Set(item.checkedSelectionIds);
    const nextSelections = item.selections.filter((selection) => !checkedIds.has(selection.id));
    if (nextSelections.length === item.selections.length) {
      return;
    }
    commitSelectionChange(set, get, nextSelections, null, { removeCheckedIds: item.checkedSelectionIds });
    setToast(set, `Deleted ${item.selections.length - nextSelections.length} checked ${item.selections.length - nextSelections.length === 1 ? "fill" : "fills"}.`, "success");
  },

  undoSelectionChange() {
    const item = activeItem(get());
    const previousSelections = item?.history.past[item.history.past.length - 1];
    if (!item || !previousSelections) {
      return;
    }
    revokeExportArtifact(item.exportArtifact);
    replaceActiveItem(set, get, {
      ...item,
      selections: previousSelections,
      history: {
        past: item.history.past.slice(0, -1),
        future: [item.selections, ...item.history.future],
        groupKey: null,
      },
      checkedSelectionIds: pruneCheckedSelectionIds(item.checkedSelectionIds, previousSelections),
      status: "review",
      exportArtifact: null,
    });
  },

  redoSelectionChange() {
    const item = activeItem(get());
    const nextSelections = item?.history.future[0];
    if (!item || !nextSelections) {
      return;
    }
    revokeExportArtifact(item.exportArtifact);
    replaceActiveItem(set, get, {
      ...item,
      selections: nextSelections,
      history: {
        past: [...item.history.past, item.selections],
        future: item.history.future.slice(1),
        groupKey: null,
      },
      checkedSelectionIds: pruneCheckedSelectionIds(item.checkedSelectionIds, nextSelections),
      status: "review",
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
    const item = activeItem(get());
    if (!item?.mesh || item.selections.length === 0) {
      setToast(set, "Add at least one fill before exporting.", "warning");
      return;
    }
    set({ isExporting: true });
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const artifact = build3mfArtifact(
        { mesh: item.mesh, selections: item.selections, fileName: item.fileName },
        item.exportArtifact,
      );
      downloadArtifact(artifact);
      replaceActiveItem(set, get, { ...item, exportArtifact: artifact, status: "exported" });
      setToast(set, `3MF ready: ${artifact.fileName} (${formatBytes(artifact.byteLength)}).`, "success");
    } catch (error) {
      console.error(error);
      setToast(set, "Export failed. The model may be too large for this browser session.", "error");
    } finally {
      set({ isExporting: false });
    }
  },

  async exportAllToZip() {
    const eligible = get().items.filter((item) => item.mesh && item.selections.length > 0 && (item.status === "reviewed" || item.status === "exported"));
    if (eligible.length === 0) {
      setToast(set, "Mark at least one filled file reviewed before exporting a ZIP.", "warning");
      return;
    }
    set({ isBatchExporting: true });
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const artifact = buildBatchZipArtifact(get().items, get().batchExportArtifact);
      downloadArtifact(artifact);
      set({ batchExportArtifact: artifact });
      setToast(set, `ZIP ready: ${artifact.fileName} (${formatBytes(artifact.byteLength)}).`, "success");
    } catch (error) {
      console.error(error);
      setToast(set, "Batch ZIP export failed.", "error");
    } finally {
      set({ isBatchExporting: false });
    }
  },

  reset() {
    revokeAllArtifacts(get());
    set({
      items: [],
      activeItemId: null,
      profile: null,
      batchExportArtifact: null,
      fileName: null,
      mesh: null,
      selections: [],
      selectionHistoryPast: [],
      selectionHistoryFuture: [],
      selectionHistoryGroupKey: null,
      isBatchEditing: false,
      checkedSelectionIds: [],
      hoverFaceIndex: null,
      warning: null,
      toast: null,
      exportArtifact: null,
      isLoading: false,
      isDetecting: false,
      isExporting: false,
      isBatchExporting: false,
    });
  },

  clearToast() {
    set({ toast: null });
  },
}));

const MAX_SELECTION_HISTORY = 50;

async function loadBatchItem(file: File): Promise<BatchItem> {
  if (!isStlFile(file)) {
    return makeErrorItem(file.name, "Please choose an STL file.");
  }

  try {
    const raw = parseStl(await file.arrayBuffer());
    const mesh = normalizeMesh(raw);
    return {
      id: crypto.randomUUID(),
      fileName: file.name,
      mesh,
      selections: [],
      history: emptyHistory(),
      checkedSelectionIds: [],
      status: "ready",
      warnings: meshWarnings(mesh),
      error: null,
      exportArtifact: null,
    };
  } catch (error) {
    console.error(error);
    return makeErrorItem(file.name, "Could not read that STL. Try a valid binary or ASCII STL.");
  }
}

function makeLoadingItem(fileName: string): BatchItem {
  return {
    id: crypto.randomUUID(),
    fileName,
    mesh: null,
    selections: [],
    history: emptyHistory(),
    checkedSelectionIds: [],
    status: "loading",
    warnings: [],
    error: null,
    exportArtifact: null,
  };
}

function makeErrorItem(fileName: string, error: string): BatchItem {
  return {
    id: crypto.randomUUID(),
    fileName,
    mesh: null,
    selections: [],
    history: emptyHistory(),
    checkedSelectionIds: [],
    status: "error",
    warnings: [],
    error,
    exportArtifact: null,
  };
}

function commitSelectionChange(
  set: (state: Partial<AppState>) => void,
  get: () => AppState,
  selections: Selection[],
  groupKey: string | null = null,
  options: { removeCheckedIds?: string[] } = {},
) {
  const item = activeItem(get());
  if (!item) {
    return;
  }

  const removedCheckedIds = new Set(options.removeCheckedIds ?? []);
  const historyPast =
    groupKey && groupKey === item.history.groupKey
      ? item.history.past
      : [...item.history.past.slice(-(MAX_SELECTION_HISTORY - 1)), item.selections];
  revokeExportArtifact(item.exportArtifact);

  replaceActiveItem(set, get, {
    ...item,
    selections,
    history: {
      past: historyPast,
      future: [],
      groupKey,
    },
    checkedSelectionIds: pruneCheckedSelectionIds(
      item.checkedSelectionIds.filter((id) => !removedCheckedIds.has(id)),
      selections,
    ),
    status: "review",
    exportArtifact: null,
  });
}

function updateCheckedSelections(
  set: (state: Partial<AppState>) => void,
  get: () => AppState,
  patch: Partial<Selection>,
  unchangedMessage: string,
) {
  const item = activeItem(get());
  if (!item) {
    return;
  }
  const checkedIds = new Set(item.checkedSelectionIds);
  if (checkedIds.size === 0) {
    setToast(set, "Check at least one fill first.", "warning");
    return;
  }

  let changed = false;
  const nextSelections = item.selections.map((selection) => {
    if (!checkedIds.has(selection.id)) {
      return selection;
    }
    const nextSelection = { ...selection, ...patch };
    const selectionChanged = Object.keys(patch).some((key) => {
      const selectionKey = key as keyof Selection;
      return selection[selectionKey] !== nextSelection[selectionKey];
    });
    changed = changed || selectionChanged;
    return selectionChanged ? nextSelection : selection;
  });

  if (!changed) {
    setToast(set, unchangedMessage, "info");
    return;
  }

  commitSelectionChange(set, get, nextSelections);
}

function replaceActiveCheckedIds(
  set: (state: Partial<AppState>) => void,
  get: () => AppState,
  checkedSelectionIds: string[],
) {
  const item = activeItem(get());
  if (!item) {
    return;
  }
  replaceActiveItem(set, get, { ...item, checkedSelectionIds });
}

function replaceActiveItem(
  set: (state: Partial<AppState>) => void,
  get: () => AppState,
  item: BatchItem,
) {
  const state = get();
  const items = state.items.map((candidate) => (candidate.id === item.id ? item : candidate));
  set({
    items,
    activeItemId: item.id,
    batchExportArtifact: item.status === "review" ? null : state.batchExportArtifact,
    ...activeSnapshot(item),
  });
}

function activeItem(state: AppState) {
  return findActiveItem(state.items, state.activeItemId);
}

function findActiveItem(items: BatchItem[], activeItemId: string | null) {
  return items.find((item) => item.id === activeItemId) ?? null;
}

function activeSnapshot(item: BatchItem | null) {
  const warning = item ? [...item.warnings, item.error].filter(Boolean).join(" ") || null : null;
  return {
    fileName: item?.fileName ?? null,
    mesh: item?.mesh ?? null,
    selections: item?.selections ?? [],
    selectionHistoryPast: item?.history.past ?? [],
    selectionHistoryFuture: item?.history.future ?? [],
    selectionHistoryGroupKey: item?.history.groupKey ?? null,
    checkedSelectionIds: item?.checkedSelectionIds ?? [],
    exportArtifact: item?.exportArtifact ?? null,
    warning,
  };
}

function meshWarnings(mesh: MeshData) {
  return mesh.triangleCount > 1_000_000
    ? [`This model has ${formatNumber(mesh.triangleCount)} triangles. Performance may be slow.`]
    : [];
}

function pruneCheckedSelectionIds(checkedSelectionIds: string[], selections: Selection[]) {
  const selectionIds = new Set(selections.map((selection) => selection.id));
  return checkedSelectionIds.filter((id) => selectionIds.has(id));
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

function revokeAllArtifacts(state: AppState) {
  state.items.forEach((item) => revokeExportArtifact(item.exportArtifact));
  revokeExportArtifact(state.batchExportArtifact);
}

function revokeExportArtifact(artifact: ExportArtifact | null) {
  if (artifact) {
    URL.revokeObjectURL(artifact.url);
  }
}
