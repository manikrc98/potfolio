import { useState, useEffect } from 'react'
import { API_BASE_URL } from '../config'

export default function Showcase() {
  const [portfolios, setPortfolios] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/repos/portfolios?limit=30`)
      .then((res) => res.json())
      .then((data) => setPortfolios(data.portfolios || []))
      .catch(() => setPortfolios([]))
      .finally(() => setLoading(false))
  }, [])

  if (!loading && portfolios.length === 0) return null

  return (
    <section id="showcase" className="px-6 py-24 max-w-5xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 tracking-tight">
          Made with Potfolio
        </h2>
        <p className="mt-4 text-zinc-500 text-lg">
          See what others have built
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
          {portfolios.map((p) => (
            <a
              key={p.portfolioName}
              href={p.pagesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group cursor-pointer"
            >
              <div className="rounded-2xl overflow-hidden border border-zinc-200 shadow-sm group-hover:shadow-md transition-shadow aspect-[4/3] bg-zinc-50">
                <img
                  src={`https://image.thum.io/get/width/600/${p.pagesUrl}`}
                  alt={`${p.portfolioName}'s portfolio`}
                  className="w-full h-full object-cover object-top"
                  loading="lazy"
                />
              </div>
              <p className="mt-3 text-sm text-zinc-500 text-center font-medium group-hover:text-zinc-700 transition-colors">
                {p.portfolioName}
                <span className="text-zinc-300 ml-1">by {p.owner}</span>
              </p>
            </a>
          ))}
        </div>
      )}
    </section>
  )
}
