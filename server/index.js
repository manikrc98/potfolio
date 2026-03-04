import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { bodyLimit } from 'hono/body-limit'
import authRoutes from './routes/auth.js'
import repoRoutes from './routes/repos.js'

const app = new Hono()

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

app.use('*', logger())
app.use('/api/*', cors({
  origin: FRONTEND_URL,
  credentials: true,
}))

// Allow up to 50MB for publish payloads (media files as base64)
app.use('/api/repos/*/publish', bodyLimit({ maxSize: 50 * 1024 * 1024 }))

app.route('/api/auth', authRoutes)
app.route('/api/repos', repoRoutes)

app.get('/api/health', (c) => c.json({ ok: true }))

const port = parseInt(process.env.PORT || '3001', 10)

serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running on http://localhost:${port}`)
})
