import { readdir, readFile } from 'node:fs/promises'
import { join, relative, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEMPLATE_DIR = join(__dirname, '..', 'template')

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.avif',
  '.mp4', '.webm', '.mov',
  '.woff', '.woff2', '.ttf', '.eot',
  '.zip', '.tar', '.gz',
])

function isBinaryExt(filePath) {
  return BINARY_EXTENSIONS.has(extname(filePath).toLowerCase())
}

/**
 * Recursively read all files from the template directory.
 * @returns {Promise<{ path: string, content: Buffer, isBinary: boolean }[]>}
 */
export async function readTemplateFiles() {
  const files = []

  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        // Skip node_modules and .git
        if (entry.name === 'node_modules' || entry.name === '.git') continue
        await walk(fullPath)
      } else {
        const relPath = relative(TEMPLATE_DIR, fullPath)
        const content = await readFile(fullPath)
        files.push({
          path: relPath,
          content,
          isBinary: isBinaryExt(fullPath),
        })
      }
    }
  }

  await walk(TEMPLATE_DIR)
  return files
}

/**
 * Customize template files for a specific user/repo.
 * @param {{ path: string, content: Buffer, isBinary: boolean }[]} files
 * @param {{ repoName: string }} options
 * @returns {{ path: string, content: Buffer, isBinary: boolean }[]}
 */
export function customizeFiles(files, { repoName }) {
  return files.map((file) => {
    if (file.isBinary) return file

    let text = file.content.toString('utf-8')

    // Replace repo name placeholder in vite.config.js
    if (file.path === 'vite.config.js') {
      text = text.replace('__REPO_NAME__', repoName)
    }

    // Replace name in package.json
    if (file.path === 'package.json') {
      text = text.replace('"my-bento-portfolio"', `"${repoName}"`)
    }

    return {
      ...file,
      content: Buffer.from(text, 'utf-8'),
    }
  })
}
