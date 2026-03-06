import { useCallback, useState, useRef, useMemo } from 'react'
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
 * Fetch a blob URL and return the raw Blob + detected extension.
 */
async function fetchBlob(blobUrl) {
  const res = await fetch(blobUrl)
  const blob = await res.blob()
  const ext = extFromMime(blob.type)
  return { blob, ext }
}

/**
 * Walk through the state, extract all blob URLs as media files,
 * and return the rewritten data + array of { filename, blob }.
 */
async function extractMedia(state) {
  const mediaFiles = [] // [{ filename, blob }]
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
        const tempName = makeFilename(`card-${card.id}`, 'tmp')
        extractions.push(
          fetchBlob(c.imageUrl).then(({ blob, ext }) => {
            const finalName = tempName.replace('.tmp', `.${ext}`)
            mediaFiles.push({ filename: finalName, blob })
            c.imageUrl = `./${finalName}`
          })
        )
      }

      if (c.videoUrl && isBlobUrl(c.videoUrl)) {
        const tempName = makeFilename(`video-${card.id}`, 'tmp')
        extractions.push(
          fetchBlob(c.videoUrl).then(({ blob, ext }) => {
            const finalName = tempName.replace('.tmp', `.${ext}`)
            mediaFiles.push({ filename: finalName, blob })
            c.videoUrl = `./${finalName}`
          })
        )
      }
    }
  }

  if (data.bio?.avatar && isBlobUrl(data.bio.avatar)) {
    const tempName = makeFilename('avatar', 'tmp')
    extractions.push(
      fetchBlob(data.bio.avatar).then(({ blob, ext }) => {
        const finalName = tempName.replace('.tmp', `.${ext}`)
        mediaFiles.push({ filename: finalName, blob })
        data.bio.avatar = `./${finalName}`
      })
    )
  }

  // Process all blob fetches in parallel
  await Promise.all(extractions)

  return { data, mediaFiles }
}

export function usePublish(state, dispatch, authFetch) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState(null)
  const [publishSuccess, setPublishSuccess] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const baselineRef = useRef(null)

  // Load state from backend (GitHub repo) or fall back to localStorage
  const loadFromRepo = useCallback(async (repoName) => {
    if (loaded) return

    try {
      const res = await authFetch(`${API_BASE}/${encodeURIComponent(repoName)}/data`)
      if (res.ok) {
        const data = await res.json()
        if (data && (data.sections || data.bio)) {
          dispatch({ type: LOAD_STATE, payload: data })
          baselineRef.current = JSON.stringify({ sections: data.sections, bio: data.bio, gridConfig: data.gridConfig })
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
      // Extract media blobs from blob URLs
      const { data, mediaFiles } = await extractMedia(state)

      // Send as multipart/form-data (no base64 overhead)
      const formData = new FormData()
      formData.append('data', JSON.stringify(data))
      formData.append('versionSummary', versionSummary)
      for (const { filename, blob } of mediaFiles) {
        formData.append('media', blob, filename)
      }

      const res = await authFetch(`${API_BASE}/${encodeURIComponent(repoName)}/publish`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || `Publish failed: ${res.status}`)
      }

      // Update localStorage with the committed paths
      localStorage.setItem(`${STORAGE_KEY}-${repoName}`, JSON.stringify(data))
      dispatch({ type: SAVE })
      baselineRef.current = JSON.stringify({ sections: data.sections, bio: data.bio, gridConfig: data.gridConfig })
      setPublishSuccess(true)
      return true
    } catch (err) {
      setPublishError(err.message || 'Publish failed')
      return false
    } finally {
      setPublishing(false)
    }
  }, [state, dispatch])

  const hasChanges = useMemo(() => {
    if (!baselineRef.current) return loaded
    const current = JSON.stringify({ sections: state.sections, bio: state.bio, gridConfig: state.gridConfig })
    return current !== baselineRef.current
  }, [state.sections, state.bio, state.gridConfig, loaded])

  const setBaseline = useCallback((data) => {
    baselineRef.current = JSON.stringify({ sections: data.sections, bio: data.bio, gridConfig: data.gridConfig })
  }, [])

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
    hasChanges,
    setBaseline,
  }
}
