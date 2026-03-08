import { Hono } from 'hono'
import { getSession } from '../lib/sessions.js'
import { createRepo, waitForRepoReady, pushFiles, pushToGhPages, enableGitHubPages, setCustomDomain, deleteRepo, getLatestPagesBuild, clearBlobCache, listGhPagesCommits, getFileAtCommit } from '../lib/github.js'
import { readTemplateFiles, customizeFiles } from '../lib/templateReader.js'
import { getPortfolio, setPortfolio, deletePortfolio, getPortfolioByRepo, getPortfolioByOwner, getAllPortfolios } from '../lib/portfolioStore.js'
import { createDnsRecord, deleteDnsRecord } from '../lib/cloudflare.js'
import { getDistFiles, isBuilt } from '../lib/templateBuilder.js'
import { rateLimit } from '../lib/rateLimit.js'

const repos = new Hono()

// Track repos that have GitHub Pages enabled to skip redundant API calls.
// Bounded: evict oldest entry when over 10 000 to prevent unbounded growth.
const MAX_PAGES_CACHE = 10_000
const pagesEnabledRepos = new Set()

function trackPagesEnabled(key) {
  if (pagesEnabledRepos.size >= MAX_PAGES_CACHE) {
    const first = pagesEnabledRepos.values().next().value
    pagesEnabledRepos.delete(first)
  }
  pagesEnabledRepos.add(key)
}

// Auth middleware — requires Authorization: Bearer header
async function requireAuth(c) {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!sessionId) return null
  return await getSession(sessionId)
}

// ── Public: list all portfolios for showcase (paginated) ────────────────────
repos.get('/portfolios', rateLimit({ windowMs: 60_000, max: 60, prefix: 'portfolios' }), async (c) => {
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100)
    const offset = Math.max(parseInt(c.req.query('offset') || '0', 10), 0)
    const portfolios = await getAllPortfolios({ limit, offset })
    return c.json({ portfolios })
  } catch (err) {
    console.error('List portfolios error:', err)
    return c.json({ portfolios: [] })
  }
})

// ── Check: find existing Potfolio repos for the authenticated user ─────
repos.get('/check', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Not authenticated' }, 401)

  try {
    const owner = session.user.login
    const entry = await getPortfolioByOwner(owner)

    if (entry) {
      return c.json({ hasRepo: true, repoName: entry.repoName })
    }

    return c.json({ hasRepo: false })
  } catch (err) {
    console.error('Repo check error:', err)
    return c.json({ error: err.message }, 500)
  }
})

// Phase 1: Create repo + push source to main (lightweight — few subrequests)
repos.post('/create', rateLimit({ windowMs: 60_000, max: 5, prefix: 'create' }), async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Not authenticated' }, 401)

  // Track what was created so we can roll back on failure
  let createdRepoName = null
  let createdDnsName = null

  try {
    const { repoName = 'my-bento-portfolio', portfolioName } = await c.req.json()

    // Validate repo name
    const sanitized = repoName.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 100)
    if (!sanitized) return c.json({ error: 'Invalid repo name' }, 400)

    const sanitizedPortfolio = portfolioName
      ? portfolioName.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 100)
      : sanitized

    const owner = session.user.login
    const token = session.token

    // 1. Create the repo (auto_init: true — GitHub creates initial commit with README)
    const repo = await createRepo(token, sanitized)
    createdRepoName = sanitized

    // 2. Wait for GitHub to provision the initial commit
    await waitForRepoReady(token, owner, sanitized)

    // 3. Read and customize template files
    const rawFiles = await readTemplateFiles()
    const files = customizeFiles(rawFiles, { repoName: sanitized, portfolioName: sanitizedPortfolio })

    // 3b. Add CNAME file for custom subdomain (portfolioName.potfolio.me)
    const customDomain = `${sanitizedPortfolio}.potfolio.me`
    files.push({
      path: 'CNAME',
      content: Buffer.from(customDomain, 'utf-8'),
      isBinary: false,
    })

    // 4. Create DNS CNAME record (portfolioName.potfolio.me → owner.github.io)
    await createDnsRecord(sanitizedPortfolio, `${owner}.github.io`)
    createdDnsName = sanitizedPortfolio

    // 5. Push template source to main branch (repo already has initial commit)
    await pushFiles(token, owner, sanitized, files)

    const pagesUrl = `https://${customDomain}`

    // 6. Store portfolio name → custom domain mapping
    await setPortfolio(sanitizedPortfolio, { owner, repoName: sanitized, pagesUrl })

    return c.json({
      repoUrl: repo.html_url,
      projectUrl: pagesUrl,
      pagesUrl,
      repoName: sanitized,
      portfolioName: sanitizedPortfolio,
    })
  } catch (err) {
    console.error('Repo creation error:', err)

    // Rollback: clean up any resources that were created before the failure
    const owner = session.user.login
    const token = session.token
    if (createdRepoName) {
      try {
        await deleteRepo(token, owner, createdRepoName)
        console.log(`[rollback] Deleted repo ${owner}/${createdRepoName}`)
      } catch (rollbackErr) {
        console.error('[rollback] Failed to delete repo:', rollbackErr)
      }
    }
    if (createdDnsName) {
      try {
        await deleteDnsRecord(createdDnsName)
        console.log(`[rollback] Deleted DNS record for ${createdDnsName}`)
      } catch (rollbackErr) {
        console.error('[rollback] Failed to delete DNS record:', rollbackErr)
      }
    }

    return c.json({ error: err.message }, 500)
  }
})

// Phase 2: Deploy to gh-pages + enable GitHub Pages (separate Worker invocation)
repos.post('/create/deploy', rateLimit({ windowMs: 60_000, max: 5, prefix: 'create-deploy' }), async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Not authenticated' }, 401)

  try {
    const { repoName, portfolioName } = await c.req.json()
    if (!repoName) return c.json({ error: 'Missing repoName' }, 400)

    const owner = session.user.login
    const token = session.token
    const customDomain = portfolioName ? `${portfolioName}.potfolio.me` : null

    // 1. Get pre-built dist files and push to gh-pages for instant deploy
    const distFiles = await getDistFiles()
    const ghPagesFiles = [
      ...distFiles.map(f => ({ ...f, cacheable: true })),
      { path: 'data.json', content: Buffer.from('{}', 'utf-8'), isBinary: false },
      { path: '.nojekyll', content: Buffer.from('', 'utf-8'), isBinary: false, cacheable: true },
    ]
    if (customDomain) {
      ghPagesFiles.push({ path: 'CNAME', content: Buffer.from(customDomain, 'utf-8'), isBinary: false })
    }
    await pushToGhPages(token, owner, repoName, ghPagesFiles, 'Initial deploy — Potfolio')

    // 2. Enable GitHub Pages with branch-based deployment
    await enableGitHubPages(token, owner, repoName)
    trackPagesEnabled(`${owner}/${repoName}`)

    // 3. Set custom subdomain on GitHub Pages
    if (customDomain) {
      await setCustomDomain(token, owner, repoName, customDomain)
    }

    return c.json({ success: true })
  } catch (err) {
    console.error('Deploy error:', err)
    return c.json({ error: err.message }, 500)
  }
})

// ── Publish: push pre-built dist + data + media directly to gh-pages ──────────
// Accepts multipart/form-data: "data" (JSON string), "versionSummary" (text), "media" (files)
repos.post('/:repoName/publish', rateLimit({ windowMs: 60_000, max: 10, prefix: 'publish' }), async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Not authenticated' }, 401)

  try {
    const repoName = c.req.param('repoName')

    // Parse multipart form data
    const body = await c.req.parseBody({ all: true })
    const data = typeof body.data === 'string' ? JSON.parse(body.data) : body.data
    const versionSummary = body.versionSummary

    if (!data) return c.json({ error: 'Missing data payload' }, 400)
    if (!versionSummary?.trim()) return c.json({ error: 'Version summary is required' }, 400)

    const owner = session.user.login
    const token = session.token

    // Track if this is the first build (template not yet cached)
    const firstBuild = !isBuilt()

    // 1. Get pre-built dist files (reads from disk + caches on first call)
    console.log('[publish] getting dist files…')
    const distFiles = await getDistFiles()

    // 2. Combine dist + data.json + media into file list for gh-pages
    const files = distFiles.map(f => ({ ...f, cacheable: true }))

    // Skip Jekyll processing for faster GitHub Pages deploys
    files.push({
      path: '.nojekyll',
      content: Buffer.from('', 'utf-8'),
      isBinary: false,
      cacheable: true,
    })

    // data.json at root of gh-pages
    files.push({
      path: 'data.json',
      content: Buffer.from(JSON.stringify(data, null, 2), 'utf-8'),
      isBinary: false,
    })

    // Media files from multipart upload
    const mediaFiles = body.media
      ? (Array.isArray(body.media) ? body.media : [body.media])
      : []

    for (const file of mediaFiles) {
      if (!(file instanceof File)) continue
      const safeName = file.name.replace(/\.\./g, '').replace(/^\//, '')
      const buffer = Buffer.from(await file.arrayBuffer())
      files.push({
        path: safeName,
        content: buffer,
        isBinary: true,
      })
    }

    // CNAME file for custom domain
    const portfolio = await getPortfolioByRepo(repoName, owner)
    if (portfolio?.pagesUrl) {
      try {
        const domain = new URL(portfolio.pagesUrl).hostname
        files.push({ path: 'CNAME', content: Buffer.from(domain, 'utf-8'), isBinary: false })
      } catch { /* skip if URL is invalid */ }
    }

    // 3. Ensure GitHub Pages is set to branch-based (skip if already confirmed)
    const repoKey = `${owner}/${repoName}`
    if (!pagesEnabledRepos.has(repoKey)) {
      await enableGitHubPages(token, owner, repoName)
      trackPagesEnabled(repoKey)
    }

    // 4. Push directly to gh-pages — no workflow needed
    console.log('[publish] pushing to gh-pages…')
    const commit = await pushToGhPages(token, owner, repoName, files, versionSummary.trim())
    console.log('[publish] done, commit:', commit.sha)

    return c.json({
      success: true,
      commitSha: commit.sha,
      commitUrl: commit.html_url,
      firstBuild,
    })
  } catch (err) {
    console.error('Publish error:', err)
    return c.json({ error: err.message }, 500)
  }
})

// ── Load: fetch data.json from an existing repo ───────────────────────────────
repos.get('/:repoName/data', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Not authenticated' }, 401)

  try {
    const repoName = c.req.param('repoName')
    const owner = session.user.login
    const token = session.token

    const url = `https://api.github.com/repos/${owner}/${repoName}/contents/data.json?ref=gh-pages`
    console.log(`[data] Fetching ${url}`)
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.raw+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Potfolio-App',
      },
      cf: { cacheTtl: 0 },
    })

    console.log(`[data] GitHub responded ${res.status} for ${owner}/${repoName}`)
    if (!res.ok) {
      const body = await res.text().catch(() => '(no body)')
      console.error(`[data] GitHub error body: ${body}`)
      if (res.status === 404 || res.status === 409) {
        // No data.json yet (or repo still initializing) — return empty so the editor uses defaults
        return c.json({})
      }
      // GitHub 5xx = transient — treat as empty rather than failing the editor
      if (res.status >= 500) {
        return c.json({})
      }
      throw new Error(`GitHub API error: ${res.status}`)
    }

    const text = await res.text()
    console.log(`[data] Raw response length: ${text.length}, preview: ${text.slice(0, 200)}`)
    try {
      const data = JSON.parse(text)
      return c.json(data)
    } catch (parseErr) {
      console.error(`[data] Failed to parse data.json as JSON: ${parseErr.message}`)
      return c.json({})
    }
  } catch (err) {
    console.error('Load data error:', err)
    return c.json({ error: err.message }, 500)
  }
})

// ── Info: return portfolio metadata for a repo ────────────────────────────────
repos.get('/:repoName/info', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Not authenticated' }, 401)

  const repoName = c.req.param('repoName')
  const owner = session.user.login

  const entry = await getPortfolioByRepo(repoName, owner)
  if (!entry) return c.json({ error: 'Portfolio not found' }, 404)

  return c.json({
    portfolioName: entry.portfolioName,
    pagesUrl: entry.pagesUrl,
  })
})

// ── Deploy status: check latest GitHub Actions workflow run ────────────────
repos.get('/:repoName/deploy-status', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Not authenticated' }, 401)

  try {
    const repoName = c.req.param('repoName')
    const owner = session.user.login
    const token = session.token

    const build = await getLatestPagesBuild(token, owner, repoName)
    if (!build) {
      return c.json({ status: 'unknown', isDeploying: true })
    }

    const isDeploying = build.status === 'queued' || build.status === 'building'
    return c.json({
      status: build.status,
      isDeploying,
    })
  } catch (err) {
    console.error('Deploy status error:', err)
    return c.json({ status: 'unknown', isDeploying: true })
  }
})

// ── Resolve: redirect potfolio.me/<name> to the actual GitHub Pages URL ───────
repos.get('/resolve/:portfolioName', rateLimit({ windowMs: 60_000, max: 60, prefix: 'resolve' }), async (c) => {
  const name = c.req.param('portfolioName')

  // 1. Check persisted store first
  const entry = await getPortfolio(name)
  if (entry) {
    return c.json({ pagesUrl: entry.pagesUrl })
  }

  // 2. Fallback: search GitHub for repos with the Potfolio description matching this name
  try {
    const query = encodeURIComponent(`${name} in:name "My Bento Portfolio — built with Potfolio" in:description`)
    const res = await fetch(
      `https://api.github.com/search/repositories?q=${query}&per_page=5`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    )

    if (res.ok) {
      const data = await res.json()
      const match = data.items?.find((r) => r.name === name)
      if (match) {
        const pagesUrl = `https://${match.owner.login}.github.io/${match.name}/`
        // Persist for future lookups
        await setPortfolio(name, { owner: match.owner.login, repoName: match.name, pagesUrl })
        return c.json({ pagesUrl })
      }
    }
  } catch (err) {
    console.error('GitHub search fallback error:', err)
  }

  return c.json({ error: 'Portfolio not found' }, 404)
})

// ── History: list past published versions (gh-pages commits) ──────────────────
repos.get('/:repoName/history', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Not authenticated' }, 401)

  try {
    const repoName = c.req.param('repoName')
    const owner = session.user.login
    const token = session.token

    const commits = await listGhPagesCommits(token, owner, repoName)
    const versions = commits
      .filter(c => c.commit.message !== 'Initial deploy — Potfolio')
      .map(c => ({
        sha: c.sha,
        message: c.commit.message,
        date: c.commit.committer.date,
      }))

    return c.json({ versions })
  } catch (err) {
    console.error('History error:', err)
    return c.json({ error: err.message }, 500)
  }
})

// ── Version: fetch data.json at a specific commit ─────────────────────────────
repos.get('/:repoName/version/:sha', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Not authenticated' }, 401)

  try {
    const repoName = c.req.param('repoName')
    const sha = c.req.param('sha')
    const owner = session.user.login
    const token = session.token

    const data = await getFileAtCommit(token, owner, repoName, 'data.json', sha)

    // Convert relative media paths to absolute Pages URLs so they render in the editor
    const portfolio = await getPortfolioByRepo(repoName, owner)
    const baseUrl = portfolio?.pagesUrl || `https://${owner}.github.io/${repoName}`

    function resolveMediaUrls(obj) {
      if (!obj || typeof obj !== 'object') return obj
      if (Array.isArray(obj)) return obj.map(resolveMediaUrls)
      const result = {}
      for (const [key, val] of Object.entries(obj)) {
        if (typeof val === 'string' && (val.startsWith('./media/') || val.startsWith('media/'))) {
          result[key] = `${baseUrl}/${val.replace('./', '')}`
        } else if (typeof val === 'object') {
          result[key] = resolveMediaUrls(val)
        } else {
          result[key] = val
        }
      }
      return result
    }

    return c.json(resolveMediaUrls(data))
  } catch (err) {
    console.error('Version fetch error:', err)
    return c.json({ error: err.message }, 500)
  }
})

// ── Delete: remove repo from GitHub and Supabase ──────────────────────────────
repos.delete('/:repoName', rateLimit({ windowMs: 60_000, max: 5, prefix: 'delete' }), async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Not authenticated' }, 401)

  try {
    const repoName = c.req.param('repoName')
    const owner = session.user.login
    const token = session.token

    // 1. Find the portfolio entry for this repo
    const entry = await getPortfolioByRepo(repoName, owner)

    // 2. Delete the GitHub repo
    await deleteRepo(token, owner, repoName)

    // 2b. Clear cached blob SHAs for this repo
    clearBlobCache(owner, repoName)
    pagesEnabledRepos.delete(`${owner}/${repoName}`)

    // 3. Delete the DNS CNAME record
    if (entry) {
      await deleteDnsRecord(entry.portfolioName)
    }

    // 4. Delete the portfolio mapping from Supabase
    if (entry) {
      await deletePortfolio(entry.portfolioName, owner)
    }

    return c.json({ success: true, deleted: repoName })
  } catch (err) {
    console.error('Repo deletion error:', err)
    return c.json({ error: err.message }, 500)
  }
})

export default repos
