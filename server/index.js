import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { bodyLimit } from 'hono/body-limit'
import authRoutes from './routes/auth.js'
import repoRoutes from './routes/repos.js'
import { rateLimit } from './lib/rateLimit.js'
import { supabase } from './lib/supabase.js'
import { cleanExpiredSessions } from './lib/sessions.js'

const app = new Hono()

app.use('*', logger())
const ALLOWED_ORIGINS = ['https://potfolio.me', 'http://localhost:5173', 'http://localhost:4173']
app.use('/api/*', cors({
  origin: (origin) => ALLOWED_ORIGINS.includes(origin) ? origin : null,
  credentials: true,
}))

// Global rate limit: 200 requests/min per IP across all endpoints
app.use('/api/*', rateLimit({ windowMs: 60_000, max: 200, prefix: 'global' }))

// Allow up to 50MB for publish payloads (multipart media files)
app.use('/api/repos/*/publish', bodyLimit({ maxSize: 50 * 1024 * 1024 }))

app.route('/api/auth', authRoutes)
app.route('/api/repos', repoRoutes)

// Health check — verifies database connectivity
app.get('/api/health', async (c) => {
  try {
    const { error } = await supabase.from('portfolios').select('portfolio_name').limit(1)
    if (error) throw error
    return c.json({ ok: true })
  } catch (err) {
    return c.json({ ok: false, error: 'Database unreachable' }, 503)
  }
})

/** Populate process.env from Cloudflare Worker bindings */
function hydrateEnv(env) {
  for (const [k, v] of Object.entries(env)) {
    if (typeof v === 'string') process.env[k] = v
  }
}

export default {
  fetch(request, env, ctx) {
    hydrateEnv(env)
    return app.fetch(request, env, ctx)
  },
  scheduled(event, env, ctx) {
    hydrateEnv(env)
    ctx.waitUntil(cleanExpiredSessions())
  },
}
