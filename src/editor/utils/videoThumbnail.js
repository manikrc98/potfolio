/**
 * Shared internal: seek a video to its first frame and resolve with a JPEG Blob.
 * Returns null on timeout or error.
 */
function _extractBlob(videoUrl) {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.playsInline = true
    video.preload = 'metadata'

    let settled = false
    function finish(result) {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      video.src = ''
      video.load()
      resolve(result)
    }

    video.addEventListener('loadedmetadata', () => {
      video.currentTime = 0.001
    }, { once: true })

    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 360
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(
          (blob) => finish(blob || null),
          'image/jpeg',
          0.8,
        )
      } catch {
        finish(null)
      }
    }, { once: true })

    video.addEventListener('error', () => finish(null), { once: true })

    const timeout = setTimeout(() => finish(null), 8000)

    video.src = videoUrl
  })
}

/**
 * Extract a thumbnail (JPEG blob URL) from the first frame of a video.
 * Results are cached by video URL so the same video is never seeked twice.
 */
const thumbnailCache = new Map()

export function extractVideoThumbnail(videoUrl) {
  if (!videoUrl) return Promise.resolve(null)
  if (thumbnailCache.has(videoUrl)) {
    return Promise.resolve(thumbnailCache.get(videoUrl))
  }

  return _extractBlob(videoUrl).then(blob => {
    if (!blob) return null
    const url = URL.createObjectURL(blob)
    thumbnailCache.set(videoUrl, url)
    return url
  })
}

/**
 * Extract the first frame of a video as a JPEG Blob.
 * Not cached — intended for upload use (e.g. during publish).
 * Returns null on failure.
 */
export function extractFrameAsBlob(videoUrl) {
  if (!videoUrl) return Promise.resolve(null)
  return _extractBlob(videoUrl)
}
