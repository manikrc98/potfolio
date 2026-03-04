import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import BentoGrid from '@bentogrid/core'

/**
 * Given a container width and desired max columns, return the number of
 * columns that actually fit comfortably.  Each column needs roughly 160 px
 * (plus gap) to remain usable.
 */
export function responsiveColumns(containerWidth, maxColumns, cellGap) {
  const minColWidth = 160
  // Available width per column = (containerWidth - gaps) / cols
  // We find the largest column count <= maxColumns where each column is >= minColWidth.
  for (let cols = maxColumns; cols >= 1; cols--) {
    if (cols === 3 && maxColumns >= 4) continue  // skip 3-column layout for 4-col grids
    const available = (containerWidth - cellGap * (cols - 1)) / cols
    if (available >= minColWidth) return cols
  }
  return 1
}

/**
 * Manages a BentoGrid instance attached to containerRef.
 *
 * Key pattern: Before each recalculate call, we strip all .bento-filler
 * elements that BentoGrid previously injected — they live in the real DOM
 * but outside React's virtual DOM. Stripping them ensures BentoGrid starts
 * fresh and doesn't double-count them as real cards.
 *
 * useLayoutEffect (not useEffect) is critical here: it runs synchronously
 * after React mutates the DOM but before the browser paints, so the user
 * never sees the intermediate state of new cards + stale fillers.
 */
export function useBentoGrid(containerRef, cards, gridConfig, mode, onAddCard) {
  const instanceRef = useRef(null)
  const [effectiveCols, setEffectiveCols] = useState(gridConfig.columns)
  const colsRef = useRef(effectiveCols)
  colsRef.current = effectiveCols
  const onAddRef = useRef(onAddCard)
  onAddRef.current = onAddCard

  // ── Compute initial column count synchronously to avoid flash ────────────
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const width = el.clientWidth
    if (width > 0) {
      setEffectiveCols(responsiveColumns(width, gridConfig.columns, gridConfig.cellGap))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Observe container width and derive responsive column count ──────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const width = entry.contentRect.width
        setEffectiveCols(responsiveColumns(width, gridConfig.columns, gridConfig.cellGap))
      }
    })

    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef, gridConfig.columns, gridConfig.cellGap])

  // ── (Re-)create BentoGrid whenever layout-affecting props change ────────
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Remove fillers injected by a previous BentoGrid run
    container
      .querySelectorAll('.bento-filler')
      .forEach(el => el.remove())

    // Remove previously injected dynamic add buttons
    container
      .querySelectorAll('.dynamic-add-btn')
      .forEach(el => el.remove())

    // Disconnect previous instance's ResizeObserver and cancel its pending timeout
    if (instanceRef.current) {
      const ro = instanceRef.current.resizeObserver
      if (ro) {
        if (ro._timeoutId) clearTimeout(ro._timeoutId)
        if (ro instanceof ResizeObserver) ro.disconnect()
      }
    }
    instanceRef.current = null

    // Place [+] buttons in every empty grid cell after BentoGrid calculates
    function placeAddButtons() {
      // Clear any existing dynamic add buttons
      container.querySelectorAll('.dynamic-add-btn').forEach(el => el.remove())

      // Only show add buttons in edit mode
      if (mode !== 'edit') return

      const cols = colsRef.current

      // Always set grid template columns to match the responsive column count.
      // BentoGrid's setupGrid() produces invalid CSS when `columns` is specified,
      // so we must ensure the correct value is applied.
      container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`
      container.style.gap = `${gridConfig.cellGap}px`

      const items = container.querySelectorAll(':scope > [data-bento]')
      const occupied = new Set()
      let maxRowEnd = 0

      // Track each card's grid start position for insertion index calculation
      const cardGridPositions = []
      items.forEach(item => {
        const rowStart = parseInt(item.style.gridRow) || 1
        const rowSpan = parseInt((item.style.gridRow.split('span ')[1])) || 1
        const colStart = parseInt(item.style.gridColumn) || 1
        const colSpan = parseInt((item.style.gridColumn.split('span ')[1])) || 1
        cardGridPositions.push({ rowStart, colStart })
        for (let r = rowStart; r < rowStart + rowSpan; r++) {
          for (let c = colStart; c < colStart + colSpan; c++) {
            occupied.add(`${r},${c}`)
          }
        }
        maxRowEnd = Math.max(maxRowEnd, rowStart + rowSpan - 1)
      })

      // Only add an extra row when there are empty cells to fill on the last row
      const lastRowOccupied = (() => {
        if (maxRowEnd === 0) return 0
        let count = 0
        for (let c = 1; c <= cols; c++) {
          if (occupied.has(`${maxRowEnd},${c}`)) count++
        }
        return count
      })()
      const totalRows = (lastRowOccupied < cols) ? maxRowEnd : maxRowEnd + 1
      // Always at least 1 row for empty sections
      const effectiveTotalRows = Math.max(totalRows, 1)

      // Check if there's any card ahead of position (r, c) in the same row or next row
      function hasCardAhead(r, c) {
        // Check same row, later columns
        for (let cc = c + 1; cc <= cols; cc++) {
          if (occupied.has(`${r},${cc}`)) return true
        }
        // Check next row
        for (let cc = 1; cc <= cols; cc++) {
          if (occupied.has(`${r + 1},${cc}`)) return true
        }
        return false
      }

      // Create add buttons — but limit to one trailing button when no cards are ahead
      let trailingAddPlaced = false
      for (let r = 1; r <= effectiveTotalRows; r++) {
        for (let c = 1; c <= cols; c++) {
          if (!occupied.has(`${r},${c}`)) {
            if (hasCardAhead(r, c) || !trailingAddPlaced) {
              const btn = document.createElement('div')
              btn.className = 'dynamic-add-btn'
              btn.style.gridColumn = `${c} / span 1`
              btn.style.gridRow = `${r} / span 1`
              btn.title = 'Add card'

              // Absolutely positioned wrapper so content doesn't expand grid row
              const wrapper = document.createElement('div')
              wrapper.className = 'grid-selector-wrapper'

              // Grid size selector
              const maxSelectCols = cols
              const maxSelectRows = 4
              const grid = document.createElement('div')
              grid.className = 'grid-selector'
              grid.style.gridTemplateColumns = `repeat(${maxSelectCols}, 1fr)`

              const sizeLabel = document.createElement('div')
              sizeLabel.className = 'grid-size-label'
              sizeLabel.textContent = '\u00A0'

              for (let sr = 1; sr <= maxSelectRows; sr++) {
                for (let sc = 1; sc <= maxSelectCols; sc++) {
                  const cell = document.createElement('div')
                  cell.className = 'grid-selector-cell'
                  cell.dataset.row = sr
                  cell.dataset.col = sc

                  cell.addEventListener('mouseenter', () => {
                    grid.querySelectorAll('.grid-selector-cell').forEach(el => {
                      const cr = parseInt(el.dataset.row)
                      const cc = parseInt(el.dataset.col)
                      if (cr <= sr && cc <= sc) {
                        el.classList.add('highlighted')
                      } else {
                        el.classList.remove('highlighted')
                      }
                    })
                    sizeLabel.textContent = `${sc}\u00D7${sr}`
                  })

                  cell.addEventListener('click', (e) => {
                    e.stopPropagation()
                    // Insert before all cards in this row so the new (possibly larger) card
                    // gets placed first by BentoGrid, pushing existing row cards down
                    const insertIndex = cardGridPositions.filter(cp =>
                      cp.rowStart < r
                    ).length
                    onAddRef.current?.(`${sc}x${sr}`, insertIndex)
                  })

                  grid.appendChild(cell)
                }
              }

              grid.addEventListener('mouseleave', () => {
                grid.querySelectorAll('.grid-selector-cell').forEach(el => {
                  el.classList.remove('highlighted')
                })
                sizeLabel.textContent = '\u00A0'
              })

              wrapper.appendChild(grid)
              wrapper.appendChild(sizeLabel)
              btn.appendChild(wrapper)
              container.appendChild(btn)
              if (!hasCardAhead(r, c)) trailingAddPlaced = true
            }
          }
        }
      }

      // Extend grid rows so all button rows have proper height
      const currentRows = parseInt(container.style.gridTemplateRows?.match(/repeat\((\d+)/)?.[1]) || 0
      if (effectiveTotalRows > currentRows) {
        container.style.gridTemplateRows = `repeat(${effectiveTotalRows}, minmax(var(--bento-row-height), 1fr))`
      }
    }

    container.addEventListener('calculationDone', placeAddButtons)

    instanceRef.current = new BentoGrid({
      target: container,
      columns: effectiveCols,
      cellGap: gridConfig.cellGap,
      aspectRatio: gridConfig.aspectRatio,
    })

    // BentoGrid generates invalid CSS for gridTemplateColumns when `columns`
    // is specified (it deletes minCellWidth internally but still references it
    // in the template string, producing "minmax(undefinedpx, 1fr)").
    // Override with a correct value so the grid always has the right column count.
    container.style.gridTemplateColumns = `repeat(${effectiveCols}, 1fr)`

    // Handle 0-card case where BentoGrid may not fire calculationDone
    if (cards.length === 0 && mode === 'edit') {
      placeAddButtons()
    }

    return () => {
      container.removeEventListener('calculationDone', placeAddButtons)
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, effectiveCols, gridConfig.cellGap, gridConfig.aspectRatio, mode])

  // Destroy on unmount
  useEffect(() => {
    return () => {
      instanceRef.current = null
    }
  }, [])

  return { instanceRef, effectiveCols }
}
