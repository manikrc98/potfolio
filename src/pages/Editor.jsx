import { useReducer, useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { API_BASE_URL } from '../config'
import { reducer, initialState, REMOVE_CARD, RESET_STATE } from '../editor/store/cardStore.js'
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

function Toast({ message, visible }) {
  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-xl
        bg-zinc-800 text-white text-sm font-medium shadow-lg
        transition-all duration-200 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}
    >
      {message}
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
  const [toast, setToast] = useState({ message: '', visible: false })
  const [adjustingCardId, setAdjustingCardId] = useState(null)

  const isOwner = true
  const effectiveMode = mode

  const { trackedDispatch, undo, redo } = useUndoRedo(state, dispatch)

  const {
    save, saving, saveError, clearSaveError,
    publish, publishing, publishError, publishSuccess,
    resetPublishState, loadFromRepo, loaded,
  } = usePublish(state, trackedDispatch, authFetch)

  const { isDeploying, startDeploying, stopDeploying } = useDeployStatus(authFetch)

  // Load data from repo on mount
  useEffect(() => {
    if (repoName) {
      loadFromRepo(repoName)
    }
  }, [repoName, loadFromRepo])

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
    const success = await publish(repoName, versionSummary)
    if (success) {
      startDeploying(repoName)
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

      <TopBar
        mode={effectiveMode}
        onReset={() => setShowResetModal(true)}
        onPublish={handlePublishClick}
        publishing={publishing}
        onLogout={async () => { await logout(); navigate('/', { replace: true }) }}
        onDelete={() => setShowDeleteModal(true)}
        githubUrl={githubUrl}
        pagesUrl={pagesUrl}
        dispatch={trackedDispatch}
        isDeploying={isDeploying}
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
          publishSuccess={publishSuccess}
          isDeploying={isDeploying}
        />
      )}

      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-y-auto px-6 py-6 relative layout-row">
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
