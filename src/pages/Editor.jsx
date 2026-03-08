import { useReducer, useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { API_BASE_URL } from '../config'
import { reducer, initialState, REMOVE_CARD, RESET_STATE, LOAD_STATE } from '../editor/store/cardStore.js'
import { useCardSelection } from '../editor/hooks/useCardSelection.js'
import { usePublish } from '../editor/hooks/usePublish.js'
import useDeployStatus from '../editor/hooks/useDeployStatus.js'
import { useUndoRedo } from '../editor/hooks/useUndoRedo.js'
import TopBar from '../editor/components/TopBar.jsx'
import BentoCanvas from '../editor/components/BentoCanvas.jsx'
import FloatingTray from '../editor/components/FloatingTray.jsx'
import BioSection from '../editor/components/BioSection.jsx'
import ResetConfirmModal from '../editor/components/ResetConfirmModal.jsx'
import PublishModal from '../editor/components/PublishModal.jsx'
import DeleteProjectModal from '../editor/components/DeleteProjectModal.jsx'
import VersionHistoryModal from '../editor/components/VersionHistoryModal.jsx'
import { Loader2, CheckCircle, X } from 'lucide-react'

function Toast({ message, visible }) {
  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-xl
        bg-zinc-800 text-white text-sm font-medium shadow-lg
        transition-all duration-200 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}
    >
      {message}
    </div>
  )
}

function PublishToast({ phase }) {
  const [progress, setProgress] = useState(0)
  const startRef = useRef(null)

  // Asymptotic progress: fast at first, slows down, never reaches 100% on its own.
  // Uses log curve so it adapts naturally to any commit duration.
  useEffect(() => {
    if (phase === 'committing') {
      startRef.current = Date.now()
      const iv = setInterval(() => {
        const elapsed = Date.now() - startRef.current
        // ln(1 + t/1000) grows unbounded but slowly — cap at 92%
        const raw = Math.log1p(elapsed / 1000) / Math.log1p(30) // ~92% at 30s
        setProgress(Math.min(raw * 92, 92))
      }, 100)
      return () => clearInterval(iv)
    }
    if (phase === 'done') {
      setProgress(100)
      startRef.current = null
    }
    if (!phase) {
      setProgress(0)
      startRef.current = null
    }
  }, [phase])

  if (!phase) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-slide-up">
      <div className="bg-zinc-800 text-white text-sm font-medium shadow-lg rounded-xl overflow-hidden min-w-[280px]">
        <div className="px-4 py-2.5 flex items-center gap-2.5">
          {phase === 'committing' && (
            <>
              <Loader2 size={14} className="text-green-400 animate-spin shrink-0" />
              <span>Publishing changes…</span>
            </>
          )}
          {phase === 'done' && (
            <>
              <CheckCircle size={16} className="text-green-400 shrink-0" />
              <span>Published!</span>
            </>
          )}
        </div>
        <div className="h-1 bg-zinc-700">
          <div
            className={`h-full transition-all duration-300 ease-out ${progress >= 100 ? 'bg-green-400' : 'bg-green-400/70'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}

const DEPLOY_MESSAGES = [
  'Pushing pixels to production...',
  'Compiling hopes and dreams...',
  'Convincing GitHub to cooperate...',
  'Warming up the CDN...',
  'Teaching servers your portfolio...',
  'Minifying your awesomeness...',
  'Sprinkling some DNS magic...',
  'Almost there, pinky promise...',
]

const DEPLOY_DURATION = 35000

function DeployToast({ phase, pagesUrl, onDismiss, hasPublishToast }) {
  const [msgIndex, setMsgIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const startRef = useRef(null)

  useEffect(() => {
    if (phase === 'deploying') {
      if (!startRef.current) startRef.current = Date.now()
      const iv = setInterval(() => {
        const elapsed = Date.now() - startRef.current
        const t = Math.min(elapsed / DEPLOY_DURATION, 1)
        const eased = 1 - Math.pow(1 - t, 2)
        setProgress(Math.min(eased * 100, 92))
        if (t >= 1) clearInterval(iv)
      }, 200)
      return () => clearInterval(iv)
    }
    if (phase === 'live') {
      setProgress(100)
      startRef.current = null
    }
    if (!phase) {
      setProgress(0)
      startRef.current = null
    }
  }, [phase])

  useEffect(() => {
    if (phase !== 'deploying') return
    setMsgIndex(0)
    const iv = setInterval(() => {
      setMsgIndex(i => (i + 1) % DEPLOY_MESSAGES.length)
    }, 4000)
    return () => clearInterval(iv)
  }, [phase])

  if (!phase) return null

  return (
    <div className={`fixed left-1/2 -translate-x-1/2 z-[100] animate-slide-up transition-all duration-300 ${hasPublishToast ? 'bottom-[4.5rem]' : 'bottom-6'}`}>
      <div className="bg-zinc-800 text-white text-sm font-medium shadow-lg rounded-xl overflow-hidden min-w-[300px]">
        <div className="px-4 py-2.5">
          {phase === 'deploying' && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="text-blue-400 animate-spin shrink-0" />
                <span>Deploying Portfolio</span>
              </div>
              <span className="text-xs text-zinc-400 italic pl-[22px]">{DEPLOY_MESSAGES[msgIndex]}</span>
            </div>
          )}
          {phase === 'live' && (
            <div className="flex items-center gap-2.5">
              <CheckCircle size={16} className="text-green-400 shrink-0" />
              <span>Your site is live!</span>
              {pagesUrl && (
                <a
                  href={pagesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
                >
                  View site
                </a>
              )}
              <button onClick={onDismiss} className="ml-1 text-zinc-400 hover:text-white transition-colors">
                <X size={14} />
              </button>
            </div>
          )}
        </div>
        <div className="h-1 bg-zinc-700">
          <div
            className={`h-full transition-all duration-500 ease-out ${progress >= 100 ? 'bg-green-400' : 'bg-blue-400'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default function Editor() {
  const { repoName } = useParams()
  const navigate = useNavigate()
  const { user, logout, authFetch } = useAuth()
  const [state, dispatch] = useReducer(reducer, initialState)
  const { mode, sections, selectedCardId, isDirty, bio } = state
  const [showResetModal, setShowResetModal] = useState(false)
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [toast, setToast] = useState({ message: '', visible: false })
  const [adjustingCardId, setAdjustingCardId] = useState(null)

  const isOwner = true
  const effectiveMode = mode

  const { trackedDispatch, undo, redo } = useUndoRedo(state, dispatch)

  const {
    save, saving, saveError, clearSaveError,
    publish, publishing, publishError, publishSuccess,
    resetPublishState, loadFromRepo, loaded,
    loadError, clearLoadError,
    hasChanges,
  } = usePublish(state, trackedDispatch, authFetch)

  const { isDeploying, isConfirmed, startDeploying } = useDeployStatus(authFetch)
  const [publishPhase, setPublishPhase] = useState(null) // null | 'committing' | 'done'
  const [deployPhase, setDeployPhase] = useState(null)   // null | 'deploying' | 'live'

  // Load data from repo on mount
  useEffect(() => {
    if (repoName) {
      loadFromRepo(repoName)
    }
  }, [repoName, loadFromRepo])

  // Watch for deploy confirmation → transition to live
  useEffect(() => {
    if (isConfirmed && deployPhase === 'deploying') {
      setDeployPhase('live')
      const timer = setTimeout(() => setDeployPhase(null), 6000)
      return () => clearTimeout(timer)
    }
  }, [isConfirmed, deployPhase])

  // Auto-dismiss publish toast after showing "done" briefly
  useEffect(() => {
    if (publishPhase === 'done') {
      const timer = setTimeout(() => setPublishPhase(null), 2000)
      return () => clearTimeout(timer)
    }
  }, [publishPhase])

  const showToast = useCallback((message) => {
    setToast({ message, visible: true })
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 1500)
  }, [])

  // Keyboard listeners for undo/redo
  useEffect(() => {
    if (effectiveMode !== 'edit') return

    function handleKeyDown(e) {
      const isMeta = e.metaKey || e.ctrlKey
      if (!isMeta || e.key !== 'z') return

      e.preventDefault()
      if (e.shiftKey) {
        const didRedo = redo()
        showToast(didRedo ? 'Redo successful' : 'Nothing to redo')
      } else {
        const didUndo = undo()
        showToast(didUndo ? 'Undo successful' : 'Nothing to undo')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [effectiveMode, undo, redo, showToast])

  const { handleSelect } = useCardSelection(trackedDispatch, effectiveMode)

  // Sync favicon with the bio avatar
  useEffect(() => {
    const avatarUrl = bio?.avatar
    const link = document.querySelector("link[rel='icon']") || (() => {
      const el = document.createElement('link')
      el.rel = 'icon'
      document.head.appendChild(el)
      return el
    })()
    if (avatarUrl) {
      link.type = 'image/png'
      link.href = avatarUrl
    }
  }, [bio?.avatar])

  // Find selected card across all sections
  const selectedCard = selectedCardId
    ? sections.flatMap(s => s.cards).find(c => c.id === selectedCardId) ?? null
    : null

  function handleRemove(id) {
    trackedDispatch({ type: REMOVE_CARD, payload: id })
  }

  function handleResetConfirm() {
    trackedDispatch({ type: RESET_STATE })
    setShowResetModal(false)
  }

  function handlePublishClick() {
    resetPublishState()
    setShowPublishModal(true)
  }

  async function handlePublish(versionSummary) {
    setShowPublishModal(false)
    setPublishPhase('committing')

    const success = await publish(repoName, versionSummary)
    if (success) {
      setPublishPhase('done')
      setDeployPhase('deploying')
      startDeploying(repoName)
    } else {
      setPublishPhase(null)
      showToast('Publish failed. Please try again.')
    }
  }

  function handleClosePublishModal() {
    setShowPublishModal(false)
    resetPublishState()
  }

  async function handleDeleteProject() {
    const res = await authFetch(`${API_BASE_URL}/api/repos/${repoName}`, { method: 'DELETE' })
    if (!res.ok) {
      let message = 'Failed to delete project'
      try {
        const data = await res.json()
        message = data.error || message
      } catch {
        // response wasn't JSON
      }
      throw new Error(message)
    }
    localStorage.removeItem(`potfolio_state_${repoName}`)
    await logout()
    navigate('/', { replace: true })
  }

  const [portfolioInfo, setPortfolioInfo] = useState(null)

  // Fetch portfolio info (subdomain URL) on mount
  useEffect(() => {
    if (!repoName) return
    authFetch(`${API_BASE_URL}/api/repos/${repoName}/info`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => data && setPortfolioInfo(data))
      .catch(() => {})
  }, [repoName, authFetch])

  const owner = user?.login
  const githubUrl = owner ? `https://github.com/${owner}/${repoName}` : null
  const pagesUrl = portfolioInfo?.pagesUrl || (owner ? `https://${owner}.github.io/${repoName}/` : null)

  if (!repoName) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-zinc-500">No repository specified.</p>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col h-screen bg-gray-50 text-zinc-800 overflow-hidden">
      <Toast message={toast.message} visible={toast.visible} />

      {loadError && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg shadow-md flex items-center gap-2 max-w-lg">
          <span className="flex-1">{loadError}</span>
          <button onClick={clearLoadError} className="text-red-400 hover:text-red-600 transition-colors"><X size={14} /></button>
        </div>
      )}

      <PublishToast phase={publishPhase} />
      <DeployToast phase={deployPhase} pagesUrl={pagesUrl} onDismiss={() => setDeployPhase(null)} hasPublishToast={!!publishPhase} />

      <TopBar
        mode={effectiveMode}
        onReset={() => setShowResetModal(true)}
        onPublish={handlePublishClick}
        publishing={publishing}
        hasChanges={hasChanges}
        onVersionHistory={() => setShowVersionHistory(true)}
        onLogout={async () => { await logout(); navigate('/', { replace: true }) }}
        onDelete={() => setShowDeleteModal(true)}
        githubUrl={githubUrl}
        pagesUrl={pagesUrl}
        dispatch={trackedDispatch}
        isDeploying={publishPhase === 'committing' || deployPhase === 'deploying'}
      />

      {showDeleteModal && (
        <DeleteProjectModal
          repoName={repoName}
          onDelete={handleDeleteProject}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}

      {showResetModal && (
        <ResetConfirmModal
          onConfirm={handleResetConfirm}
          onCancel={() => setShowResetModal(false)}
        />
      )}

      {showPublishModal && (
        <PublishModal
          onPublish={handlePublish}
          onClose={handleClosePublishModal}
          publishing={publishing}
          publishError={publishError}
        />
      )}

      {showVersionHistory && (
        <VersionHistoryModal
          repoName={repoName}
          authFetch={authFetch}
          onRestore={(data) => {
            trackedDispatch({ type: LOAD_STATE, payload: data })
            setShowVersionHistory(false)
            showToast('Version restored')
          }}
          onClose={() => setShowVersionHistory(false)}
        />
      )}

      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-y-auto px-6 py-6 relative layout-row">
        {!loaded ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={28} className="text-zinc-400 animate-spin" />
          </div>
        ) : (
          <>
            <BioSection bio={bio} mode={effectiveMode} dispatch={trackedDispatch} />

            <BentoCanvas
              state={{ ...state, mode: effectiveMode }}
              dispatch={trackedDispatch}
              selectedCardId={selectedCardId}
              onCardSelect={handleSelect}
              adjustingCardId={adjustingCardId}
              onAdjustCancel={() => setAdjustingCardId(null)}
              isOwner={isOwner}
            />
          </>
        )}
      </div>

      <FloatingTray
        selectedCard={effectiveMode === 'edit' ? selectedCard : null}
        onRemove={handleRemove}
        dispatch={trackedDispatch}
        onStartAdjust={() => selectedCardId && setAdjustingCardId(selectedCardId)}
        isAdjusting={adjustingCardId !== null && adjustingCardId === selectedCardId}
      />
    </div>
  )
}
