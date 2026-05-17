import { useCallback, useState } from 'react'
import { BufferGeometry, BufferAttribute } from 'three'
import { parseSTL } from '../geometry/stl/parser'
import { normalizeGeometry } from '../geometry/stl/normalize'
import { useStore } from '../store/useStore'

export function DropZone() {
  const phase = useStore(s => s.phase)
  const loadModel = useStore(s => s.loadModel)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const processFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.stl')) {
      setError('Please drop an STL file.')
      return
    }
    setError(null)
    const buffer = await file.arrayBuffer()
    const rawPositions = parseSTL(buffer)
    const normalized = normalizeGeometry(rawPositions)

    // Build a three.js BufferGeometry from the indexed mesh
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(normalized.positions, 3))
    geo.setIndex(new BufferAttribute(normalized.indices, 1))
    geo.computeVertexNormals()

    loadModel(file.name, normalized, geo)
  }, [loadModel])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  if (phase !== 'idle') return null

  return (
    <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
      <label
        className={`
          pointer-events-auto flex flex-col items-center justify-center gap-3
          w-80 h-52 rounded-xl border-2 border-dashed cursor-pointer
          transition-colors duration-150
          ${dragging
            ? 'border-blue-400 bg-slate-800/90'
            : 'border-slate-600 bg-slate-900/80 hover:border-slate-400'}
        `}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <div className="text-center">
          <p className="text-sm text-slate-300">Drop an STL file here</p>
          <p className="text-xs text-slate-500 mt-1">or click to browse</p>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <input type="file" accept=".stl" className="sr-only" onChange={onInputChange} />
      </label>
    </div>
  )
}
