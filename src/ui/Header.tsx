import { useStore } from '../store/useStore'
import { write3MF } from '../export/writer3mf'
import { BufferGeometry, BufferAttribute } from 'three'

export function Header() {
  const phase = useStore(s => s.phase)
  const fileName = useStore(s => s.fileName)
  const selections = useStore(s => s.selections)
  const threeGeometry = useStore(s => s.threeGeometry)
  const resetModel = useStore(s => s.resetModel)
  const setPhase = useStore(s => s.setPhase)

  const canExport = phase === 'loaded' && selections.some(s => s.fillGeometry)

  const handleExport = async () => {
    if (!threeGeometry || !canExport) return
    setPhase('exporting')
    try {
      // Convert indexed geometry to non-indexed for the body part
      const bodyGeo = threeGeometry.toNonIndexed()
      const parts = [
        { id: 1, name: 'Body', geometry: bodyGeo },
        ...selections
          .filter(s => s.fillGeometry)
          .map((s, i) => ({ id: i + 2, name: s.label, geometry: s.fillGeometry! })),
      ]
      const bytes = await write3MF(parts)
      const blob = new Blob([bytes], { type: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName.replace(/\.stl$/i, '') + '_filled.3mf'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setPhase('loaded')
    }
  }

  return (
    <header className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 shrink-0">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-white text-sm tracking-tight">STL Hole Filler</span>
        {fileName && (
          <span className="text-slate-400 text-xs truncate max-w-xs">{fileName}</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {phase === 'loaded' && (
          <button
            onClick={resetModel}
            className="px-3 py-1 text-xs rounded text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        )}
        <button
          onClick={handleExport}
          disabled={!canExport || phase === 'exporting'}
          className="px-4 py-1.5 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {phase === 'exporting' ? 'Exporting…' : 'Export 3MF'}
        </button>
      </div>
    </header>
  )
}
