import { clearAllBlobCaches } from './github.js'
import bundledDistFiles from '../generated/distFiles.js'

let cachedDistFiles = null

/**
 * Check if the template has already been built and cached.
 */
export function isBuilt() {
  return cachedDistFiles !== null
}

/**
 * Return pre-built dist files (bundled at build time).
 * Converts bundled data back to Buffer format on first call, then caches.
 */
export function getDistFiles() {
  if (cachedDistFiles) return cachedDistFiles

  cachedDistFiles = bundledDistFiles.map((f) => ({
    path: f.path,
    content: f.isBinary ? Buffer.from(f.content, 'base64') : Buffer.from(f.content, 'utf-8'),
    isBinary: f.isBinary,
  }))

  console.log(`[templateBuilder] Loaded ${cachedDistFiles.length} bundled dist files`)
  return cachedDistFiles
}

/**
 * Invalidate the cache (e.g. if template code changes during development).
 */
export function invalidateCache() {
  cachedDistFiles = null
  clearAllBlobCaches()
}
