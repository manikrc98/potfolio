import { useState, useCallback, useRef } from 'react'
import { API_BASE_URL } from '../../config'

const API_BASE = `${API_BASE_URL}/api/repos`
const POLL_INTERVAL = 4000
const MAX_POLLS = 45 // ~3 minutes max

/**
 * Polls the real GitHub Pages build status after publish.
 */
export default function useDeployStatus(authFetch) {
  const [isDeploying, setIsDeploying] = useState(false)
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
    if (timerRef.current) clearTimeout(timerRef.current)

    let pollCount = 0

    function poll() {
      pollCount++
      if (pollCount > MAX_POLLS) {
        setIsDeploying(false)
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
              return
            }
          }
        } catch {
          // Keep polling on network errors
        }
        poll()
      }, POLL_INTERVAL)
    }

    // Delay first poll to let GitHub Pages queue the build
    timerRef.current = setTimeout(poll, 3000)
  }, [authFetch])

  return { isDeploying, startDeploying, stopDeploying }
}
