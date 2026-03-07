import bundledFiles from '../generated/templateFiles.js'

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.avif',
  '.mp4', '.webm', '.mov',
  '.woff', '.woff2', '.ttf', '.eot',
  '.zip', '.tar', '.gz',
])

/**
 * Return all template source files (bundled at build time).
 * @returns {{ path: string, content: Buffer, isBinary: boolean }[]}
 */
export function readTemplateFiles() {
  return bundledFiles.map((f) => ({
    path: f.path,
    content: f.isBinary ? Buffer.from(f.content, 'base64') : Buffer.from(f.content, 'utf-8'),
    isBinary: f.isBinary,
  }))
}

/**
 * Customize template files for a specific user/repo.
 * @param {{ path: string, content: Buffer, isBinary: boolean }[]} files
 * @param {{ repoName: string, portfolioName?: string }} options
 * @returns {{ path: string, content: Buffer, isBinary: boolean }[]}
 */
export function customizeFiles(files, { repoName, portfolioName }) {
  const basePath = portfolioName || repoName
  return files.map((file) => {
    if (file.isBinary) return file

    let text = file.content.toString('utf-8')

    // Replace repo name placeholder in vite.config.js
    if (file.path === 'vite.config.js') {
      text = text.replace('__REPO_NAME__', basePath)
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
