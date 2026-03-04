import { useCallback, useRef, useState, useEffect, useLayoutEffect } from 'react'
import { useBentoGrid } from '../hooks/useBentoGrid.js'
import { ADD_CARD, REORDER_CARDS, MOVE_CARD_TO_SECTION } from '../store/cardStore.js'
import BentoCard from './BentoCard.jsx'

export default function SectionGrid({ section, state, dispatch, selectedCardId, onCardSelect, adjustingCardId, onAdjustCancel }) {
  const { mode, gridConfig } = state
  const { cards } = section
  const containerRef = useRef(null)
  const [dragIndex, setDragIndex] = useState(null)
  const [dropTargetIndex, setDropTargetIndex] = useState(null)
  const prevCardCountRef = useRef(cards.length)

  const cardsRef = useRef(cards)
  cardsRef.current = cards
  const dragIndexRef = useRef(null)
  const dropTargetIndexRef = useRef(null)

  // FLIP animation refs
  const flipRectsRef = useRef(new Map())
  const draggedIdRef = useRef(null)

  const handleAdd = useCallback((bento, insertIndex) => {
    const newId = crypto.randomUUID()
    dispatch({ type: ADD_CARD, payload: { id: newId, sectionId: section.id, bento, insertIndex } })
  }, [dispatch, section.id])

  const { effectiveCols } = useBentoGrid(containerRef, cards, gridConfig, mode, handleAdd)

  function captureCardRects() {
    const rects = new Map()
    containerRef.current?.querySelectorAll('[data-card-id]').forEach(el => {
      rects.set(el.dataset.cardId, el.getBoundingClientRect())
    })
    return rects
  }

  // FLIP animation
  useLayoutEffect(() => {
    const oldRects = flipRectsRef.current
    if (oldRects.size === 0) return
    flipRectsRef.current = new Map()

    containerRef.current?.querySelectorAll('[data-card-id]').forEach(el => {
      el.style.transform = ''
      el.style.transition = ''
    })

    containerRef.current?.querySelectorAll('[data-card-id]').forEach(el => {
      const id = el.dataset.cardId
      const oldRect = oldRects.get(id)
      if (!oldRect) return
      if (id === draggedIdRef.current) return

      const newRect = el.getBoundingClientRect()
      const dx = oldRect.left - newRect.left
      const dy = oldRect.top - newRect.top
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return

      el.style.transform = `translate(${dx}px, ${dy}px)`
      el.style.transition = 'none'

      requestAnimationFrame(() => {
        el.style.transition = 'transform 0.2s ease'
        el.style.transform = ''
      })
    })
  }, [cards])

  // Pointer-event drag
  const handleDragStart = useCallback((index, e) => {
    const container = containerRef.current
    if (!container) return

    const cardEl = container.querySelectorAll('[data-card-id]')[index]
    if (!cardEl) return

    const rect = cardEl.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top

    const ghost = cardEl.cloneNode(true)
    ghost.classList.add('drag-ghost')
    ghost.style.width = `${rect.width}px`
    ghost.style.height = `${rect.height}px`
    ghost.style.left = `${rect.left}px`
    ghost.style.top = `${rect.top}px`
    document.body.appendChild(ghost)

    const draggedId = cardsRef.current[index].id
    draggedIdRef.current = draggedId
    dragIndexRef.current = index
    setDragIndex(index)

    let currentDropTargetId = null
    let currentDropSectionId = null

    function onPointerMove(ev) {
      ghost.style.left = (ev.clientX - offsetX) + 'px'
      ghost.style.top = (ev.clientY - offsetY) + 'px'

      ghost.style.display = 'none'
      const target = document.elementFromPoint(ev.clientX, ev.clientY)
      ghost.style.display = ''

      const targetCard = target?.closest?.('[data-card-id]')

      if (!targetCard) {
        // Check if hovering over an empty section's area (container or add button)
        const targetSectionEl = target?.closest?.('[data-section-id]')
        const targetSectionId = targetSectionEl?.dataset.sectionId

        if (targetSectionId && targetSectionId !== section.id) {
          // Hovering over a different section's empty area — allow drop to append
          setDropTargetIndex(null)
          dropTargetIndexRef.current = null
          currentDropTargetId = null
          currentDropSectionId = targetSectionId
        } else {
          setDropTargetIndex(null)
          dropTargetIndexRef.current = null
          currentDropTargetId = null
          currentDropSectionId = null
        }
        return
      }

      const targetId = targetCard.dataset.cardId
      const targetSectionEl = targetCard.closest('[data-section-id]')
      const targetSectionId = targetSectionEl?.dataset.sectionId

      // Same section reorder
      if (targetSectionId === section.id) {
        const currentCards = cardsRef.current
        const overIndex = currentCards.findIndex(c => c.id === targetId)

        if (overIndex !== -1 && overIndex !== dragIndexRef.current) {
          setDropTargetIndex(overIndex)
          dropTargetIndexRef.current = overIndex
          currentDropTargetId = targetId
          currentDropSectionId = targetSectionId
        } else {
          setDropTargetIndex(null)
          dropTargetIndexRef.current = null
          currentDropTargetId = null
          currentDropSectionId = null
        }
      } else if (targetSectionId) {
        // Cross-section: just track the target
        setDropTargetIndex(null)
        dropTargetIndexRef.current = null
        currentDropTargetId = targetId
        currentDropSectionId = targetSectionId
      }
    }

    function onPointerUp() {
      if (currentDropSectionId) {
        if (currentDropSectionId === section.id && currentDropTargetId) {
          // Same section reorder
          const currentCards = cardsRef.current
          const fromIndex = dragIndexRef.current
          const toIndex = currentCards.findIndex(c => c.id === currentDropTargetId)

          if (toIndex !== -1 && toIndex !== fromIndex) {
            flipRectsRef.current = captureCardRects()
            dispatch({ type: REORDER_CARDS, payload: { sectionId: section.id, fromIndex, toIndex } })
          }
        } else if (currentDropSectionId !== section.id) {
          // Cross-section move
          let toIndex
          if (currentDropTargetId) {
            // Dropped on a specific card — find its index
            const targetSectionEl = document.querySelector(`[data-section-id="${currentDropSectionId}"]`)
            const targetCards = targetSectionEl?.querySelectorAll('[data-card-id]')
            toIndex = 0
            if (targetCards) {
              targetCards.forEach((el, i) => {
                if (el.dataset.cardId === currentDropTargetId) toIndex = i
              })
            }
          }
          // If currentDropTargetId is null, toIndex is undefined → appends to end
          dispatch({
            type: MOVE_CARD_TO_SECTION,
            payload: {
              cardId: draggedId,
              fromSectionId: section.id,
              toSectionId: currentDropSectionId,
              toIndex,
            },
          })
        }
      }

      ghost.remove()
      draggedIdRef.current = null
      dragIndexRef.current = null
      dropTargetIndexRef.current = null
      setDragIndex(null)
      setDropTargetIndex(null)
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
    }

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
  }, [dispatch, section.id])

  // Auto-scroll to newly created cards
  useEffect(() => {
    const wasAdded = cards.length > prevCardCountRef.current
    prevCardCountRef.current = cards.length

    if (!wasAdded || !selectedCardId) return

    requestAnimationFrame(() => {
      const cardEl = containerRef.current?.querySelector(`[data-card-id="${selectedCardId}"]`)
      cardEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }, [cards.length, selectedCardId])

  return (
    <div
      ref={containerRef}
      className="bentogrid w-full"
      data-section-id={section.id}
      data-mode={mode}
    >
      {cards.map((card, index) => (
        <BentoCard
          key={card.id}
          card={card}
          index={index}
          maxColumns={effectiveCols}
          isSelected={selectedCardId === card.id}
          isEditMode={mode === 'edit'}
          onSelect={onCardSelect}
          dispatch={dispatch}
          onDragStart={handleDragStart}
          isDragging={dragIndex === index}
          isDropTarget={dropTargetIndex === index && dragIndex !== null}
          isAdjusting={adjustingCardId === card.id}
          onAdjustCancel={onAdjustCancel}
        />
      ))}
    </div>
  )
}
