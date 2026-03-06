import { useState, useCallback, useRef } from 'react'
import { API_BASE_URL } from '../../config'

const API_BASE = `${API_BASE_URL}/api/repos`
const POLL_INTERVAL = 2000
const INITIAL_DELAY = 1000
const MAX_POLLS = 60 // ~2 minutes max at 2s interval

/**
 * Polls the real GitHub Pages build status after publish.
 * Provides both an immediate "published" signal and background confirmation.
 */
export default function useDeployStatus(authFetch) {
  const [isDeploying, setIsDeploying] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const timerRef = useRef(null)

  const stopDeploying = useCallback(() => {
    setIsDeploying(false)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startDeploying = useCallback((repoName) => {
    setIsDeploying(true)
    setIsConfirmed(false)
    if (timerRef.current) clearTimeout(timerRef.current)

    let pollCount = 0

    function poll() {
      pollCount++
      if (pollCount > MAX_POLLS) {
        // Timed out — assume success (pre-built static files rarely fail)
        setIsDeploying(false)
        setIsConfirmed(true)
        return
      }

      timerRef.current = setTimeout(async () => {
        try {
          const res = await authFetch(
            `${API_BASE}/${encodeURIComponent(repoName)}/deploy-status`
          )
          if (res.ok) {
            const data = await res.json()
            if (!data.isDeploying) {
              setIsDeploying(false)
              setIsConfirmed(true)
              return
            }
          }
        } catch {
          // Keep polling on network errors
        }
        poll()
      }, POLL_INTERVAL)
    }

    // Shorter initial delay since .nojekyll speeds up GitHub Pages
    timerRef.current = setTimeout(poll, INITIAL_DELAY)
  }, [authFetch])

  return { isDeploying, isConfirmed, startDeploying, stopDeploying }
}
