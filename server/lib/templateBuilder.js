import { clearAllBlobCaches } from './github.js'
import { readdir, readFile, access } from 'node:fs/promises'
import { join, relative, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEMPLATE_DIR = join(__dirname, '..', 'template')
const DIST_DIR = join(TEMPLATE_DIR, 'dist')

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.avif',
  '.mp4', '.webm', '.mov',
  '.woff', '.woff2', '.ttf', '.eot',
  '.zip', '.tar', '.gz',
])

let cachedDistFiles = null

/**
 * Check if the template has already been built and cached.
 */
export function isBuilt() {
  return cachedDistFiles !== null
}

/**
 * Recursively read all files from a directory.
 */
async function walkDir(dir) {
  const results = []
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      const nested = await walkDir(fullPath)
      results.push(...nested)
    } else {
      const relPath = relative(DIST_DIR, fullPath)
      const content = await readFile(fullPath)
      const ext = extname(fullPath).toLowerCase()
      results.push({
        path: relPath,
        content,
        isBinary: BINARY_EXTENSIONS.has(ext),
      })
    }
  }
  return results
}

/**
 * Read pre-built dist files from disk and cache them in memory.
 * The template must be built at deploy time (npm run build), not at runtime.
 */
export async function getDistFiles() {
  if (cachedDistFiles) return cachedDistFiles

  try {
    await access(DIST_DIR)
  } catch {
    throw new Error(
      'Template dist/ not found. Run "npm run build" in server/ to build the template before starting the server.'
    )
  }

  console.log('[templateBuilder] Reading pre-built dist files...')
  cachedDistFiles = await walkDir(DIST_DIR)
  console.log(`[templateBuilder] Cached ${cachedDistFiles.length} dist files`)

  return cachedDistFiles
}

/**
 * Invalidate the cache (e.g. if template code changes during development).
 */
export function invalidateCache() {
  cachedDistFiles = null
  clearAllBlobCaches()
}
