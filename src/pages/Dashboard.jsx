import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { API_BASE_URL } from '../config'
import { Navigate, Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import DeployProgress from '../components/DeployProgress'
import useDeployStatus from '../editor/hooks/useDeployStatus'

export default function Dashboard() {
  const { user, loading, logout, authFetch } = useAuth()
  const [portfolioName, setPortfolioName] = useState('')
  const [repoName, setRepoName] = useState('')
  const [repoManuallyEdited, setRepoManuallyEdited] = useState(false)
  const [status, setStatus] = useState('idle') // idle | creating | done | error
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  const { isDeploying, startDeploying } = useDeployStatus()

  function copyUrl() {
    navigator.clipboard.writeText(`${portfolioName.trim()}.potfolio.me`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handlePortfolioNameChange(value) {
    const sanitized = value.replace(/[^a-zA-Z0-9._-]/g, '-')
    setPortfolioName(sanitized)
    if (!repoManuallyEdited) {
      setRepoName(sanitized)
    }
  }

  function handleRepoNameChange(value) {
    const sanitized = value.replace(/[^a-zA-Z0-9._-]/g, '-')
    setRepoName(sanitized)
    setRepoManuallyEdited(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/" replace />

  async function handleCreate() {
    if (!repoName.trim()) return
    setStatus('creating')
    setError(null)

    try {
      const res = await authFetch(`${API_BASE_URL}/api/repos/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoName: repoName.trim(), portfolioName: portfolioName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create repository')
      setResult(data)
      setStatus('done')
      startDeploying()
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
        <a href="/" className="text-lg font-semibold text-zinc-800 tracking-tight">
          Potfolio
        </a>
        <div className="flex items-center gap-3">
          <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
          <span className="text-sm text-zinc-600">{user.login}</span>
          <button
            onClick={logout}
            className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-xl mx-auto px-6 py-20">
        {status === 'idle' && (
          <div className="animate-fade-in-up">
            <h1 className="text-3xl font-bold text-zinc-900 mb-2">
              Create Your Bento Portfolio
            </h1>
            <p className="text-zinc-500 mb-8">
              We'll create a new GitHub repository with a ready-to-use bento grid builder and deploy it to GitHub Pages.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Portfolio name
              </label>
              <input
                type="text"
                value={portfolioName}
                onChange={(e) => handlePortfolioNameChange(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="manikrc98"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Repository name
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-400">{user.login}/</span>
                <input
                  type="text"
                  value={repoName}
                  onChange={(e) => handleRepoNameChange(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="my-bento-portfolio"
                />
              </div>
            </div>

            {portfolioName.trim() && (
              <div className="mb-6 p-4 rounded-xl bg-zinc-50 border border-zinc-100">
                <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">Project URL</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono text-blue-600">{portfolioName.trim()}.potfolio.me</p>
                  <button
                    onClick={copyUrl}
                    className="text-zinc-400 hover:text-zinc-600 transition-colors"
                    title="Copy URL"
                  >
                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={!repoName.trim() || !portfolioName.trim()}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-zinc-200 disabled:text-zinc-400 text-white font-medium py-3 rounded-xl transition-colors text-sm"
            >
              Create & Deploy
            </button>
          </div>
        )}

        {status === 'creating' && (
          <DeployProgress />
        )}

        {status === 'done' && result && (
          <div className="text-center animate-fade-in-up">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 mb-2">You're all set!</h2>
            <p className="text-zinc-500 mb-8">
              Your bento portfolio has been created and is being deployed. It may take a minute for GitHub Pages to go live.
            </p>

            <div className="space-y-3">
              <Link
                to={`/editor/${result.repoName}`}
                className="block w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 rounded-xl transition-colors text-sm text-center"
              >
                Open Editor
              </Link>
              <a
                href={result.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium py-3 rounded-xl transition-colors text-sm text-center"
              >
                View Repository on GitHub
              </a>
              {isDeploying ? (
                <button
                  disabled
                  className="flex items-center justify-center gap-2 w-full bg-zinc-100 text-zinc-400 font-medium py-3 rounded-xl text-sm cursor-wait"
                >
                  <Loader2 size={16} className="animate-spin" />
                  Deploying… Site will be live shortly
                </button>
              ) : (
                <a
                  href={result.projectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium py-3 rounded-xl transition-colors text-sm text-center"
                >
                  Visit Your Live Site
                </a>
              )}
            </div>

            <p className="mt-6 text-xs text-zinc-400">
              Tip: Use the Editor to build your portfolio, then hit Publish to push changes live.
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center animate-fade-in-up">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
              <span className="text-red-500 text-2xl">!</span>
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 mb-2">Something went wrong</h2>
            <p className="text-zinc-500 mb-6">{error}</p>
            <button
              onClick={() => setStatus('idle')}
              className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-8 py-3 rounded-xl transition-colors text-sm"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
