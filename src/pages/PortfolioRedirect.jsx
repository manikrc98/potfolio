import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { API_BASE_URL } from '../config'

export default function PortfolioRedirect() {
  const { portfolioName } = useParams()
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!portfolioName) return

    fetch(`${API_BASE_URL}/api/repos/resolve/${encodeURIComponent(portfolioName)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.pagesUrl) {
          window.location.href = data.pagesUrl
        } else {
          setError(true)
        }
      })
      .catch(() => setError(true))
  }, [portfolioName])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Portfolio not found</h1>
          <p className="text-zinc-500 mb-6">
            No portfolio exists at <span className="font-mono">potfolio.me/{portfolioName}</span>
          </p>
          <a
            href="/"
            className="text-blue-500 hover:text-blue-600 text-sm font-medium"
          >
            Go to homepage
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="w-8 h-8 mx-auto mb-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-zinc-500">Redirecting to portfolio...</p>
      </div>
    </div>
  )
}
