import { LayoutGrid } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="px-6 py-12 border-t border-zinc-100">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-zinc-400">
        <div className="flex items-center gap-2">
          <LayoutGrid size={16} className="text-blue-500" />
          <span className="font-semibold text-zinc-600">Potfolio</span>
        </div>

        <div className="flex items-center gap-6">
          <a href="#" className="hover:text-zinc-600 transition-colors">Twitter</a>
          <a href="#" className="hover:text-zinc-600 transition-colors">GitHub</a>
          <a href="#" className="hover:text-zinc-600 transition-colors">Contact</a>
        </div>

        <p>&copy; 2026 Potfolio</p>
      </div>
    </footer>
  )
}
