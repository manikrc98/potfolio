import { useState, useRef, useCallback } from 'react'
import { ADD_SECTION, REMOVE_SECTION, REORDER_SECTIONS } from '../store/cardStore.js'
import { Plus } from 'lucide-react'
import SectionHeader from './SectionHeader.jsx'
import SectionGrid from './SectionGrid.jsx'
import DeleteConfirmModal from './DeleteConfirmModal.jsx'
import { MediaLoadProvider } from '../contexts/MediaLoadContext.jsx'

function SectionDivider({ index, hovered, onHover, onClick, interactive = true }) {
  return (
    <div
      className={`relative h-8 flex items-center ${interactive ? 'cursor-pointer group/divider' : ''}`}
      onMouseEnter={interactive ? () => onHover(index) : undefined}
      onMouseLeave={interactive ? () => onHover(null) : undefined}
      onClick={interactive ? onClick : undefined}
    >
      {hovered ? (
        <div className="w-full flex items-center gap-3 pointer-events-none">
          <div className="flex-1 h-px bg-blue-400" />
          <span className="text-blue-500 text-xs font-medium whitespace-nowrap flex items-center gap-1 select-none">
            <Plus size={12} />
            Add section
          </span>
          <div className="flex-1 h-px bg-blue-400" />
        </div>
      ) : (
        <div className="w-full h-px bg-transparent group-hover/divider:bg-blue-200 transition-colors" />
      )}
    </div>
  )
}

export default function BentoCanvas({ state, dispatch, selectedCardId, onCardSelect, adjustingCardId, onAdjustCancel, isOwner }) {
  const { sections, mode } = state

  const [deletingSectionId, setDeletingSectionId] = useState(null)
  const [hoveredDivider, setHoveredDivider] = useState(null)
  const [dragFrom, setDragFrom] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const sectionRefs = useRef([])
  const dragFromRef = useRef(null)
  const dragOverRef = useRef(null)

  function handleDeleteRequest(sectionId) {
    setDeletingSectionId(sectionId)
  }

  function handleConfirmDelete() {
    if (deletingSectionId) {
      dispatch({ type: REMOVE_SECTION, payload: deletingSectionId })
    }
    setDeletingSectionId(null)
  }

  function handleCancelDelete() {
    setDeletingSectionId(null)
  }

  function handleAddSectionAt(insertIndex) {
    dispatch({ type: ADD_SECTION, payload: { insertIndex } })
  }

  const startSectionDrag = useCallback((fromIndex, e) => {
    e.preventDefault()
    dragFromRef.current = fromIndex
    dragOverRef.current = fromIndex
    setDragFrom(fromIndex)
    setDragOver(fromIndex)

    // Capture the pointer so events keep firing on trackpads even when
    // the cursor moves far from the drag handle
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)

    // Walk up the DOM to find the actual scrollable container
    // (the page scrolls on an overflow-y:auto div, not window)
    function findScrollParent(el) {
      while (el && el !== document.body) {
        const { overflowY } = window.getComputedStyle(el)
        if (overflowY === 'auto' || overflowY === 'scroll') return el
        el = el.parentElement
      }
      return document.documentElement
    }
    const scrollEl = findScrollParent(sectionRefs.current[fromIndex] || handle)

    const SPEED_MULTIPLIER = 4     // amplify cursor delta → scroll speed
    const MAX_SCROLL = 32          // max pixels scrolled per frame
    let scrollVelocity = 0         // maintained between moves; 0 = stopped
    let lastY = e.clientY
    let scrollRaf = null

    const scroll = () => {
      if (scrollVelocity !== 0) {
        scrollEl.scrollTop += scrollVelocity
      }
      scrollRaf = requestAnimationFrame(scroll)
    }
    scrollRaf = requestAnimationFrame(scroll)

    const onMove = (ev) => {
      const deltaY = ev.clientY - lastY
      lastY = ev.clientY

      if (Math.abs(deltaY) > 0.5) {
        const newDir = Math.sign(deltaY)
        const curDir = Math.sign(scrollVelocity)
        if (curDir !== 0 && newDir !== curDir) {
          // cursor reversed direction → stop scrolling
          scrollVelocity = 0
        } else {
          scrollVelocity = newDir * Math.min(Math.abs(deltaY) * SPEED_MULTIPLIER, MAX_SCROLL)
        }
      }
      // cursor idle (deltaY ≈ 0) → maintain current scrollVelocity

      const y = ev.clientY

      let closest = dragFromRef.current
      let minDist = Infinity
      sectionRefs.current.forEach((el, i) => {
        if (!el) return
        const rect = el.getBoundingClientRect()
        const mid = rect.top + rect.height / 2
        const dist = Math.abs(y - mid)
        if (dist < minDist) {
          minDist = dist
          closest = i
        }
      })
      dragOverRef.current = closest
      setDragOver(closest)
    }

    const onUp = () => {
      cancelAnimationFrame(scrollRaf)
      const from = dragFromRef.current
      const to = dragOverRef.current
      if (from !== null && to !== null && from !== to) {
        dispatch({ type: REORDER_SECTIONS, payload: { fromIndex: from, toIndex: to } })
      }
      dragFromRef.current = null
      dragOverRef.current = null
      setDragFrom(null)
      setDragOver(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [dispatch])

  const deletingSection = sections.find(s => s.id === deletingSectionId)
  const isDragging = dragFrom !== null

  return (
    <div className="flex-1 min-w-0">
      {sections.length === 0 && mode === 'preview' ? (
        <div className="flex flex-col items-center justify-center h-64 text-zinc-300 text-sm gap-2">
          <span className="text-4xl">⬜</span>
          <p>No sections yet. Switch to Edit mode to get started.</p>
        </div>
      ) : (
        <MediaLoadProvider sections={sections}>
        <div className="w-full max-w-4xl mx-auto pb-16">
          {!isDragging && isOwner && (
            <SectionDivider
              index={0}
              hovered={hoveredDivider === 0}
              onHover={setHoveredDivider}
              onClick={() => handleAddSectionAt(0)}
              interactive={mode === 'edit'}
            />
          )}

          {sections.map((section, i) => (
            <div
              key={section.id}
              className={[
                'relative',
                mode === 'preview' ? 'mb-8' : '',
                isDragging && dragOver === i && dragFrom !== i ? 'py-3' : '',
              ].filter(Boolean).join(' ')}
            >
              {isDragging && dragOver === i && dragFrom !== i && (
                <div
                  className="absolute inset-0 rounded-xl bg-gray-200 ring-2 ring-gray-300 pointer-events-none"
                  style={{ zIndex: 9999 }}
                />
              )}
              <div
                ref={el => { sectionRefs.current[i] = el }}
                className={[
                  'relative transition-opacity duration-150',
                  isDragging && dragFrom === i ? 'opacity-40 scale-[0.99]' : '',
                ].filter(Boolean).join(' ')}
              >
                <SectionHeader
                  section={section}
                  isEditMode={mode === 'edit'}
                  dispatch={dispatch}
                  onDeleteRequest={handleDeleteRequest}
                  onDragStart={(e) => startSectionDrag(i, e)}
                />
                <SectionGrid
                  section={section}
                  state={state}
                  dispatch={dispatch}
                  selectedCardId={selectedCardId}
                  onCardSelect={onCardSelect}
                  adjustingCardId={adjustingCardId}
                  onAdjustCancel={onAdjustCancel}
                />
              </div>

              {mode === 'edit' && !isDragging && (
                <SectionDivider
                  index={i + 1}
                  hovered={hoveredDivider === i + 1}
                  onHover={setHoveredDivider}
                  onClick={() => handleAddSectionAt(i + 1)}
                />
              )}
            </div>
          ))}

          {mode === 'edit' && sections.length === 0 && (
            <button
              onClick={() => handleAddSectionAt(0)}
              className="w-full py-3 rounded-xl border-2 border-dashed border-zinc-200
                text-zinc-400 text-sm font-medium flex items-center justify-center gap-2
                hover:border-zinc-300 hover:text-zinc-500 hover:bg-zinc-50/50 transition-colors"
            >
              <Plus size={16} />
              Add section
            </button>
          )}
        </div>
        </MediaLoadProvider>
      )}

      {deletingSectionId && (
        <DeleteConfirmModal
          sectionTitle={deletingSection?.title}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </div>
  )
}
