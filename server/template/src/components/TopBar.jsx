import { LayoutGrid } from 'lucide-react'

export default function TopBar() {
  return (
    <header className="flex items-center justify-center px-6 py-3 border-b border-zinc-200 bg-white/80 backdrop-blur-md shrink-0">
      <div className="flex items-center gap-2">
        <LayoutGrid size={18} className="text-blue-500" />
        <span className="text-zinc-800 font-semibold text-sm tracking-tight">Potfolio</span>
      </div>
    </header>
  )
}
