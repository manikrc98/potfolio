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
  }
}

export async function exchangeCodeForToken(code) {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
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
 * Push files to a repo using the Git Data API (single commit).
 * @param {string} token
 * @param {string} owner
 * @param {string} repo
 * @param {{ path: string, content: Buffer, isBinary: boolean }[]} files
 * @param {{ commitMessage?: string, waitForInit?: boolean }} [options]
 */
export async function pushFiles(token, owner, repo, files, options = {}) {
  const { commitMessage = 'Initial commit — Potfolio portfolio template', waitForInit = true } = options
  const hdrs = headers(token)

  let parentSha = null

  if (waitForInit) {
    // 0. Wait for repository to be fully initialized (auto_init is async)
    for (let attempt = 0; attempt < 10; attempt++) {
      const checkRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/README.md`, {
        headers: hdrs,
      })
      if (checkRes.ok) {
        const refGetRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/ref/heads/main`, {
          headers: hdrs,
        })
        if (refGetRes.ok) {
          const headRef = await refGetRes.json()
          parentSha = headRef.object.sha
          break
        }
      }
      await new Promise((r) => setTimeout(r, 2000))
    }
  } else {
    // Repo already exists — just get the HEAD ref directly
    const refGetRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/ref/heads/main`, {
      headers: hdrs,
    })
    if (refGetRes.ok) {
      const headRef = await refGetRes.json()
      parentSha = headRef.object.sha
    }
  }

  if (!parentSha) {
    throw new Error('Repository not ready — could not verify initialization after retries')
  }

  // 0b. Get the tree SHA of the parent commit (needed for base_tree)
  const parentCommitRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/commits/${parentSha}`, {
    headers: hdrs,
  })
  if (!parentCommitRes.ok) {
    throw new Error('Failed to fetch parent commit details')
  }
  const parentCommit = await parentCommitRes.json()
  const baseTreeSha = parentCommit.tree.sha

  // 1. Create blobs for each file
  const treeItems = []
  for (const file of files) {
    const encoding = file.isBinary ? 'base64' : 'utf-8'
    const content = file.isBinary
      ? file.content.toString('base64')
      : file.content.toString('utf-8')

    const blobRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      headers: hdrs,
      body: JSON.stringify({ content, encoding }),
    })
    if (!blobRes.ok) {
      const err = await safeJson(blobRes)
      throw new Error(`Failed to create blob for ${file.path}: ${err.message}`)
    }
    const blob = await blobRes.json()

    treeItems.push({
      path: file.path,
      mode: '100644',
      type: 'blob',
      sha: blob.sha,
    })
  }

  // 2. Create tree
  const treeRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    headers: hdrs,
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
  })
  if (!treeRes.ok) {
    const err = await safeJson(treeRes)
    console.error('Tree creation failed:', treeRes.status, JSON.stringify(err))
    console.error('Tree request body:', JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }))
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
      parents: [parentSha],
    }),
  })
  if (!commitRes.ok) {
    const err = await safeJson(commitRes)
    throw new Error(`Failed to create commit: ${err.message}`)
  }
  const commit = await commitRes.json()

  // 4. Update main ref to point to our new commit
  const refRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/refs/heads/main`, {
    method: 'PATCH',
    headers: hdrs,
    body: JSON.stringify({
      sha: commit.sha,
      force: true,
    }),
  })
  if (!refRes.ok) {
    const err = await safeJson(refRes)
    throw new Error(`Failed to create ref: ${err.message}`)
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

  // Create blobs in parallel batches for remaining files
  for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
    const batch = toCreate.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map(async (file) => {
        const encoding = file.isBinary ? 'base64' : 'utf-8'
        const content = file.isBinary
          ? file.content.toString('base64')
          : file.content.toString('utf-8')

        const blobRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/blobs`, {
          method: 'POST',
          headers: hdrs,
          body: JSON.stringify({ content, encoding }),
        })
        if (!blobRes.ok) {
          const err = await safeJson(blobRes)
          throw new Error(`Failed to create blob for ${file.path}: ${err.message}`)
        }
        const blob = await blobRes.json()

        // Cache blob SHA for cacheable files (dist files)
        if (file.cacheable) {
          repoCache.set(file.path, blob.sha)
        }

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
