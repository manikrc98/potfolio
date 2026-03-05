import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { getSession } from '../lib/sessions.js'
import { createRepo, pushFiles, enableGitHubPages, setCustomDomain, deleteRepo } from '../lib/github.js'
import { readTemplateFiles, customizeFiles } from '../lib/templateReader.js'
import { getPortfolio, setPortfolio, deletePortfolio, getPortfolioByRepo } from '../lib/portfolioStore.js'

const repos = new Hono()

// Auth middleware — accepts cookie or Authorization: Bearer header
function requireAuth(c) {
  const sessionId =
    getCookie(c, 'bb_session') ||
    c.req.header('Authorization')?.replace('Bearer ', '')
  if (!sessionId) return null
  return getSession(sessionId)
}

// ── Check: find existing Potfolio repos for the authenticated user ─────
repos.get('/check', async (c) => {
  const session = requireAuth(c)
  if (!session) return c.json({ error: 'Not authenticated' }, 401)

  try {
    const token = session.token
    const owner = session.user.login

    // Search for repos with the Potfolio description
    const res = await fetch(
      `https://api.github.com/user/repos?per_page=100&sort=updated`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    )

    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)

    const repos_list = await res.json()
    const bentoRepo = repos_list.find(
      (r) => r.description === 'My Bento Portfolio — built with Potfolio' && r.owner.login === owner
    )

    if (bentoRepo) {
      return c.json({ hasRepo: true, repoName: bentoRepo.name })
    }

    return c.json({ hasRepo: false })
  } catch (err) {
    console.error('Repo check error:', err)
    return c.json({ error: err.message }, 500)
  }
})

repos.post('/create', async (c) => {
  const session = requireAuth(c)
  if (!session) return c.json({ error: 'Not authenticated' }, 401)

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

    // 1. Create the repo
    const repo = await createRepo(token, sanitized)

    // 2. Read and customize template files
    const rawFiles = await readTemplateFiles()
    const files = customizeFiles(rawFiles, { repoName: sanitized, portfolioName: sanitizedPortfolio })

    // 2b. Add CNAME file for custom subdomain (portfolioName.potfolio.me)
    const customDomain = `${sanitizedPortfolio}.potfolio.me`
    files.push({
      path: 'CNAME',
      content: Buffer.from(customDomain, 'utf-8'),
      isBinary: false,
    })

    // 3. Push all files in a single commit
    await pushFiles(token, owner, sanitized, files)

    // 4. Enable GitHub Pages
    await enableGitHubPages(token, owner, sanitized)

    // 5. Set custom subdomain on GitHub Pages
    await setCustomDomain(token, owner, sanitized, customDomain)

    const pagesUrl = `https://${customDomain}`

    // 6. Store portfolio name → custom domain mapping
    await setPortfolio(sanitizedPortfolio, { owner, repoName: sanitized, pagesUrl })

    const projectUrl = pagesUrl

    return c.json({
      repoUrl: repo.html_url,
      projectUrl,
      pagesUrl,
      repoName: sanitized,
      portfolioName: sanitizedPortfolio,
    })
  } catch (err) {
    console.error('Repo creation error:', err)
    return c.json({ error: err.message }, 500)
  }
})

// ── Publish: push data + media to an existing repo ────────────────────────────
repos.post('/:repoName/publish', async (c) => {
  const session = requireAuth(c)
  if (!session) return c.json({ error: 'Not authenticated' }, 401)

  try {
    const repoName = c.req.param('repoName')
    const { data, media, versionSummary } = await c.req.json()

    if (!data) return c.json({ error: 'Missing data payload' }, 400)
    if (!versionSummary?.trim()) return c.json({ error: 'Version summary is required' }, 400)

    const owner = session.user.login
    const token = session.token

    // Build the file list for the commit
    const files = []

    // 1. data.json — the portfolio state
    const dataJson = JSON.stringify(data, null, 2)
    files.push({
      path: 'public/data.json',
      content: Buffer.from(dataJson, 'utf-8'),
      isBinary: false,
    })

    // 2. Media files — base64-encoded binary files
    if (media && typeof media === 'object') {
      for (const [filename, base64Data] of Object.entries(media)) {
        // Sanitize filename to prevent path traversal
        const safeName = filename.replace(/\.\./g, '').replace(/^\//, '')
        files.push({
          path: `public/${safeName}`,
          content: Buffer.from(base64Data, 'base64'),
          isBinary: true,
        })
      }
    }

    // 3. Push all files in a single commit (skip init wait — repo already exists)
    const commit = await pushFiles(token, owner, repoName, files, {
      commitMessage: versionSummary.trim(),
      waitForInit: false,
    })

    return c.json({
      success: true,
      commitSha: commit.sha,
      commitUrl: commit.html_url,
    })
  } catch (err) {
    console.error('Publish error:', err)
    return c.json({ error: err.message }, 500)
  }
})

// ── Load: fetch data.json from an existing repo ───────────────────────────────
repos.get('/:repoName/data', async (c) => {
  const session = requireAuth(c)
  if (!session) return c.json({ error: 'Not authenticated' }, 401)

  try {
    const repoName = c.req.param('repoName')
    const owner = session.user.login
    const token = session.token

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/public/data.json`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.raw+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    )

    if (!res.ok) {
      if (res.status === 404) {
        // No data.json yet — return empty so the editor uses defaults
        return c.json({})
      }
      throw new Error(`GitHub API error: ${res.status}`)
    }

    const data = await res.json()
    return c.json(data)
  } catch (err) {
    console.error('Load data error:', err)
    return c.json({ error: err.message }, 500)
  }
})

// ── Info: return portfolio metadata for a repo ────────────────────────────────
repos.get('/:repoName/info', async (c) => {
  const session = requireAuth(c)
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

// ── Resolve: redirect potfolio.me/<name> to the actual GitHub Pages URL ───────
repos.get('/resolve/:portfolioName', async (c) => {
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

// ── Delete: remove repo from GitHub and Supabase ──────────────────────────────
repos.delete('/:repoName', async (c) => {
  const session = requireAuth(c)
  if (!session) return c.json({ error: 'Not authenticated' }, 401)

  try {
    const repoName = c.req.param('repoName')
    const owner = session.user.login
    const token = session.token

    // 1. Find the portfolio entry for this repo
    const entry = await getPortfolioByRepo(repoName, owner)

    // 2. Delete the GitHub repo
    await deleteRepo(token, owner, repoName)

    // 3. Delete the portfolio mapping from Supabase
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
