import { useStore } from '../store/useStore'
import { HoleCard } from './HoleCard'

export function HolesPanel() {
  const phase = useStore(s => s.phase)
  const selections = useStore(s => s.selections)

  if (phase !== 'loaded') return null

  return (
    <aside className="w-64 bg-slate-900 border-l border-slate-700 flex flex-col shrink-0">
      <div className="px-3 py-2.5 border-b border-slate-700">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Fills
          {selections.length > 0 && (
            <span className="ml-2 text-slate-500 normal-case font-normal">
              {selections.length}
            </span>
          )}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {selections.length === 0 ? (
          <p className="text-xs text-slate-500 text-center mt-8 px-4 leading-relaxed">
            Click a recessed surface on the model to add a fill
          </p>
        ) : (
          selections.map(sel => <HoleCard key={sel.id} sel={sel} />)
        )}
      </div>

      {selections.length > 0 && (
        <div className="px-3 py-2 border-t border-slate-700">
          <p className="text-xs text-slate-500">
            Each fill becomes a separate part in the exported 3MF. Assign different colors in your slicer for multi-color printing.
          </p>
        </div>
      )}
    </aside>
  )
}
