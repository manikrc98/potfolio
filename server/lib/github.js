const GITHUB_API = 'https://api.github.com'

/** Safely parse JSON from a response, returning fallback on failure */
async function safeJson(res) {
  try { return await res.json() } catch { return { message: `${res.status} ${res.statusText}` } }
}

// Cache blob SHAs per repo to avoid re-uploading unchanged dist files
// Map<"owner/repo", Map<filePath, blobSha>>
const blobShaCache = new Map()

export function clearBlobCache(owner, repo) {
  blobShaCache.delete(`${owner}/${repo}`)
}

export function clearAllBlobCaches() {
  blobShaCache.clear()
}

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Potfolio-App',
  }
}

/**
 * Create a blob with retry logic for transient GitHub API failures (5xx).
 */
async function createBlobWithRetry(hdrs, owner, repo, content, encoding, filePath, { maxRetries = 3, retryOn409 = false } = {}) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const blobRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      headers: hdrs,
      body: JSON.stringify({ content, encoding }),
    })
    if (blobRes.ok) {
      return blobRes.json()
    }
    const retryable = blobRes.status >= 500 || (retryOn409 && blobRes.status === 409)
    if (retryable && attempt < maxRetries - 1) {
      console.log(`[createBlob] ${filePath} attempt ${attempt + 1} got ${blobRes.status}, retrying in ${(attempt + 1) * 2}s…`)
      await new Promise((r) => setTimeout(r, (attempt + 1) * 2000))
      continue
    }
    const err = await safeJson(blobRes)
    throw new Error(`Failed to create blob for ${filePath}: ${err.message}`)
  }
}

export async function exchangeCodeForToken(code, { clientId, clientSecret } = {}) {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'Potfolio-App',
    },
    body: JSON.stringify({
      client_id: clientId || process.env.GITHUB_CLIENT_ID,
      client_secret: clientSecret || process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error_description || data.error)
  return data.access_token
}

export async function getUser(token) {
  const res = await fetch(`${GITHUB_API}/user`, { headers: headers(token) })
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
  return res.json()
}

export async function createRepo(token, name) {
  const res = await fetch(`${GITHUB_API}/user/repos`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      name,
      description: 'My Bento Portfolio — built with Potfolio',
      auto_init: true,
      private: false,
    }),
  })
  if (!res.ok) {
    const err = await safeJson(res)
    throw new Error(err.message || `Failed to create repo: ${res.status}`)
  }
  return res.json()
}

/**
 * Wait for a newly created repo (auto_init: true) to have its default branch ready.
 * GitHub provisions the initial commit asynchronously, so we poll for HEAD.
 */
export async function waitForRepoReady(token, owner, repo, { maxAttempts = 5, interval = 2000 } = {}) {
  const hdrs = headers(token)
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/ref/heads/main`, { headers: hdrs })
    if (res.ok) return
    if (attempt < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, interval))
    }
  }
  throw new Error('Repository not ready — timed out waiting for initial commit')
}

/**
 * Push files to a repo using the Git Data API (single commit).
 * @param {string} token
 * @param {string} owner
 * @param {string} repo
 * @param {{ path: string, content: Buffer, isBinary: boolean }[]} files
 * @param {{ commitMessage?: string, waitForInit?: boolean }} [options]
 */
export async function pushFiles(token, owner, repo, files, options = {}) {
  const { commitMessage = 'Initial commit — Potfolio portfolio template', emptyRepo = false } = options
  const hdrs = headers(token)

  let parentSha = null
  let baseTreeSha = null

  if (emptyRepo) {
    // Repo was created with auto_init: false — no commits exist yet.
    // We'll create the first commit with no parent.
  } else {
    // Repo already has commits — get HEAD ref
    const refGetRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/ref/heads/main`, {
      headers: hdrs,
    })
    if (refGetRes.ok) {
      const headRef = await refGetRes.json()
      parentSha = headRef.object.sha

      const parentCommitRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/commits/${parentSha}`, {
        headers: hdrs,
      })
      if (parentCommitRes.ok) {
        const parentCommit = await parentCommitRes.json()
        baseTreeSha = parentCommit.tree.sha
      }
    }

    if (!parentSha) {
      throw new Error('Repository not ready — could not fetch HEAD ref')
    }
  }

  // For empty repos, wait a moment for GitHub to finish provisioning
  if (emptyRepo) {
    await new Promise((r) => setTimeout(r, 2000))
  }

  // 1. Build tree items — use inline content for text files (saves one API call
  //    per file vs creating blobs separately). Only create blobs for binary files.
  const treeItems = []
  const blobOpts = emptyRepo ? { maxRetries: 5, retryOn409: true } : {}
  for (const file of files) {
    if (file.isBinary) {
      const blob = await createBlobWithRetry(hdrs, owner, repo, file.content.toString('base64'), 'base64', file.path, blobOpts)
      treeItems.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha })
    } else {
      treeItems.push({ path: file.path, mode: '100644', type: 'blob', content: file.content.toString('utf-8') })
    }
  }

  // 2. Create tree (retry on 409 for empty repos — GitHub needs time to provision)
  const treeBody = baseTreeSha
    ? { base_tree: baseTreeSha, tree: treeItems }
    : { tree: treeItems }
  let treeRes
  const maxTreeRetries = emptyRepo ? 8 : 1
  for (let attempt = 0; attempt < maxTreeRetries; attempt++) {
    treeRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/trees`, {
      method: 'POST',
      headers: hdrs,
      body: JSON.stringify(treeBody),
    })
    if (treeRes.ok) break
    if (treeRes.status === 409 && attempt < maxTreeRetries - 1) {
      const delay = Math.min((attempt + 1) * 2000, 10000)
      console.log(`[pushFiles] Tree creation got 409 (empty repo not ready), retrying in ${delay / 1000}s… (attempt ${attempt + 1}/${maxTreeRetries})`)
      await new Promise((r) => setTimeout(r, delay))
      continue
    }
    const err = await safeJson(treeRes)
    console.error('Tree creation failed:', treeRes.status, JSON.stringify(err))
    throw new Error(`Failed to create tree (${treeRes.status}): ${err.message}`)
  }
  const tree = await treeRes.json()

  // 3. Create commit
  const commitRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    headers: hdrs,
    body: JSON.stringify({
      message: commitMessage,
      tree: tree.sha,
      parents: parentSha ? [parentSha] : [],
    }),
  })
  if (!commitRes.ok) {
    const err = await safeJson(commitRes)
    throw new Error(`Failed to create commit: ${err.message}`)
  }
  const commit = await commitRes.json()

  // 4. Create or update main ref
  if (parentSha) {
    const refRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/refs/heads/main`, {
      method: 'PATCH',
      headers: hdrs,
      body: JSON.stringify({ sha: commit.sha, force: true }),
    })
    if (!refRes.ok) {
      const err = await safeJson(refRes)
      throw new Error(`Failed to update ref: ${err.message}`)
    }
  } else {
    const refRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      headers: hdrs,
      body: JSON.stringify({ ref: 'refs/heads/main', sha: commit.sha }),
    })
    if (!refRes.ok) {
      const err = await safeJson(refRes)
      throw new Error(`Failed to create ref: ${err.message}`)
    }
  }

  return commit
}

export async function deleteRepo(token, owner, repo) {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
    method: 'DELETE',
    headers: headers(token),
  })

  if (!res.ok && res.status !== 404) {
    const err = await safeJson(res)
    throw new Error(`Failed to delete repo: ${err.message}`)
  }
}

export async function enableGitHubPages(token, owner, repo) {
  const hdrs = headers(token)
  const maxRetries = 5

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/pages`, {
      method: 'POST',
      headers: hdrs,
      body: JSON.stringify({
        source: { branch: 'gh-pages', path: '/' },
      }),
    })

    // 409 means pages is already enabled — update to branch-based if needed
    if (res.status === 409) {
      await fetch(`${GITHUB_API}/repos/${owner}/${repo}/pages`, {
        method: 'PUT',
        headers: hdrs,
        body: JSON.stringify({
          source: { branch: 'gh-pages', path: '/' },
        }),
      })
      break
    } else if (res.ok) {
      break
    } else if (res.status >= 500 && attempt < maxRetries - 1) {
      // GitHub returns 500 when gh-pages branch isn't fully indexed yet — retry
      console.log(`[enableGitHubPages] attempt ${attempt + 1} got ${res.status}, retrying in ${(attempt + 1) * 2}s…`)
      await new Promise((r) => setTimeout(r, (attempt + 1) * 2000))
    } else {
      const err = await safeJson(res)
      throw new Error(`Failed to enable GitHub Pages: ${err.message}`)
    }
  }

  return { pagesUrl: `https://${owner}.github.io/${repo}/` }
}

export async function getLatestPagesBuild(token, owner, repo) {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/pages/builds/latest`,
    { headers: headers(token) }
  )

  if (!res.ok) {
    if (res.status === 404) return null
    throw new Error(`Failed to fetch pages build: ${res.status}`)
  }

  const build = await res.json()
  return {
    status: build.status,       // 'queued' | 'building' | 'built' | 'errored'
    createdAt: build.created_at,
    updatedAt: build.updated_at,
  }
}

/**
 * Push files directly to the gh-pages branch (no GitHub Actions needed).
 * Creates blobs in parallel for speed. Uses base_tree for incremental updates.
 */
export async function pushToGhPages(token, owner, repo, files, commitMessage) {
  const hdrs = headers(token)

  // Check if gh-pages branch exists
  let parentSha = null
  let baseTreeSha = null
  const refRes = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/git/ref/heads/gh-pages`,
    { headers: hdrs }
  )
  if (refRes.ok) {
    const ref = await refRes.json()
    parentSha = ref.object.sha
    const commitRes = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/git/commits/${parentSha}`,
      { headers: hdrs }
    )
    if (commitRes.ok) {
      const commit = await commitRes.json()
      baseTreeSha = commit.tree.sha
    }
  }

  // Create blobs — skip cached dist files, only upload changed/new files
  const BATCH_SIZE = 25
  const repoKey = `${owner}/${repo}`
  const repoCache = blobShaCache.get(repoKey) || new Map()
  const treeItems = []
  let cachedCount = 0

  // Separate cached hits from files that need blob creation
  const toCreate = []
  for (const file of files) {
    if (file.cacheable) {
      const cachedSha = repoCache.get(file.path)
      if (cachedSha) {
        treeItems.push({ path: file.path, mode: '100644', type: 'blob', sha: cachedSha })
        cachedCount++
        continue
      }
    }
    toCreate.push(file)
  }

  // Build tree items for remaining files — use inline content for text files
  // to reduce subrequests, only create blobs for binary files
  const binaryFiles = toCreate.filter(f => f.isBinary)
  const textFiles = toCreate.filter(f => !f.isBinary)

  // Text files: inline content in tree (no blob API call needed)
  for (const file of textFiles) {
    treeItems.push({ path: file.path, mode: '100644', type: 'blob', content: file.content.toString('utf-8') })
  }

  // Binary files: create blobs in parallel batches
  for (let i = 0; i < binaryFiles.length; i += BATCH_SIZE) {
    const batch = binaryFiles.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map(async (file) => {
        const blob = await createBlobWithRetry(hdrs, owner, repo, file.content.toString('base64'), 'base64', file.path)
        if (file.cacheable) repoCache.set(file.path, blob.sha)
        return { path: file.path, mode: '100644', type: 'blob', sha: blob.sha }
      })
    )
    treeItems.push(...results)
  }

  // Persist cache if we added new entries
  if (repoCache.size > 0) {
    blobShaCache.set(repoKey, repoCache)
  }
  console.log(`[pushToGhPages] ${cachedCount} cached blobs, ${toCreate.length} new blobs`)

  // Create tree (with base_tree for incremental updates)
  // If tree creation fails and we used cached SHAs, retry without cache
  const treeBody = baseTreeSha
    ? { base_tree: baseTreeSha, tree: treeItems }
    : { tree: treeItems }
  let treeRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    headers: hdrs,
    body: JSON.stringify(treeBody),
  })
  if (!treeRes.ok && cachedCount > 0) {
    console.log('[pushToGhPages] Tree creation failed with cached SHAs, retrying without cache…')
    clearBlobCache(owner, repo)
    return pushToGhPages(token, owner, repo, files, commitMessage)
  }
  if (!treeRes.ok) {
    const err = await safeJson(treeRes)
    throw new Error(`Failed to create tree: ${err.message}`)
  }
  const tree = await treeRes.json()

  // Create commit
  const commitBody = {
    message: commitMessage,
    tree: tree.sha,
    parents: parentSha ? [parentSha] : [],
  }
  const commitRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    headers: hdrs,
    body: JSON.stringify(commitBody),
  })
  if (!commitRes.ok) {
    const err = await safeJson(commitRes)
    throw new Error(`Failed to create commit: ${err.message}`)
  }
  const commit = await commitRes.json()

  // Create or update gh-pages ref
  if (parentSha) {
    const updateRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/refs/heads/gh-pages`, {
      method: 'PATCH',
      headers: hdrs,
      body: JSON.stringify({ sha: commit.sha, force: true }),
    })
    if (!updateRes.ok) {
      const err = await safeJson(updateRes)
      throw new Error(`Failed to update gh-pages ref: ${err.message}`)
    }
  } else {
    const createRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      headers: hdrs,
      body: JSON.stringify({ ref: 'refs/heads/gh-pages', sha: commit.sha }),
    })
    if (!createRes.ok) {
      const err = await safeJson(createRes)
      throw new Error(`Failed to create gh-pages ref: ${err.message}`)
    }
  }

  return commit
}

export async function listGhPagesCommits(token, owner, repo, perPage = 20) {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/commits?sha=gh-pages&per_page=${perPage}`,
    { headers: headers(token) }
  )
  if (!res.ok) {
    if (res.status === 404) return []
    throw new Error(`Failed to list commits: ${res.status}`)
  }
  return res.json()
}

export async function getFileAtCommit(token, owner, repo, path, sha) {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}?ref=${sha}`,
    { headers: { ...headers(token), Accept: 'application/vnd.github.raw+json' } }
  )
  if (!res.ok) {
    throw new Error(`Failed to fetch ${path} at ${sha}: ${res.status}`)
  }
  return res.json()
}

export async function setCustomDomain(token, owner, repo, domain) {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/pages`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify({ cname: domain }),
  })

  if (!res.ok) {
    const err = await safeJson(res)
    console.error('Custom domain error:', err)
    // Non-fatal: portfolio still works via GitHub Pages URL
  }
}
