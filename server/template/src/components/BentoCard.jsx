import { useState, useCallback, useRef, useEffect } from 'react'
import { GripVertical, Check, X, ExternalLink } from 'lucide-react'
import { UPDATE_CARD_CONTENT, RESIZE_CARD } from '../store/cardStore.js'
import { clampBento, parseBento, formatBento } from '../utils/bentoDimensions.js'
import { useMediaLoad } from '../contexts/MediaLoadContext.jsx'
import { extractVideoThumbnail } from '../utils/videoThumbnail.js'

const MAX_RESIZE_ROWS = 4

function ResizeGrid({ currentBento, maxColumns, onResize }) {
  const { cols: currentCols, rows: currentRows } = parseBento(currentBento)
  const [hoverSize, setHoverSize] = useState(null)

  const displayCols = hoverSize ? hoverSize.col : currentCols
  const displayRows = hoverSize ? hoverSize.row : currentRows
  const label = `${displayCols}\u00D7${displayRows}`

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center z-20 rounded-2xl
        outline-2 outline-dashed outline-zinc-300 -outline-offset-2"
      style={{ background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(2px)' }}
    >
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${maxColumns}, 1fr)`, width: '60%', maxWidth: 140 }}
        onMouseLeave={() => setHoverSize(null)}
      >
        {Array.from({ length: MAX_RESIZE_ROWS }, (_, r) =>
          Array.from({ length: maxColumns }, (_, c) => {
            const row = r + 1
            const col = c + 1
            const isHighlighted = col <= displayCols && row <= displayRows
            return (
              <div
                key={`${row}-${col}`}
                className="aspect-square rounded-sm cursor-pointer transition-colors duration-100"
                style={{ background: isHighlighted ? '#60a5fa' : 'rgba(0,0,0,0.1)' }}
                onMouseEnter={() => setHoverSize({ col, row })}
                onClick={e => {
                  e.stopPropagation()
                  onResize(formatBento(col, row))
                }}
              />
            )
          })
        )}
      </div>
      <span className="text-black/50 text-xs font-medium mt-1.5 select-none">{label}</span>
    </div>
  )
}

/* ── Auto-scaling text component (preview mode) ─────────────────── */
function AutoScaleText({ text, cardRef, textColor, manualFontSize }) {
  const measureRef = useRef(null)
  const [fontSize, setFontSize] = useState(manualFontSize ?? 120)

  const recalc = useCallback(() => {
    if (manualFontSize != null) { setFontSize(manualFontSize); return }
    if (!cardRef.current || !measureRef.current || !text) return
    const card = cardRef.current
    const pad = 24
    const maxW = card.offsetWidth - pad * 2
    const maxH = card.offsetHeight - pad * 2
    if (maxW <= 0 || maxH <= 0) return

    const el = measureRef.current
    const words = text.split(/\s+/)
    const longestWord = words.reduce((a, b) => a.length > b.length ? a : b, '')

    let lo = 12, hi = 120, best = 12
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2)
      el.style.fontSize = `${mid}px`

      // Ensure longest word fits on one line
      el.style.whiteSpace = 'nowrap'
      el.style.width = 'auto'
      el.style.maxWidth = 'none'
      el.textContent = longestWord
      const wordFits = el.scrollWidth <= maxW

      // Ensure full text with wrapping fits in height
      el.style.whiteSpace = 'pre-wrap'
      el.style.width = `${maxW}px`
      el.style.maxWidth = `${maxW}px`
      el.textContent = text
      const textFits = el.scrollHeight <= maxH

      if (wordFits && textFits) {
        best = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    setFontSize(best)
  }, [text, cardRef, manualFontSize])

  useEffect(() => { recalc() }, [recalc])

  useEffect(() => {
    if (!cardRef.current) return
    const observer = new ResizeObserver(recalc)
    observer.observe(cardRef.current)
    return () => observer.disconnect()
  }, [recalc, cardRef])

  if (!text) return null

  return (
    <>
      <div
        ref={measureRef}
        className="offscreen-measure font-semibold leading-tight whitespace-pre-wrap"
      />
      <div
        className="absolute inset-0 flex items-center justify-center p-6 font-semibold leading-tight overflow-hidden whitespace-pre-wrap text-center"
        style={{
          fontSize: `${fontSize}px`,
          color: textColor,
          overflowWrap: 'break-word',
        }}
      >
        {text}
      </div>
    </>
  )
}

/* ── Auto-scaling editable textarea ────────────────────────────── */
function AutoScaleTextarea({ text, cardRef, textColor, onChange, manualFontSize, onFontSizeComputed }) {
  const textareaRef = useRef(null)
  const measureRef = useRef(null)
  const [fontSize, setFontSize] = useState(manualFontSize ?? 120)

  const recalc = useCallback(() => {
    // If manually overridden, skip binary search
    if (manualFontSize != null) {
      setFontSize(manualFontSize)
      return
    }
    if (!cardRef.current || !measureRef.current) return
    const card = cardRef.current
    const pad = 24
    const maxW = card.offsetWidth - pad * 2
    const maxH = card.offsetHeight - pad * 2
    if (maxW <= 0 || maxH <= 0) return

    const el = measureRef.current
    const t = text || 'M'
    const words = t.split(/\s+/)
    const longestWord = words.reduce((a, b) => a.length > b.length ? a : b, '')

    let lo = 12, hi = 120, best = 12
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2)
      el.style.fontSize = `${mid}px`

      // Ensure longest word fits on one line
      el.style.whiteSpace = 'nowrap'
      el.style.width = 'auto'
      el.style.maxWidth = 'none'
      el.textContent = longestWord
      const wordFits = el.scrollWidth <= maxW

      // Ensure full text with wrapping fits in height
      el.style.whiteSpace = 'pre-wrap'
      el.style.width = `${maxW}px`
      el.style.maxWidth = `${maxW}px`
      el.textContent = t
      const textFits = el.scrollHeight <= maxH

      if (wordFits && textFits) {
        best = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    setFontSize(best)
  }, [text, cardRef, manualFontSize])

  useEffect(() => { recalc() }, [recalc])

  useEffect(() => {
    if (!cardRef.current) return
    const observer = new ResizeObserver(recalc)
    observer.observe(cardRef.current)
    return () => observer.disconnect()
  }, [recalc, cardRef])

  // Report effective font size to parent so slider stays in sync
  useEffect(() => {
    onFontSizeComputed?.(fontSize)
  }, [fontSize, onFontSizeComputed])

  // Auto-adjust textarea height whenever fontSize or text changes (not just on user input)
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = ta.scrollHeight + 'px'
  }, [fontSize, text])

  return (
    <>
      <div
        ref={measureRef}
        className="offscreen-measure font-semibold leading-tight whitespace-pre-wrap"
      />
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <textarea
          ref={textareaRef}
          className="w-full bg-transparent resize-none outline-none border-0 font-semibold leading-tight text-center"
          style={{
            color: textColor,
            fontSize: `${fontSize}px`,
            overflowWrap: 'break-word',
            maxHeight: '100%',
            overflow: 'hidden',
          }}
          rows={1}
          placeholder="Type something…"
          value={text}
          onChange={e => {
            onChange(e.target.value)
          }}
          onClick={e => e.stopPropagation()}
        />
      </div>
    </>
  )
}

/* ── Auto-sizing caption textarea ─────────────────────────────── */
function CaptionTextarea({ title, textColor, cardRef, onChange }) {
  const taRef = useRef(null)
  const spanRef = useRef(null)

  const resize = useCallback(() => {
    if (!spanRef.current || !cardRef.current || !taRef.current) return
    const cardWidth = cardRef.current.offsetWidth
    const maxWidth = cardWidth * 0.8
    const paddingH = 20 // px-2.5 = 10px each side
    spanRef.current.textContent = title || 'Caption…'
    const textWidth = Math.ceil(spanRef.current.getBoundingClientRect().width)
    const targetWidth = Math.max(Math.min(textWidth + paddingH, maxWidth), 64)
    taRef.current.style.width = targetWidth + 'px'
    taRef.current.style.height = 'auto'
    taRef.current.style.height = taRef.current.scrollHeight + 'px'
  }, [title, cardRef])

  useEffect(() => { resize() }, [resize])

  useEffect(() => {
    if (!cardRef.current) return
    const observer = new ResizeObserver(resize)
    observer.observe(cardRef.current)
    return () => observer.disconnect()
  }, [resize, cardRef])

  return (
    <>
      <span
        ref={spanRef}
        className="text-sm font-medium"
        style={{ position: 'fixed', top: -9999, left: -9999, whiteSpace: 'nowrap', visibility: 'hidden', pointerEvents: 'none', fontFamily: 'inherit' }}
      />
      <textarea
        ref={taRef}
        className="text-sm font-medium rounded-full backdrop-blur-sm bg-white/90 shadow-sm outline-none border-0 placeholder:opacity-40 resize-none overflow-hidden leading-snug appearance-none"
        style={{ color: textColor, minWidth: 64, display: 'block', padding: '4px 10px', fontFamily: 'inherit' }}
        rows={1}
        placeholder="Caption…"
        value={title}
        onChange={onChange}
        onClick={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
      />
    </>
  )
}

export default function BentoCard({
  card, maxColumns, isSelected, isEditMode, onSelect, dispatch,
  index, onDragStart, isDragging, isDropTarget,
  isAdjusting, onAdjustCancel,
}) {
  const { id, bento, content } = card
  const { type = 'image', imageUrl, videoUrl, thumbnailUrl: savedThumbnailUrl,
          text, title, bgColor, textColor, linkUrl,
          manualFontSize = null,
          mediaScale = 1, mediaOffsetX = 0, mediaOffsetY = 0,
          mediaRefW = null, mediaRefH = null } = content
  const [isHovered, setIsHovered] = useState(false)
  const [shiftHeld, setShiftHeld] = useState(false)
  const [autoFontSize, setAutoFontSize] = useState(60)
  const cardRef = useRef(null)
  const [cardW, setCardW] = useState(0)
  const [cardH, setCardH] = useState(0)

  // ── Media loading state ──────────────────────────────────────────────────
  const mediaUrl = type === 'image' ? imageUrl : type === 'video' ? videoUrl : null
  const { isReady, onMediaLoaded } = useMediaLoad(mediaUrl)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [thumbnailUrl, setThumbnailUrl] = useState(null)
  // true once extractVideoThumbnail resolves (success or failure) — gates <video> mount
  const [thumbnailResolved, setThumbnailResolved] = useState(false)

  // Reset loaded flags when media URL changes
  useEffect(() => { setImgLoaded(false) }, [imageUrl])
  useEffect(() => {
    setVideoLoaded(false)
    setThumbnailUrl(null)
    setThumbnailResolved(false)
  }, [videoUrl, savedThumbnailUrl])

  // Show a thumbnail (frame 0) while the full video loads.
  // If a thumbnail was persisted to Supabase (savedThumbnailUrl from DB), use it
  // immediately — no extraction needed. Otherwise fall back to client-side extraction.
  useEffect(() => {
    if (type !== 'video' || !videoUrl) return

    if (savedThumbnailUrl) {
      setThumbnailUrl(savedThumbnailUrl)
      setThumbnailResolved(true)
      return
    }

    let cancelled = false
    extractVideoThumbnail(videoUrl).then(url => {
      if (!cancelled) {
        if (url) setThumbnailUrl(url)
        setThumbnailResolved(true)
      }
    })
    return () => { cancelled = true }
  }, [type, videoUrl, savedThumbnailUrl])

  // Track card dimensions so media offsets scale proportionally on viewport resize
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setCardW(width)
      setCardH(height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Preload image once the queue clears this card to load
  useEffect(() => {
    if (!isReady || type !== 'image' || !imageUrl) return
    const img = new Image()
    img.onload = () => { setImgLoaded(true); onMediaLoaded() }
    img.onerror = () => { setImgLoaded(true); onMediaLoaded() }
    img.src = imageUrl
    return () => { img.onload = null; img.onerror = null }
  }, [isReady, imageUrl, type, onMediaLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Adjust mode local state ──────────────────────────────────────────────
  const [adjScale, setAdjScale] = useState(1)
  const [adjOffsetX, setAdjOffsetX] = useState(0)
  const [adjOffsetY, setAdjOffsetY] = useState(0)
  const dragStateRef = useRef(null) // { startX, startY, startOffsetX, startOffsetY }

  // Sync local adjust state when adjust mode opens.
  // Seed from the *displayed* (scaled) offset so the image doesn't jump when
  // the adjuster opens on a card that is currently a different size than when
  // the crop was last saved.
  useEffect(() => {
    if (isAdjusting) {
      setAdjScale(mediaScale)
      const W = cardRef.current?.offsetWidth || 1
      const H = cardRef.current?.offsetHeight || 1
      setAdjOffsetX(mediaRefW && W ? mediaOffsetX * (W / mediaRefW) : mediaOffsetX)
      setAdjOffsetY(mediaRefH && H ? mediaOffsetY * (H / mediaRefH) : mediaOffsetY)
    }
  }, [isAdjusting]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleAdjustSave() {
    dispatch({
      type: UPDATE_CARD_CONTENT,
      payload: {
        id,
        updates: {
          mediaScale: adjScale,
          mediaOffsetX: adjOffsetX,
          mediaOffsetY: adjOffsetY,
          mediaRefW: cardRef.current?.offsetWidth ?? null,
          mediaRefH: cardRef.current?.offsetHeight ?? null,
        },
      },
    })
    onAdjustCancel?.()
  }

  function handleAdjustPointerDown(e) {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: adjOffsetX,
      startOffsetY: adjOffsetY,
    }
    window.addEventListener('pointermove', handleAdjustPointerMove)
    window.addEventListener('pointerup', handleAdjustPointerUp)
  }

  function handleAdjustPointerMove(e) {
    if (!dragStateRef.current) return
    const { startX, startY, startOffsetX, startOffsetY } = dragStateRef.current
    setAdjOffsetX(startOffsetX + (e.clientX - startX))
    setAdjOffsetY(startOffsetY + (e.clientY - startY))
  }

  function handleAdjustPointerUp() {
    dragStateRef.current = null
    window.removeEventListener('pointermove', handleAdjustPointerMove)
    window.removeEventListener('pointerup', handleAdjustPointerUp)
  }

  // Cleanup listeners if adjust mode exits without save
  useEffect(() => {
    if (!isAdjusting) {
      dragStateRef.current = null
      window.removeEventListener('pointermove', handleAdjustPointerMove)
      window.removeEventListener('pointerup', handleAdjustPointerUp)
    }
  }, [isAdjusting]) // eslint-disable-line react-hooks/exhaustive-deps

  // Compute the active transform values (adjust session or saved)
  const activeScale = isAdjusting ? adjScale : mediaScale
  const activeOffsetX = isAdjusting ? adjOffsetX : mediaOffsetX
  const activeOffsetY = isAdjusting ? adjOffsetY : mediaOffsetY

  // Scale saved pixel offsets to the current card size so the crop stays
  // proportional when the viewport (and thus card dimensions) change.
  // Falls back to the raw pixel value for older cards that have no reference dims.
  // During an adjust session the offsets are live pixels — no scaling needed.
  const displayOffsetX = isAdjusting
    ? activeOffsetX
    : (mediaRefW && cardW ? activeOffsetX * (cardW / mediaRefW) : activeOffsetX)
  const displayOffsetY = isAdjusting
    ? activeOffsetY
    : (mediaRefH && cardH ? activeOffsetY * (cardH / mediaRefH) : activeOffsetY)

  useEffect(() => {
    if (!isEditMode) return
    const down = (e) => { if (e.key === 'Shift') setShiftHeld(true) }
    const up = (e) => { if (e.key === 'Shift') setShiftHeld(false) }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [isEditMode, type])

  const handleResize = useCallback((newBento) => {
    dispatch({ type: RESIZE_CARD, payload: { id, bento: newBento } })
  }, [dispatch, id])

  function handleTitleChange(e) {
    dispatch({ type: UPDATE_CARD_CONTENT, payload: { id, updates: { title: e.target.value } } })
  }

  const hasMedia = type === 'image' ? imageUrl : type === 'video' ? videoUrl : false

  const Tag = (!isEditMode && linkUrl) ? 'a' : 'div'
  const linkProps = (!isEditMode && linkUrl)
    ? { href: linkUrl, target: '_blank', rel: 'noopener noreferrer' }
    : {}

  return (
    <Tag
      ref={cardRef}
      data-bento={clampBento(bento, maxColumns)}
      data-card-id={id}
      {...linkProps}
      className={`bento-card block relative rounded-2xl overflow-hidden cursor-pointer select-none
        ${isSelected ? 'selected' : ''}
        group
      `}
      style={{ backgroundColor: bgColor }}
      onClick={() => isEditMode && !isAdjusting && onSelect(id)}
      onMouseEnter={() => isEditMode && setIsHovered(true)}
      onMouseLeave={() => isEditMode && setIsHovered(false)}
    >
      {/* ── External link icon — preview mode only, visible on hover ──── */}
      {!isEditMode && linkUrl && (
        <div className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center
          rounded-lg bg-black/15 backdrop-blur-sm text-white
          opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-30 pointer-events-none">
          <ExternalLink size={13} />
        </div>
      )}

      {/* ── Image background ───────────────────────────────────────────── */}
      {type === 'image' && imageUrl && (
        <>
          {/* Skeleton shimmer — visible until the image has loaded */}
          {!imgLoaded && (
            <div className="absolute inset-0 pointer-events-none skeleton-shimmer" />
          )}

          {/* Actual image — only rendered once the queue releases this card,
              fades in smoothly once the browser finishes loading it */}
          {isReady && (
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-500"
              style={{
                backgroundImage: `url(${imageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                transformOrigin: 'center',
                transform: (activeScale !== 1 || displayOffsetX !== 0 || displayOffsetY !== 0)
                  ? `scale(${activeScale}) translate(${displayOffsetX / activeScale}px, ${displayOffsetY / activeScale}px)`
                  : undefined,
                opacity: imgLoaded ? 1 : 0,
              }}
            />
          )}
        </>
      )}

      {/* ── Video background ───────────────────────────────────────────── */}
      {type === 'video' && videoUrl && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            transformOrigin: 'center',
            transform: (activeScale !== 1 || displayOffsetX !== 0 || displayOffsetY !== 0)
              ? `scale(${activeScale}) translate(${displayOffsetX / activeScale}px, ${displayOffsetY / activeScale}px)`
              : undefined,
          }}
        >
          {/* Skeleton shimmer — visible until either thumbnail or video is ready */}
          {!thumbnailUrl && !videoLoaded && (
            <div className="absolute inset-0 skeleton-shimmer" />
          )}

          {/* Thumbnail (frame 0) — shown while the full video is loading */}
          {thumbnailUrl && (
            <div
              className="absolute inset-0 transition-opacity duration-500"
              style={{
                backgroundImage: `url(${thumbnailUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: videoLoaded ? 0 : 1,
              }}
            />
          )}

          {/* Actual video — mounted only after the queue releases this card
              AND the thumbnail extraction has settled, so frame 0 is always
              visible before the video begins loading */}
          {isReady && thumbnailResolved && (
            <video
              src={videoUrl}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover transition-opacity duration-500"
              style={{ opacity: videoLoaded ? 1 : 0 }}
              onLoadedData={() => { setVideoLoaded(true); onMediaLoaded() }}
            />
          )}
        </div>
      )}

      {/* Auto-scaling text */}
      {type === 'text' && (
        <>
          {isEditMode ? (
            <AutoScaleTextarea
              text={text || ''}
              cardRef={cardRef}
              textColor={textColor}
              manualFontSize={manualFontSize}
              onFontSizeComputed={setAutoFontSize}
              onChange={val => {
                dispatch({ type: UPDATE_CARD_CONTENT, payload: { id, updates: { text: val } } })
              }}
            />
          ) : (
            <AutoScaleText text={text} cardRef={cardRef} textColor={textColor} manualFontSize={manualFontSize} />
          )}
        </>
      )}

      {/* Drop zone indicator when this card is the target */}
      {isDropTarget && !isDragging && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none
            bg-gray-300
            ring-2 ring-gray-400"
          style={{ zIndex: 10 }}
        />
      )}

      {/* Floating caption — hidden for text cards and while adjusting */}
      {type !== 'text' && !isAdjusting && (
        <div className={`absolute bottom-0 left-0 right-0 p-3 ${isEditMode ? 'z-30' : ''}`}>
          {isEditMode ? (
            <CaptionTextarea
              title={title}
              textColor={textColor}
              cardRef={cardRef}
              onChange={handleTitleChange}
            />
          ) : (
            title && (
              <span
                className="inline-block text-sm font-medium px-2.5 py-1 rounded-full backdrop-blur-sm bg-white/90 shadow-sm"
                style={{ color: textColor }}
              >
                {title}
              </span>
            )
          )}
        </div>
      )}

      {/* Edit mode overlay: selection ring, drag handle, resize grid */}
      {isEditMode && (
        <div className={`absolute inset-0 rounded-2xl transition-all duration-150
          ${isSelected ? 'ring-[2.5px] ring-blue-400' : 'ring-0 hover:ring-[1.5px] hover:ring-blue-300/50'}
          ${type === 'text' && !shiftHeld ? 'pointer-events-none' : ''}
        `}>
          {/* Drag handle – always visible on hover, above resize grid; hidden while adjusting */}
          {!isAdjusting && <div
            onPointerDown={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onDragStart(index, e)
            }}
            className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center
              rounded-lg bg-black/15 backdrop-blur-sm text-black/50
              hover:bg-black/25 hover:text-black/80 transition-all cursor-grab active:cursor-grabbing z-30
              opacity-0 group-hover:opacity-100 pointer-events-auto"
            style={{ color: hasMedia ? 'rgba(255,255,255,0.7)' : undefined }}
            title="Drag to reorder"
          >
            <GripVertical size={13} />
          </div>}

          {/* Resize grid overlay on hover — for text cards only when Shift is held */}
          {isHovered && shiftHeld && (
            <ResizeGrid
              currentBento={clampBento(bento, maxColumns)}
              maxColumns={maxColumns}
              onResize={handleResize}
            />
          )}

        </div>
      )}

      {/* Hint for text cards: hold shift to resize — outside overlay so it doesn't interfere */}
      {isEditMode && isHovered && !shiftHeld && (
        <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] text-black/30 select-none pointer-events-none z-30">
          Hold Shift to resize
        </span>
      )}

      {/* Font size slider — vertical strip on right side, only for text cards in edit mode */}
      {isEditMode && type === 'text' && !(shiftHeld && isHovered) && (
        <div
          className="absolute right-0 top-0 h-full flex flex-col items-center justify-center z-40 select-none"
          style={{ width: 28 }}
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
        >
          <input
            type="range"
            // eslint-disable-next-line react/no-unknown-property
            orient="vertical"
            min={12}
            max={120}
            value={manualFontSize ?? autoFontSize}
            onChange={e =>
              dispatch({ type: UPDATE_CARD_CONTENT, payload: { id, updates: { manualFontSize: Number(e.target.value) } } })
            }
            className="cursor-pointer opacity-50 hover:opacity-90 transition-opacity"
            style={{
              writingMode: 'vertical-lr',
              direction: 'rtl',
              WebkitAppearance: 'slider-vertical',
              height: manualFontSize != null ? 'calc(100% - 28px)' : '80%',
            }}
          />
          {manualFontSize != null && (
            <button
              className="text-[9px] font-semibold text-black/35 hover:text-black/65 leading-none mt-1 transition-colors"
              onClick={() =>
                dispatch({ type: UPDATE_CARD_CONTENT, payload: { id, updates: { manualFontSize: null } } })
              }
            >
              Auto
            </button>
          )}
        </div>
      )}
      {/* ── Adjust mode overlay ─────────────────────────────────────── */}
      {isAdjusting && (
        <div
          className="absolute inset-0 z-50 rounded-2xl select-none"
          style={{ cursor: 'grab' }}
          onPointerDown={handleAdjustPointerDown}
        >
          {/* Dashed border — shows the exact clip boundary of the card */}
          <div className="absolute inset-0 rounded-2xl border-2 border-dashed border-white/80 pointer-events-none" />

          {/* Hint label */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-[10px] font-medium pointer-events-none whitespace-nowrap">
            Drag to reposition
          </div>

          {/* Scale slider — vertical strip on right side, matching font-size slider */}
          <div
            className="absolute right-0 top-0 h-full flex flex-col items-center justify-center select-none"
            style={{ width: 28 }}
            onPointerDown={e => e.stopPropagation()}
          >
            <span className="text-white/70 text-[10px] leading-none mb-1 select-none">+</span>
            <input
              type="range"
              // eslint-disable-next-line react/no-unknown-property
              orient="vertical"
              min={0.5}
              max={4}
              step={0.01}
              value={adjScale}
              onChange={e => setAdjScale(Number(e.target.value))}
              className="cursor-pointer opacity-60 hover:opacity-100 transition-opacity accent-white"
              style={{
                writingMode: 'vertical-lr',
                direction: 'rtl',
                WebkitAppearance: 'slider-vertical',
                height: 'calc(100% - 56px)',
              }}
            />
            <span className="text-white/70 text-[10px] leading-none mt-1 select-none">–</span>
            <span className="text-white/60 text-[9px] leading-none mt-1 select-none tabular-nums">
              {Math.round(adjScale * 100)}%
            </span>
          </div>

          {/* Save / Cancel */}
          <div
            className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5"
            onPointerDown={e => e.stopPropagation()}
          >
            <button
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/90 text-zinc-700 text-xs font-medium hover:bg-white shadow-sm transition-colors"
              onClick={e => { e.stopPropagation(); onAdjustCancel?.() }}
            >
              <X size={11} />
              Cancel
            </button>
            <button
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 shadow-sm transition-colors"
              onClick={e => { e.stopPropagation(); handleAdjustSave() }}
            >
              <Check size={11} />
              Save
            </button>
          </div>
        </div>
      )}
    </Tag>
  )
}
