import { LayoutGrid } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Navbar() {
  const { user, loading, login, logout } = useAuth()
  const navigate = useNavigate()

  function handleGetStarted() {
    if (user) {
      navigate('/dashboard')
    } else {
      login()
    }
  }

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md border-b border-zinc-100">
      <a href="/" className="flex items-center gap-2.5">
        <LayoutGrid size={22} className="text-blue-500" />
        <span className="text-lg font-semibold text-zinc-800 tracking-tight">Potfolio</span>
      </a>

      <div className="flex items-center gap-6">
        <a href="#features" className="hidden sm:block text-sm text-zinc-500 hover:text-zinc-800 transition-colors">
          Features
        </a>
        <a href="#how-it-works" className="hidden sm:block text-sm text-zinc-500 hover:text-zinc-800 transition-colors">
          How it works
        </a>

        {!loading && (
          user ? (
            <>
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-800 transition-colors"
              >
                <img src={user.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                {user.login}
              </button>
              <button
                onClick={logout}
                className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <button
                onClick={login}
                className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors"
              >
                Sign in
              </button>
              <button
                onClick={handleGetStarted}
                className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors"
              >
                Get Started
              </button>
            </>
          )
        )}
      </div>
    </nav>
  )
}
