import { useEffect, useCallback } from 'react'
import { SELECT_CARD, DESELECT_CARD } from '../store/cardStore.js'

/**
 * Manages card selection with click-outside detection.
 * Clicking outside any .bento-card or .floating-tray deselects.
 */
export function useCardSelection(dispatch, mode) {
  const handleSelect = useCallback((id) => {
    if (mode !== 'edit') return
    dispatch({ type: SELECT_CARD, payload: id })
  }, [dispatch, mode])

  const handleDeselect = useCallback(() => {
    dispatch({ type: DESELECT_CARD })
  }, [dispatch])

  useEffect(() => {
    function onMouseDown(e) {
      const insideCard = e.target.closest('.bento-card')
      const insideTray = e.target.closest('.floating-tray')
      const insideChat = e.target.closest('.chat-panel')
      if (!insideCard && !insideTray && !insideChat) {
        dispatch({ type: DESELECT_CARD })
      }
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        dispatch({ type: DESELECT_CARD })
      }
    }

    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [dispatch])

  return { handleSelect, handleDeselect }
}
