import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { API_BASE_URL } from '../config'

const AuthContext = createContext(null)

const SESSION_KEY = 'potfolio_session'

function getStoredSession() {
  try {
    return localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

function storeSession(sessionId) {
  try {
    if (sessionId) {
      localStorage.setItem(SESSION_KEY, sessionId)
    } else {
      localStorage.removeItem(SESSION_KEY)
    }
  } catch {
    // localStorage unavailable
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const sessionRef = useRef(getStoredSession())
  const popupRef = useRef(null)
  const pollRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()

  // Authenticated fetch helper — adds Authorization header and retries on network errors
  // (handles Render free-tier cold starts where the first request may fail with no CORS headers)
  const authFetch = useCallback(async (url, options = {}) => {
    const headers = { ...options.headers }
    if (sessionRef.current) {
      headers['Authorization'] = `Bearer ${sessionRef.current}`
    }
    try {
      return await fetch(url, { ...options, headers })
    } catch (err) {
      // Network error (e.g. cold start CORS failure) — wait for service to wake up and retry once
      await new Promise((r) => setTimeout(r, 3000))
      return fetch(url, { ...options, headers })
    }
  }, [])

  // Check if user has an existing Potfolio repo and navigate accordingly
  const navigateAfterAuth = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/repos/check`)
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
  }, [navigate, authFetch])

  // Check session on mount — if already authenticated on landing page, redirect
  useEffect(() => {
    authFetch(`${API_BASE_URL}/api/auth/me`)
      .then(res => {
        if (res.ok) return res.json()
        // Session invalid — clear stored session
        sessionRef.current = null
        storeSession(null)
        return { user: null }
      })
      .then(data => {
        setUser(data.user)
        // If user is already authenticated and on the landing page, redirect them
        if (data.user && location.pathname === '/') {
          navigateAfterAuth()
        }
      })
      .catch(() => {
        setUser(null)
        sessionRef.current = null
        storeSession(null)
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Listen for auth messages from popup
  useEffect(() => {
    function handleMessage(e) {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'auth-success' && e.data?.user) {
        if (e.data.sessionId) {
          sessionRef.current = e.data.sessionId
          storeSession(e.data.sessionId)
        }
        setUser(e.data.user)
        setLoginModalOpen(false)
        if (pollRef.current) clearInterval(pollRef.current)
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
      `${API_BASE_URL}/api/auth/login?origin=${encodeURIComponent(window.location.origin)}`,
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
      const res = await fetch(`${API_BASE_URL}/api/auth/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Authentication failed')
      // Store session token
      if (data.sessionId) {
        sessionRef.current = data.sessionId
        storeSession(data.sessionId)
      }
      setUser(data.user)
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    await authFetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST' })
    sessionRef.current = null
    storeSession(null)
    setUser(null)
  }, [authFetch])

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, handleCallback, loginModalOpen, closeLoginModal, navigateAfterAuth, authFetch }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
