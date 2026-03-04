import { useRef, useCallback } from 'react'
import {
  ADD_CARD, REMOVE_CARD, RESIZE_CARD, UPDATE_CARD_CONTENT,
  REORDER_CARDS, ADD_SECTION, REMOVE_SECTION, UPDATE_SECTION_TITLE,
  MOVE_CARD_TO_SECTION, REORDER_SECTIONS, SET_BIO, CLEAR_BIO, RESET_STATE, LOAD_STATE,
  RESTORE_SNAPSHOT,
} from '../store/cardStore.js'

const TRACKABLE_ACTIONS = new Set([
  ADD_CARD, REMOVE_CARD, RESIZE_CARD, UPDATE_CARD_CONTENT,
  REORDER_CARDS, ADD_SECTION, REMOVE_SECTION, UPDATE_SECTION_TITLE,
  MOVE_CARD_TO_SECTION, REORDER_SECTIONS, SET_BIO, CLEAR_BIO, RESET_STATE,
])

const DEBOUNCED_ACTIONS = new Set([UPDATE_CARD_CONTENT, SET_BIO])

const MAX_HISTORY = 5
const DEBOUNCE_MS = 500

export function useUndoRedo(state, dispatch) {
  const pastRef = useRef([])
  const futureRef = useRef([])
  const lastSnapshotTimeRef = useRef(0)
  const lastActionTypeRef = useRef(null)

  const trackedDispatch = useCallback((action) => {
    if (TRACKABLE_ACTIONS.has(action.type)) {
      const now = Date.now()
      const shouldDebounce = DEBOUNCED_ACTIONS.has(action.type)
        && action.type === lastActionTypeRef.current
        && (now - lastSnapshotTimeRef.current) < DEBOUNCE_MS

      if (!shouldDebounce) {
        const snap = {
          sections: JSON.parse(JSON.stringify(state.sections)),
          bio: state.bio ? JSON.parse(JSON.stringify(state.bio)) : null,
        }
        pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), snap]
        futureRef.current = []
        lastSnapshotTimeRef.current = now
      }
      lastActionTypeRef.current = action.type
    }

    if (action.type === LOAD_STATE) {
      pastRef.current = []
      futureRef.current = []
    }

    dispatch(action)
  }, [state.sections, state.bio, dispatch])

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return false

    const current = {
      sections: JSON.parse(JSON.stringify(state.sections)),
      bio: state.bio ? JSON.parse(JSON.stringify(state.bio)) : null,
    }
    futureRef.current = [...futureRef.current.slice(-(MAX_HISTORY - 1)), current]

    const prev = pastRef.current[pastRef.current.length - 1]
    pastRef.current = pastRef.current.slice(0, -1)

    dispatch({ type: RESTORE_SNAPSHOT, payload: prev })
    return true
  }, [state.sections, state.bio, dispatch])

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return false

    const current = {
      sections: JSON.parse(JSON.stringify(state.sections)),
      bio: state.bio ? JSON.parse(JSON.stringify(state.bio)) : null,
    }
    pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), current]

    const next = futureRef.current[futureRef.current.length - 1]
    futureRef.current = futureRef.current.slice(0, -1)

    dispatch({ type: RESTORE_SNAPSHOT, payload: next })
    return true
  }, [state.sections, state.bio, dispatch])

  return { trackedDispatch, undo, redo }
}
