import { LayoutGrid, RotateCcw, Upload, Loader2, LogOut } from 'lucide-react'
import { SET_MODE } from '../store/cardStore.js'

export default function TopBar({ mode, onReset, onPublish, publishing, onLogout, dispatch }) {
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 bg-white/80 backdrop-blur-md shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <LayoutGrid size={18} className="text-blue-500" />
        <span className="text-zinc-800 font-semibold text-sm tracking-tight">Potfolio</span>
      </div>

      {/* Mode toggle */}
      <div className="relative flex items-center bg-zinc-100 rounded-xl p-1 gap-0.5">
        <div
          className="absolute top-1 h-[calc(100%-8px)] w-20 rounded-lg bg-white shadow-sm transition-all duration-200 ease-out"
          style={{
            left: 4,
            transform: mode === 'edit' ? 'translateX(0)' : 'translateX(calc(100% + 2px))',
          }}
        />
        <button
          className={`relative z-10 w-20 py-1.5 rounded-lg text-xs font-medium text-center transition-colors
            ${mode === 'edit' ? 'text-zinc-800' : 'text-zinc-400 hover:text-zinc-600'}
          `}
          onClick={() => dispatch({ type: SET_MODE, payload: 'edit' })}
        >
          Edit
        </button>
        <button
          className={`relative z-10 w-20 py-1.5 rounded-lg text-xs font-medium text-center transition-colors
            ${mode === 'preview' ? 'text-zinc-800' : 'text-zinc-400 hover:text-zinc-600'}
          `}
          onClick={() => dispatch({ type: SET_MODE, payload: 'preview' })}
        >
          Preview
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-medium transition-all
            bg-zinc-100 text-zinc-500 hover:bg-red-50 hover:text-red-500"
          title="Reset to default"
        >
          <RotateCcw size={13} />
          Reset
        </button>

        <button
          onClick={onPublish}
          disabled={publishing}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-medium transition-all
            ${publishing
              ? 'bg-green-400 text-white cursor-wait'
              : 'bg-green-500 hover:bg-green-600 text-white'}
          `}
          title="Publish to GitHub"
        >
          {publishing
            ? <Loader2 size={13} className="animate-spin" />
            : <Upload size={13} />
          }
          {publishing ? 'Publishing…' : 'Publish'}
        </button>

        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-medium transition-all
            bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700"
          title="Sign out"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </header>
  )
}
