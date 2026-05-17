import { Header } from './ui/Header'
import { DropZone } from './ui/DropZone'
import { Viewport } from './viewport/Viewport'
import { HolesPanel } from './ui/HolesPanel'

export function App() {
  return (
    <div className="h-screen flex flex-col bg-slate-900 text-white overflow-hidden">
      <Header />
      <div className="flex-1 flex overflow-hidden relative">
        <DropZone />
        <Viewport />
        <HolesPanel />
      </div>
    </div>
  )
}
