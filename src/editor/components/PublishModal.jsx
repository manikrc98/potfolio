import { useState } from 'react'
import { Upload, X, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'

export default function PublishModal({ onPublish, onClose, publishing, publishError, publishSuccess }) {
  const [versionSummary, setVersionSummary] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!versionSummary.trim() || publishing) return
    onPublish(versionSummary.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4 animate-modal-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
        >
          <X size={16} />
        </button>

        {publishSuccess ? (
          <div className="text-center py-4">
            <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-zinc-900 mb-1">Published!</h3>
            <p className="text-sm text-zinc-500">
              Your changes have been pushed to GitHub. The site will rebuild automatically.
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                <Upload size={20} className="text-green-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-900">Publish to GitHub</h3>
                <p className="text-xs text-zinc-500">Push your changes live</p>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                Version Summary
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none
                  focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all
                  placeholder:text-zinc-300"
                placeholder="e.g. Added project section, updated bio"
                value={versionSummary}
                onChange={e => setVersionSummary(e.target.value)}
                autoFocus
                disabled={publishing}
              />

              {publishError && (
                <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
                  <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-600">{publishError}</p>
                </div>
              )}

              <div className="flex gap-2 mt-4 justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={publishing}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 bg-zinc-100 rounded-lg
                    hover:bg-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!versionSummary.trim() || publishing}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors
                    ${publishing
                      ? 'bg-green-400 cursor-wait'
                      : !versionSummary.trim()
                        ? 'bg-green-300 cursor-not-allowed'
                        : 'bg-green-500 hover:bg-green-600'}
                  `}
                >
                  {publishing && <Loader2 size={14} className="animate-spin" />}
                  {publishing ? 'Publishing…' : 'Publish'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
