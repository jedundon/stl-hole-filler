import { useStore } from '../store/useStore'
import type { Selection } from '../types'

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f43f5e', '#a3e635',
]

interface Props {
  sel: Selection
}

export function HoleCard({ sel }: Props) {
  const update = useStore(s => s.updateSelection)
  const remove = useStore(s => s.removeSelection)

  return (
    <div className="group relative rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5">
      <div className="flex items-center gap-2">
        {/* Color picker */}
        <div className="relative flex items-center">
          <input
            type="color"
            value={sel.color}
            onChange={e => update(sel.id, { color: e.target.value })}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            title="Change fill color"
          />
          <span
            className="w-4 h-4 rounded-full border border-slate-600 shrink-0"
            style={{ backgroundColor: sel.color }}
          />
        </div>

        {/* Label */}
        <input
          value={sel.label}
          onChange={e => update(sel.id, { label: e.target.value })}
          className="flex-1 bg-transparent text-sm text-white outline-none focus:underline min-w-0"
        />

        {/* Visibility toggle */}
        <button
          onClick={() => update(sel.id, { visible: !sel.visible })}
          className="text-slate-500 hover:text-slate-300 transition-colors"
          title={sel.visible ? 'Hide' : 'Show'}
        >
          {sel.visible ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          )}
        </button>

        {/* Delete */}
        <button
          onClick={() => remove(sel.id)}
          className="text-slate-600 hover:text-red-400 transition-colors"
          title="Remove fill"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="mt-2 text-xs text-slate-500">
        Depth: {sel.depth.toFixed(2)} mm &nbsp;·&nbsp; {sel.faceIndices.length} faces
      </div>
    </div>
  )
}
