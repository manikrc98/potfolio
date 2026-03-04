import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { API_BASE_URL } from '../config'

export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { handleCallback, authFetch } = useAuth()
  const [error, setError] = useState(null)

  const isPopup = window.opener !== null
  const handledRef = useRef(false)

  useEffect(() => {
    if (handledRef.current) return
    handledRef.current = true

    const code = searchParams.get('code')
    if (!code) {
      setError('No authorization code received')
      return
    }

    handleCallback(code)
      .then(async (data) => {
        if (isPopup) {
          // Send user data + sessionId back to the parent window and close
          window.opener.postMessage(
            { type: 'auth-success', user: data.user, sessionId: data.sessionId },
            window.location.origin
          )
          window.close()
        } else {
          // Check if user has an existing Potfolio repo
          try {
            const res = await authFetch(`${API_BASE_URL}/api/repos/check`)
            if (res.ok) {
              const repoData = await res.json()
              if (repoData.hasRepo) {
                navigate(`/editor/${repoData.repoName}`, { replace: true })
                return
              }
            }
          } catch {
            // Fall through to dashboard
          }
          navigate('/dashboard', { replace: true })
        }
      })
      .catch(err => setError(err.message))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
            <span className="text-red-500 text-xl">!</span>
          </div>
          <h2 className="text-lg font-semibold text-zinc-800 mb-2">Authentication Failed</h2>
          <p className="text-sm text-zinc-500 mb-6">{error}</p>
          <a
            href="/"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-colors"
          >
            Back to Home
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="w-8 h-8 mx-auto mb-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-zinc-500">Signing you in...</p>
      </div>
    </div>
  )
}
