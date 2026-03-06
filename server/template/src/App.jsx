import { useReducer, useState, useEffect } from 'react'
import { reducer, initialState, LOAD_STATE } from './store/cardStore.js'
import BentoCanvas from './components/BentoCanvas.jsx'
import BioSection from './components/BioSection.jsx'

export default function App() {
  const [state, dispatch] = useReducer(reducer, { ...initialState, mode: 'preview' })
  const { sections, bio } = state
  const [loaded, setLoaded] = useState(false)

  // Load data.json on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(import.meta.env.BASE_URL + 'data.json')
        if (res.ok) {
          const data = await res.json()
          dispatch({ type: LOAD_STATE, payload: data })
        }
      } catch {
        // Use default initial state
      }
      setLoaded(true)
    }
    load()
  }, [])

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

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-zinc-400 text-sm">Loading…</div>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col h-screen bg-gray-50 text-zinc-800 overflow-hidden">
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-y-auto px-6 py-6 relative layout-row">
        <BioSection bio={bio} mode="preview" dispatch={dispatch} />

        <BentoCanvas
          state={state}
          dispatch={dispatch}
          selectedCardId={null}
          onCardSelect={() => {}}
          adjustingCardId={null}
          onAdjustCancel={() => {}}
          isOwner={false}
        />
      </div>
    </div>
  )
}
