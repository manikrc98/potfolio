import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'

const MediaLoadContext = createContext(null)

/**
 * How many media items may be loading simultaneously.
 * Images across all sections are queued first; videos follow.
 */
const CONCURRENCY = 3

/**
 * Provides a sequential media-loading queue to all BentoCards in the tree.
 *
 * Queue order:
 *   1. Images — in section order (section 0, then section 1, …)
 *   2. Videos — in section order
 *
 * At most CONCURRENCY items are "released" (marked ready) at once.
 * When a card signals its media has loaded, the next item in the queue is released.
 */
export function MediaLoadProvider({ sections, children }) {
  const [readyUrls, setReadyUrls] = useState(() => new Set())

  // Mutable refs — no re-renders needed for queue internals
  const queueRef    = useRef([])   // ordered list of URLs still waiting
  const inFlightRef = useRef(new Set()) // released but not yet confirmed loaded
  const doneRef     = useRef(new Set()) // confirmed loaded

  // Advance the queue: release up to CONCURRENCY items at once
  const advance = useCallback(() => {
    const toRelease = []

    while (
      inFlightRef.current.size + toRelease.length < CONCURRENCY &&
      queueRef.current.length > 0
    ) {
      const url = queueRef.current.shift()
      if (!url || doneRef.current.has(url) || inFlightRef.current.has(url)) continue
      inFlightRef.current.add(url)
      toRelease.push(url)
    }

    if (toRelease.length > 0) {
      setReadyUrls(prev => {
        const next = new Set(prev)
        toRelease.forEach(u => next.add(u))
        return next
      })
    }
  }, [])

  // Rebuild the queue whenever the section/card structure changes
  useEffect(() => {
    const images = []
    const videos = []

    for (const section of sections) {
      for (const card of section.cards) {
        if (card.content.type === 'image' && card.content.imageUrl) {
          images.push(card.content.imageUrl)
        } else if (card.content.type === 'video' && card.content.videoUrl) {
          videos.push(card.content.videoUrl)
        }
      }
    }

    // Images first (section order), then videos (section order)
    const allUrls = [...images, ...videos]

    // Only enqueue URLs that haven't been loaded or are not already in-flight
    queueRef.current = allUrls.filter(
      url => !doneRef.current.has(url) && !inFlightRef.current.has(url),
    )

    advance()
  }, [sections, advance])

  /** Called by BentoCard once its image or video has finished loading */
  const onMediaLoaded = useCallback((url) => {
    inFlightRef.current.delete(url)
    doneRef.current.add(url)
    advance()
  }, [advance])

  return (
    <MediaLoadContext.Provider value={{ readyUrls, onMediaLoaded }}>
      {children}
    </MediaLoadContext.Provider>
  )
}

/**
 * Returns whether a given media URL has been cleared to start loading,
 * and a callback to call once loading is complete.
 *
 * Falls back to isReady=true when used outside a MediaLoadProvider
 * (e.g. in standalone previews).
 */
export function useMediaLoad(url) {
  const ctx = useContext(MediaLoadContext)
  if (!ctx || !url) return { isReady: true, onMediaLoaded: () => {} }
  return {
    isReady: ctx.readyUrls.has(url),
    onMediaLoaded: () => ctx.onMediaLoaded(url),
  }
}
