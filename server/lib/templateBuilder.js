import { execSync } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
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
let building = false

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
 * Build the template once (npm install + vite build) and cache the dist/ output.
 * Returns array of { path, content, isBinary } for all dist files.
 */
export async function getDistFiles() {
  if (cachedDistFiles) return cachedDistFiles

  if (building) {
    // Another request is already building — wait for it
    while (building) {
      await new Promise((r) => setTimeout(r, 500))
    }
    return cachedDistFiles
  }

  building = true
  try {
    console.log('[templateBuilder] Installing template dependencies...')
    execSync('npm install --prefer-offline', { cwd: TEMPLATE_DIR, stdio: 'pipe' })

    console.log('[templateBuilder] Building template...')
    execSync('npm run build', { cwd: TEMPLATE_DIR, stdio: 'pipe' })

    console.log('[templateBuilder] Reading dist files...')
    cachedDistFiles = await walkDir(DIST_DIR)
    console.log(`[templateBuilder] Cached ${cachedDistFiles.length} dist files`)

    return cachedDistFiles
  } finally {
    building = false
  }
}

/**
 * Invalidate the cache (e.g. if template code changes during development).
 */
export function invalidateCache() {
  cachedDistFiles = null
}
