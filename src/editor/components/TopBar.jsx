import { useState, useRef, useEffect } from 'react'
import { LayoutGrid, RotateCcw, Upload, Loader2, LogOut, ChevronDown, ExternalLink, Trash2, History } from 'lucide-react'
import { SET_MODE } from '../store/cardStore.js'

export default function TopBar({ mode, onReset, onPublish, publishing, hasChanges, onVersionHistory, onLogout, onDelete, githubUrl, pagesUrl, dispatch, isDeploying }) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

  const publishLabel = publishing ? 'Publishing…' : 'Publish'
  const publishDisabled = publishing || !hasChanges

  return (
    <header className="relative z-50 flex items-center justify-between px-6 py-3 border-b border-zinc-200 bg-white/80 backdrop-blur-md shrink-0">
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

        {/* Publish with dropdown */}
        <div className="relative" ref={dropdownRef}>
          <div
            className={`inline-flex items-center rounded-xl overflow-hidden ${publishDisabled ? (publishing ? 'bg-green-400' : 'bg-green-300') : 'bg-green-500'}`}
          >
            <button
              onClick={onPublish}
              disabled={publishDisabled}
              className={`relative flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white transition-all hover:bg-green-600 ${publishing ? 'disabled:cursor-wait' : 'disabled:cursor-not-allowed'}`}
              title={publishDisabled && !publishing ? 'No changes to publish' : 'Publish to GitHub'}
            >
              {publishing
                ? <Loader2 size={13} className="animate-spin" />
                : <Upload size={13} />
              }
              {publishLabel}
            </button>
            <div className="w-px h-4 bg-green-400/50" />
            <button
              type="button"
              onClick={() => setDropdownOpen(o => !o)}
              disabled={publishDisabled}
              className="flex items-center px-2 py-1.5 text-white transition-all hover:bg-green-600 disabled:cursor-wait"
            >
              <ChevronDown size={12} />
            </button>
          </div>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-lg border border-zinc-200 py-1 z-[9999]">
              {githubUrl ? (
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800 transition-colors cursor-pointer"
                  onClick={() => setDropdownOpen(false)}
                >
                  <ExternalLink size={12} />
                  GitHub Repo
                </a>
              ) : (
                <span className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-300">
                  <ExternalLink size={12} />
                  GitHub Repo
                </span>
              )}
              {pagesUrl ? (
                isDeploying ? (
                  <span className="flex items-center gap-2 px-3 py-2 text-xs text-amber-500">
                    <Loader2 size={12} className="animate-spin" />
                    Deploying…
                  </span>
                ) : (
                  <a
                    href={pagesUrl + (pagesUrl.includes('?') ? '&' : '?') + '_cb=' + Date.now()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800 transition-colors cursor-pointer"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <ExternalLink size={12} />
                    Live Site
                  </a>
                )
              ) : (
                <span className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-300">
                  <ExternalLink size={12} />
                  Live Site
                </span>
              )}
              <div className="h-px bg-zinc-100 my-1" />
              <button
                onClick={() => { setDropdownOpen(false); onVersionHistory() }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800 transition-colors"
              >
                <History size={12} />
                Version History
              </button>
            </div>
          )}
        </div>

        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all
            bg-zinc-100 text-zinc-400 hover:bg-red-50 hover:text-red-500"
          title="Delete project"
        >
          <Trash2 size={13} />
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
