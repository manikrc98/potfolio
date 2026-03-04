import { useEffect, useCallback, useState } from 'react'
import { LOAD_STATE, SAVE } from '../store/cardStore.js'

const STORAGE_KEY = 'bento-portfolio-data'

export function usePersistence(state, dispatch) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [loaded, setLoaded] = useState(false)

  // Load saved state on mount — try localStorage first, then data.json
  useEffect(() => {
    if (loaded) return

    async function load() {
      // Try localStorage first (has latest edits)
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        try {
          const data = JSON.parse(stored)
          dispatch({ type: LOAD_STATE, payload: data })
          setLoaded(true)
          return
        } catch {
          // fall through to data.json
        }
      }

      // Fall back to data.json (shipped with the repo)
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Save to localStorage
  const save = useCallback(() => {
    setSaving(true)
    setSaveError(null)

    try {
      const snapshot = {
        sections: state.sections,
        bio: state.bio,
        gridConfig: state.gridConfig,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
      dispatch({ type: SAVE })
    } catch (err) {
      setSaveError(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [state.sections, state.bio, state.gridConfig, dispatch])

  // Export data.json for committing back to the repo
  const exportData = useCallback(() => {
    const snapshot = {
      sections: state.sections,
      bio: state.bio,
      gridConfig: state.gridConfig,
    }
    const json = JSON.stringify(snapshot, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'data.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [state.sections, state.bio, state.gridConfig])

  const clearSaveError = useCallback(() => setSaveError(null), [])

  return { save, saving, saveError, clearSaveError, exportData }
}
