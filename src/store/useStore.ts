import { create } from 'zustand'
import type { BufferGeometry } from 'three'
import type { AppPhase, NormalizedGeometry, Selection } from '../types'

const PALETTE = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6',
]

interface StoreState {
  phase: AppPhase
  fileName: string
  rawGeometry: NormalizedGeometry | null
  threeGeometry: BufferGeometry | null  // three.js BufferGeometry for rendering
  selections: Selection[]
  hoveredFaceIdx: number | null

  loadModel: (fileName: string, raw: NormalizedGeometry, three: BufferGeometry) => void
  resetModel: () => void
  addSelection: (sel: Omit<Selection, 'id' | 'label' | 'color'>) => void
  removeSelection: (id: string) => void
  updateSelection: (id: string, patch: Partial<Pick<Selection, 'label' | 'color' | 'visible' | 'depth' | 'fillGeometry'>>) => void
  setHoveredFace: (idx: number | null) => void
  setPhase: (phase: AppPhase) => void
}

export const useStore = create<StoreState>((set, get) => ({
  phase: 'idle',
  fileName: '',
  rawGeometry: null,
  threeGeometry: null,
  selections: [],
  hoveredFaceIdx: null,

  loadModel: (fileName, raw, three) =>
    set({ phase: 'loaded', fileName, rawGeometry: raw, threeGeometry: three, selections: [] }),

  resetModel: () =>
    set({ phase: 'idle', fileName: '', rawGeometry: null, threeGeometry: null, selections: [] }),

  addSelection: (sel) => {
    const { selections } = get()
    const n = selections.length
    const id = `sel_${Date.now()}_${n}`
    const label = `Fill ${n + 1}`
    const color = PALETTE[n % PALETTE.length]
    set({ selections: [...selections, { ...sel, id, label, color }] })
  },

  removeSelection: (id) =>
    set(s => ({ selections: s.selections.filter(sel => sel.id !== id) })),

  updateSelection: (id, patch) =>
    set(s => ({
      selections: s.selections.map(sel => sel.id === id ? { ...sel, ...patch } : sel),
    })),

  setHoveredFace: (idx) => set({ hoveredFaceIdx: idx }),

  setPhase: (phase) => set({ phase }),
}))
