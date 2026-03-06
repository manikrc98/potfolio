const GITHUB_API = 'https://api.github.com'

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
    const err = await res.json()
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
      const err = await blobRes.json()
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
    const err = await treeRes.json()
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
    const err = await commitRes.json()
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
    const err = await refRes.json()
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
    const err = await res.json()
    throw new Error(`Failed to delete repo: ${err.message}`)
  }
}

export async function enableGitHubPages(token, owner, repo) {
  const hdrs = headers(token)

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
  } else if (!res.ok) {
    const err = await res.json()
    throw new Error(`Failed to enable GitHub Pages: ${err.message}`)
  }

  return { pagesUrl: `https://${owner}.github.io/${repo}/` }
}

export async function triggerWorkflow(token, owner, repo, { retries = 3, delayMs = 3000 } = {}) {
  // GitHub needs time to index the workflow file after a push via the Git Data API
  for (let attempt = 0; attempt < retries; attempt++) {
    await new Promise((r) => setTimeout(r, delayMs))

    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/actions/workflows/deploy.yml/dispatches`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ ref: 'main' }),
    })

    // 204 = success, 204 is the expected response
    if (res.status === 204 || res.ok) return

    const err = await res.json().catch(() => ({}))
    console.error(`Workflow dispatch attempt ${attempt + 1}/${retries} failed:`, res.status, err)

    // Only retry on 404 (workflow not indexed yet)
    if (res.status !== 404) break
  }
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

  // Create blobs in parallel
  const BATCH_SIZE = 10
  const treeItems = []
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE)
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
          const err = await blobRes.json()
          throw new Error(`Failed to create blob for ${file.path}: ${err.message}`)
        }
        const blob = await blobRes.json()
        return { path: file.path, mode: '100644', type: 'blob', sha: blob.sha }
      })
    )
    treeItems.push(...results)
  }

  // Create tree (with base_tree for incremental updates)
  const treeBody = baseTreeSha
    ? { base_tree: baseTreeSha, tree: treeItems }
    : { tree: treeItems }
  const treeRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    headers: hdrs,
    body: JSON.stringify(treeBody),
  })
  if (!treeRes.ok) {
    const err = await treeRes.json()
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
    const err = await commitRes.json()
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
      const err = await updateRes.json()
      throw new Error(`Failed to update gh-pages ref: ${err.message}`)
    }
  } else {
    const createRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      headers: hdrs,
      body: JSON.stringify({ ref: 'refs/heads/gh-pages', sha: commit.sha }),
    })
    if (!createRes.ok) {
      const err = await createRes.json()
      throw new Error(`Failed to create gh-pages ref: ${err.message}`)
    }
  }

  return commit
}

export async function setCustomDomain(token, owner, repo, domain) {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/pages`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify({ cname: domain }),
  })

  if (!res.ok) {
    const err = await res.json()
    console.error('Custom domain error:', err)
    // Non-fatal: portfolio still works via GitHub Pages URL
  }
}
