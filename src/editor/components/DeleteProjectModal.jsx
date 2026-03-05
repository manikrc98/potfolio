import { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'

export default function DeleteProjectModal({ repoName, onDelete, onCancel }) {
  const [step, setStep] = useState(1)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)

  const canDelete = confirmText === repoName

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await onDelete()
    } catch (err) {
      setError(err.message || 'Failed to delete project')
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={!deleting ? onCancel : undefined} />

      <div className="relative bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4 animate-modal-in">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-zinc-900">
              {step === 1 ? 'Delete this project?' : 'Confirm deletion'}
            </h3>

            {step === 1 ? (
              <div className="mt-2 text-sm text-zinc-500 space-y-2">
                <p>This will <strong className="text-red-600">permanently</strong> delete the following:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>GitHub repository <strong className="text-zinc-700">{repoName}</strong></li>
                  <li>Published portfolio site and all its data</li>
                  <li>Portfolio URL mapping from potfolio.me</li>
                </ul>
                <p className="text-red-600 font-medium">This action cannot be undone.</p>
              </div>
            ) : (
              <div className="mt-2 text-sm text-zinc-500 space-y-3">
                <p>
                  Type <strong className="text-zinc-700 font-mono bg-zinc-100 px-1.5 py-0.5 rounded">{repoName}</strong> to confirm:
                </p>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={repoName}
                  disabled={deleting}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400
                    disabled:opacity-50"
                  autoFocus
                />
                {error && (
                  <p className="text-red-500 text-xs">{error}</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-5 justify-end">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium text-zinc-600 bg-zinc-100 rounded-lg
              hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          {step === 1 ? (
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg
                hover:bg-red-600 transition-colors"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleDelete}
              disabled={!canDelete || deleting}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg
                transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                bg-red-500 hover:bg-red-600"
            >
              {deleting && <Loader2 size={14} className="animate-spin" />}
              {deleting ? 'Deleting…' : 'Delete Forever'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
