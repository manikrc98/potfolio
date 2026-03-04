import { ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Hero() {
  const { user, login } = useAuth()
  const navigate = useNavigate()

  function handleStartBuilding() {
    if (user) {
      navigate('/dashboard')
    } else {
      login()
    }
  }

  return (
    <section className="px-6 pt-24 pb-20 max-w-5xl mx-auto text-center">
      <div className="animate-fade-in-up">
        <span className="inline-block text-sm font-medium text-blue-500 bg-blue-50 px-4 py-1.5 rounded-full mb-6">
          Build beautiful portfolios in minutes
        </span>
      </div>

      <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-zinc-900 leading-[1.1] animate-fade-in-up-delay-1">
        Your work deserves
        <br />
        <span className="text-blue-500">a better showcase</span>
      </h1>

      <p className="mt-6 text-lg md:text-xl text-zinc-500 max-w-2xl mx-auto leading-relaxed animate-fade-in-up-delay-2">
        Drag, drop, and share a stunning bento-grid portfolio.
        No code required. Just your creativity.
      </p>

      <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up-delay-3">
        <button
          onClick={handleStartBuilding}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-medium px-8 py-3.5 rounded-xl text-lg shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:shadow-blue-500/30"
        >
          Start Building
          <ArrowRight size={20} />
        </button>
        <a
          href="#showcase"
          className="text-zinc-500 hover:text-zinc-800 font-medium px-6 py-3.5 text-lg transition-colors"
        >
          See examples
        </a>
      </div>

      {/* Hero visual — placeholder mockup */}
      <div className="mt-20 max-w-4xl mx-auto animate-fade-in-up-delay-3">
        <div className="rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden bg-zinc-50 aspect-[16/10] flex items-center justify-center">
          {/* Bento grid mockup */}
          <div className="w-full h-full p-6 grid grid-cols-4 grid-rows-3 gap-3">
            <div className="col-span-2 row-span-2 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200" />
            <div className="rounded-xl bg-gradient-to-br from-pink-100 to-pink-200" />
            <div className="rounded-xl bg-gradient-to-br from-amber-100 to-amber-200" />
            <div className="rounded-xl bg-gradient-to-br from-green-100 to-green-200" />
            <div className="rounded-xl bg-gradient-to-br from-purple-100 to-purple-200" />
            <div className="col-span-2 rounded-xl bg-gradient-to-br from-cyan-100 to-cyan-200" />
            <div className="col-span-2 rounded-xl bg-gradient-to-br from-rose-100 to-rose-200" />
          </div>
        </div>
      </div>
    </section>
  )
}
