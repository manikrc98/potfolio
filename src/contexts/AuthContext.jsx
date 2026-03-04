import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const popupRef = useRef(null)
  const pollRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()

  // Check if user has an existing Potfolio repo and navigate accordingly
  const navigateAfterAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/repos/check', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        if (data.hasRepo) {
          navigate(`/editor/${data.repoName}`, { replace: true })
          return
        }
      }
    } catch {
      // Fall through to dashboard
    }
    navigate('/dashboard', { replace: true })
  }, [navigate])

  // Check session on mount — if already authenticated on landing page, redirect
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => {
        if (res.ok) return res.json()
        return { user: null }
      })
      .then(data => {
        setUser(data.user)
        // If user is already authenticated and on the landing page, redirect them
        if (data.user && location.pathname === '/') {
          navigateAfterAuth()
        }
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Listen for auth messages from popup
  useEffect(() => {
    function handleMessage(e) {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'auth-success' && e.data?.user) {
        setUser(e.data.user)
        setLoginModalOpen(false)
        if (pollRef.current) clearInterval(pollRef.current)
        // Navigate away from landing page after auth
        navigateAfterAuth()
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [navigateAfterAuth])

  const login = useCallback(() => {
    const width = 500
    const height = 700
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2
    const popup = window.open(
      '/api/auth/login',
      'github-login',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    )
    popupRef.current = popup
    setLoginModalOpen(true)

    // Poll to detect if user closes the popup manually
    pollRef.current = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(pollRef.current)
        setLoginModalOpen(false)
      }
    }, 500)
  }, [])

  const closeLoginModal = useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close()
    }
    if (pollRef.current) clearInterval(pollRef.current)
    setLoginModalOpen(false)
  }, [])

  const handleCallback = useCallback(async (code) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Authentication failed')
      setUser(data.user)
      return data.user
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, handleCallback, loginModalOpen, closeLoginModal, navigateAfterAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
