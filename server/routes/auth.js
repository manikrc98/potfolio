import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { exchangeCodeForToken, getUser } from '../lib/github.js'
import { createSession, getSession, deleteSession } from '../lib/sessions.js'

const COOKIE_NAME = 'bb_session'
const FRONTEND_URL = () => process.env.FRONTEND_URL || 'http://localhost:5173'

const auth = new Hono()

// Redirect to GitHub OAuth
auth.get('/login', (c) => {
  const clientId = process.env.GITHUB_CLIENT_ID
  const redirectUri = `${FRONTEND_URL()}/auth/callback`
  const scope = 'repo delete_repo read:user workflow'
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&prompt=consent`
  return c.redirect(url)
})

// Exchange code for token + create session
auth.post('/callback', async (c) => {
  try {
    const { code } = await c.req.json()
    if (!code) return c.json({ error: 'Missing code' }, 400)

    const token = await exchangeCodeForToken(code)
    const user = await getUser(token)

    const sessionId = createSession(token, {
      login: user.login,
      avatar_url: user.avatar_url,
      name: user.name,
    })

    setCookie(c, COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    })

    return c.json({
      sessionId,
      user: {
        login: user.login,
        avatar_url: user.avatar_url,
        name: user.name,
      },
    })
  } catch (err) {
    console.error('Auth callback error:', err)
    return c.json({ error: err.message }, 500)
  }
})

// Check current session
auth.get('/me', (c) => {
  const sessionId =
    getCookie(c, COOKIE_NAME) ||
    c.req.header('Authorization')?.replace('Bearer ', '')
  if (!sessionId) return c.json({ user: null }, 401)

  const session = getSession(sessionId)
  if (!session) {
    deleteCookie(c, COOKIE_NAME)
    return c.json({ user: null }, 401)
  }

  return c.json({ user: session.user })
})

// Logout
auth.post('/logout', (c) => {
  const sessionId =
    getCookie(c, COOKIE_NAME) ||
    c.req.header('Authorization')?.replace('Bearer ', '')
  if (sessionId) {
    deleteSession(sessionId)
    deleteCookie(c, COOKIE_NAME)
  }
  return c.json({ ok: true })
})

export default auth
