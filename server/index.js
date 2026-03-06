import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { bodyLimit } from 'hono/body-limit'
import authRoutes from './routes/auth.js'
import repoRoutes from './routes/repos.js'
import { rateLimit } from './lib/rateLimit.js'
import { supabase } from './lib/supabase.js'

const app = new Hono()

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

app.use('*', logger())
app.use('/api/*', cors({
  origin: FRONTEND_URL,
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

const port = parseInt(process.env.PORT || '3001', 10)

serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running on http://localhost:${port}`)
})
