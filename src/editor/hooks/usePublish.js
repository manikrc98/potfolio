import { useCallback, useState } from 'react'
import { LOAD_STATE, SAVE } from '../store/cardStore.js'
import { API_BASE_URL } from '../../config'

const STORAGE_KEY = 'bento-portfolio-data'
const API_BASE = `${API_BASE_URL}/api/repos`

/**
 * Detect the file extension from a Blob's MIME type.
 */
function extFromMime(mime) {
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'image/svg+xml': 'svg',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  }
  return map[mime] || 'bin'
}

/**
 * Check if a URL is a blob URL that needs to be extracted.
 */
function isBlobUrl(url) {
  return url && url.startsWith('blob:')
}

/**
 * Check if a URL is already a committed media path.
 */
function isCommittedPath(url) {
  return url && (url.startsWith('./media/') || url.startsWith('media/'))
}

/**
 * Convert a blob URL to base64 and return { base64, ext }.
 */
async function blobUrlToBase64(blobUrl) {
  const res = await fetch(blobUrl)
  const blob = await res.blob()
  const ext = extFromMime(blob.type)
  const buffer = await blob.arrayBuffer()
  const base64 = btoa(
    new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
  )
  return { base64, ext }
}

/**
 * Walk through the state, extract all blob URLs as media files,
 * and return the rewritten data + media map.
 */
async function extractMedia(state) {
  const media = {} // { "media/filename.ext": "base64data" }
  let counter = 0

  function makeFilename(prefix, ext) {
    counter++
    return `media/${prefix}-${counter}.${ext}`
  }

  // Deep clone the data so we can mutate paths
  const data = {
    sections: JSON.parse(JSON.stringify(state.sections)),
    bio: state.bio ? JSON.parse(JSON.stringify(state.bio)) : null,
    gridConfig: { ...state.gridConfig },
  }

  // Collect all blob extractions for parallel processing
  const extractions = []

  for (const section of data.sections) {
    for (const card of section.cards) {
      const c = card.content

      if (c.imageUrl && isBlobUrl(c.imageUrl)) {
        const filename = makeFilename(`card-${card.id}`, 'tmp')
        extractions.push(
          blobUrlToBase64(c.imageUrl).then(({ base64, ext }) => {
            const finalName = filename.replace('.tmp', `.${ext}`)
            media[finalName] = base64
            c.imageUrl = `./${finalName}`
          })
        )
      }

      if (c.videoUrl && isBlobUrl(c.videoUrl)) {
        const filename = makeFilename(`video-${card.id}`, 'tmp')
        extractions.push(
          blobUrlToBase64(c.videoUrl).then(({ base64, ext }) => {
            const finalName = filename.replace('.tmp', `.${ext}`)
            media[finalName] = base64
            c.videoUrl = `./${finalName}`
          })
        )
      }
    }
  }

  if (data.bio?.avatar && isBlobUrl(data.bio.avatar)) {
    const filename = makeFilename('avatar', 'tmp')
    extractions.push(
      blobUrlToBase64(data.bio.avatar).then(({ base64, ext }) => {
        const finalName = filename.replace('.tmp', `.${ext}`)
        media[finalName] = base64
        data.bio.avatar = `./${finalName}`
      })
    )
  }

  // Process all blob conversions in parallel
  await Promise.all(extractions)

  return { data, media }
}

export function usePublish(state, dispatch, authFetch) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState(null)
  const [publishSuccess, setPublishSuccess] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Load state from backend (GitHub repo) or fall back to localStorage
  const loadFromRepo = useCallback(async (repoName) => {
    if (loaded) return

    try {
      const res = await authFetch(`${API_BASE}/${encodeURIComponent(repoName)}/data`)
      if (res.ok) {
        const data = await res.json()
        if (data && (data.sections || data.bio)) {
          dispatch({ type: LOAD_STATE, payload: data })
          setLoaded(true)
          return
        }
      }
    } catch {
      // Fall through to localStorage
    }

    // Try localStorage
    const stored = localStorage.getItem(`${STORAGE_KEY}-${repoName}`)
    if (stored) {
      try {
        const data = JSON.parse(stored)
        dispatch({ type: LOAD_STATE, payload: data })
      } catch {
        // Use default initial state
      }
    }
    setLoaded(true)
  }, [loaded, dispatch, authFetch])

  // Save draft to localStorage
  const save = useCallback((repoName) => {
    setSaving(true)
    setSaveError(null)
    try {
      const snapshot = {
        sections: state.sections,
        bio: state.bio,
        gridConfig: state.gridConfig,
      }
      localStorage.setItem(`${STORAGE_KEY}-${repoName}`, JSON.stringify(snapshot))
      dispatch({ type: SAVE })
    } catch (err) {
      setSaveError(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [state.sections, state.bio, state.gridConfig, dispatch])

  // Publish to GitHub via backend
  const publish = useCallback(async (repoName, versionSummary) => {
    setPublishing(true)
    setPublishError(null)
    setPublishSuccess(false)

    try {
      // Extract media from blob URLs
      const { data, media } = await extractMedia(state)

      const res = await authFetch(`${API_BASE}/${encodeURIComponent(repoName)}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, media, versionSummary }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || `Publish failed: ${res.status}`)
      }

      // Update localStorage with the committed paths
      localStorage.setItem(`${STORAGE_KEY}-${repoName}`, JSON.stringify(data))
      dispatch({ type: SAVE })
      setPublishSuccess(true)
      return true
    } catch (err) {
      setPublishError(err.message || 'Publish failed')
      return false
    } finally {
      setPublishing(false)
    }
  }, [state, dispatch])

  const clearSaveError = useCallback(() => setSaveError(null), [])
  const resetPublishState = useCallback(() => {
    setPublishError(null)
    setPublishSuccess(false)
  }, [])

  return {
    save,
    saving,
    saveError,
    clearSaveError,
    publish,
    publishing,
    publishError,
    publishSuccess,
    resetPublishState,
    loadFromRepo,
    loaded,
  }
}
