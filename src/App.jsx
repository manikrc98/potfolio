import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Features from './components/Features'
import HowItWorks from './components/HowItWorks'
import Showcase from './components/Showcase'
import Footer from './components/Footer'
import LoginModal from './components/LoginModal'
import AuthCallback from './pages/AuthCallback'
import Dashboard from './pages/Dashboard'
import Editor from './pages/Editor'

function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-800 antialiased">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Showcase />
      <Footer />
      <LoginModal />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/editor/:repoName" element={<Editor />} />
    </Routes>
  )
}
