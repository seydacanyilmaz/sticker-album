// Nav.jsx
// Navigation bar shown on every protected page.
// Uses Link components so items support middle-click and right-click to open in new tab.

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useProfile } from '../lib/ProfileContext'

// Reads the current theme from the <html> class set by the pre-paint script in index.html.
function isDarkMode() {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
}

const NAV_LINKS = [
  { label: 'Dashboard', path: '/' },
  { label: 'Record new stickers', path: '/record-new' },
  { label: 'Record a swap', path: '/record-trade' },
  { label: 'Record donated stickers', path: '/record-donated' },
  { label: 'My Stickers', path: '/my-stickers' },
  { label: 'Price per new sticker', path: '/ppns' },
  { label: 'How it works', path: '/help' },
]

export default function Nav() {
  const { profile } = useProfile()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [dark, setDark] = useState(isDarkMode)

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  function toggleTheme() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {
      // localStorage may be unavailable (e.g. private mode); the toggle still works for this session.
    }
  }

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
      {/* Top bar */}
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="font-semibold text-gray-800 dark:text-gray-100 tracking-tight hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          Sticker Album Tracker
        </Link>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-xl"
          aria-label="Toggle menu"
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Dropdown menu */}
      {menuOpen && (
        <div className="border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-md">
          <div className="max-w-3xl mx-auto px-4 py-3 flex flex-col gap-1">
            <p className="text-xs text-gray-400 dark:text-gray-500 px-3 pb-1">{profile?.username}</p>
            {NAV_LINKS.map(({ label, path }) => (
              <Link
                key={path}
                to={path}
                onClick={() => setMenuOpen(false)}
                className="px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
              >
                {label}
              </Link>
            ))}
            <div className="border-t border-gray-100 dark:border-gray-800 mt-2 pt-2 flex flex-col gap-1">
              <button
                onClick={toggleTheme}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
                aria-pressed={dark}
              >
                <span>Dark mode</span>
                <span className="text-base">{dark ? '🌙' : '☀️'}</span>
              </button>
              <button
                onClick={handleSignOut}
                className="w-full text-left px-3 py-2.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors text-sm font-medium"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
