import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const STORE_PATH = join(__dirname, '..', 'portfolios.json')

let cache = null

async function load() {
  if (cache) return cache
  try {
    const raw = await readFile(STORE_PATH, 'utf-8')
    cache = JSON.parse(raw)
  } catch {
    cache = {}
  }
  return cache
}

async function save() {
  await writeFile(STORE_PATH, JSON.stringify(cache, null, 2), 'utf-8')
}

export async function getPortfolio(name) {
  const store = await load()
  return store[name] || null
}

export async function setPortfolio(name, { owner, repoName, pagesUrl }) {
  const store = await load()
  store[name] = { owner, repoName, pagesUrl }
  await save()
}

export async function hasPortfolio(name) {
  const store = await load()
  return name in store
}
