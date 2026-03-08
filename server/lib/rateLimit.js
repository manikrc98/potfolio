/**
 * Rate-limit middleware stub for Hono.
 *
 * In-memory rate limiting is ineffective on Cloudflare Workers (state resets
 * on every cold start). This is a pass-through no-op that preserves the
 * middleware signature so it can be replaced with Cloudflare Rate Limiting
 * rules later. All existing rateLimit() calls in routes stay unchanged.
 */
export function rateLimit(_options = {}) {
  return async (_c, next) => {
    await next()
  }
}
