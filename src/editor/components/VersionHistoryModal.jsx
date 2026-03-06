import { useState, useEffect } from 'react'
import { History, X, Loader2, RotateCcw } from 'lucide-react'
import { API_BASE_URL } from '../../config'

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export default function VersionHistoryModal({ repoName, authFetch, onRestore, onClose }) {
  const [versions, setVersions] = useState(null)
  const [error, setError] = useState(null)
  const [loadingVersion, setLoadingVersion] = useState(null)

  useEffect(() => {
    authFetch(`${API_BASE_URL}/api/repos/${encodeURIComponent(repoName)}/history`)
      .then(res => res.ok ? res.json() : Promise.reject(new Error('Failed to load history')))
      .then(data => setVersions(data.versions || []))
      .catch(err => setError(err.message))
  }, [repoName, authFetch])

  async function handleRestore(sha) {
    setLoadingVersion(sha)
    try {
      const res = await authFetch(`${API_BASE_URL}/api/repos/${encodeURIComponent(repoName)}/version/${sha}`)
      if (!res.ok) throw new Error('Failed to load version')
      const data = await res.json()
      onRestore(data)
    } catch (err) {
      setError(err.message)
      setLoadingVersion(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4 animate-modal-in max-h-[80vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
            <History size={20} className="text-blue-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-900">Version History</h3>
            <p className="text-xs text-zinc-500">Restore a previous version</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto -mx-2 px-2">
          {!versions && !error && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="text-zinc-400 animate-spin" />
            </div>
          )}

          {error && (
            <div className="text-sm text-red-500 text-center py-8">{error}</div>
          )}

          {versions && versions.length === 0 && (
            <div className="text-sm text-zinc-400 text-center py-8">No published versions yet</div>
          )}

          {versions && versions.length > 0 && (
            <div className="space-y-1">
              {versions.map((v, i) => (
                <div
                  key={v.sha}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl hover:bg-zinc-50 transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-800 truncate">
                      {v.message}
                    </p>
                    <p className="text-xs text-zinc-400 mt-0.5">{timeAgo(v.date)}</p>
                  </div>
                  {i === 0 ? (
                    <span className="shrink-0 text-[10px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                      Current
                    </span>
                  ) : (
                    <button
                      onClick={() => handleRestore(v.sha)}
                      disabled={loadingVersion !== null}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-zinc-500
                        bg-zinc-100 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors
                        opacity-0 group-hover:opacity-100 disabled:opacity-50"
                    >
                      {loadingVersion === v.sha ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <RotateCcw size={12} />
                      )}
                      Restore
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
