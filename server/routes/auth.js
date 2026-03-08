import { Hono } from 'hono'
import { exchangeCodeForToken, getUser } from '../lib/github.js'
import { createSession, getSession, deleteSession } from '../lib/sessions.js'

const FRONTEND_URL = () => process.env.FRONTEND_URL || 'http://localhost:5173'

const auth = new Hono()

/**
 * Pick the correct OAuth App credentials based on the request origin.
 * Production and localhost each have their own OAuth App (different callback URLs).
 * They share the same backend and Supabase sessions, so user data stays in sync.
 */
function getOAuthCredentials(origin) {
  if (origin && origin.includes('localhost')) {
    return {
      clientId: process.env.GITHUB_CLIENT_ID_LOCAL || process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET_LOCAL || process.env.GITHUB_CLIENT_SECRET,
    }
  }
  return {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  }
}

// Redirect to GitHub OAuth
auth.get('/login', (c) => {
  const origin = c.req.query('origin') || FRONTEND_URL()
  const { clientId } = getOAuthCredentials(origin)
  const redirectUri = `${origin}/auth/callback`
  const scope = 'repo delete_repo read:user workflow'
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&prompt=consent`
  return c.redirect(url)
})

// Exchange code for token + create session
auth.post('/callback', async (c) => {
  try {
    const { code, origin } = await c.req.json()
    if (!code) return c.json({ error: 'Missing code' }, 400)

    const { clientId, clientSecret } = getOAuthCredentials(origin)
    const token = await exchangeCodeForToken(code, { clientId, clientSecret })
    const user = await getUser(token)

    const sessionId = await createSession(token, {
      login: user.login,
      avatar_url: user.avatar_url,
      name: user.name,
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
auth.get('/me', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!sessionId) return c.json({ user: null }, 401)

  const session = await getSession(sessionId)
  if (!session) return c.json({ user: null }, 401)

  return c.json({ user: session.user })
})

// Logout
auth.post('/logout', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  if (sessionId) {
    await deleteSession(sessionId)
  }
  return c.json({ ok: true })
})

export default auth
