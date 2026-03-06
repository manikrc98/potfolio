/**
 * Sliding-window rate limiter middleware for Hono.
 * Tracks requests per key (IP or user) within a time window.
 */

const DEFAULT_WINDOW_MS = 60 * 1000 // 1 minute
const DEFAULT_MAX = 60
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000 // clean up stale entries every 5 min

class SlidingWindowLimiter {
  constructor() {
    this.hits = new Map() // key -> timestamp[]

    // Periodically purge stale keys to prevent unbounded memory growth
    setInterval(() => this._cleanup(), CLEANUP_INTERVAL_MS)
  }

  isAllowed(key, windowMs, max) {
    const now = Date.now()
    const cutoff = now - windowMs
    let timestamps = this.hits.get(key)

    if (timestamps) {
      // Remove timestamps outside the window
      timestamps = timestamps.filter((t) => t > cutoff)
    } else {
      timestamps = []
    }

    if (timestamps.length >= max) {
      this.hits.set(key, timestamps)
      return false
    }

    timestamps.push(now)
    this.hits.set(key, timestamps)
    return true
  }

  _cleanup() {
    const now = Date.now()
    for (const [key, timestamps] of this.hits) {
      const recent = timestamps.filter((t) => t > now - 5 * 60 * 1000)
      if (recent.length === 0) {
        this.hits.delete(key)
      } else {
        this.hits.set(key, recent)
      }
    }
  }
}

const limiter = new SlidingWindowLimiter()

/**
 * Create a Hono rate-limit middleware.
 * @param {{ windowMs?: number, max?: number, keyFn?: (c) => string, prefix?: string }} options
 *   `prefix` namespaces the counter so different middleware instances don't
 *   share the same bucket.  When omitted, the middleware auto-generates a
 *   prefix from the call-site so each `rateLimit()` invocation is isolated.
 */
let _autoId = 0
export function rateLimit({ windowMs = DEFAULT_WINDOW_MS, max = DEFAULT_MAX, keyFn, prefix } = {}) {
  const ns = prefix || `rl_${_autoId++}`
  return async (c, next) => {
    const raw = keyFn ? keyFn(c) : getClientIp(c)
    const key = `${ns}:${raw}`

    if (!limiter.isAllowed(key, windowMs, max)) {
      return c.json({ error: 'Too many requests. Please try again later.' }, 429)
    }

    await next()
  }
}

function getClientIp(c) {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown'
  )
}
