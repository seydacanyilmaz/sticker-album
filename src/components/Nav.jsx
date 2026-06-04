// Nav.jsx
// Navigation bar shown on every protected page.
// Uses Link components so items support middle-click and right-click to open in new tab.

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useProfile } from '../lib/ProfileContext'

const NAV_LINKS = [
  { label: 'Dashboard', path: '/' },
  { label: 'Record new stickers', path: '/record-new' },
  { label: 'Record a trade', path: '/record-trade' },
  { label: 'Record donated stickers', path: '/record-donated' },
  { label: 'My Stickers', path: '/my-stickers' },
]

export default function Nav() {
  const { profile } = useProfile()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
      {/* Top bar */}
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="font-semibold text-gray-800 tracking-tight hover:text-gray-600 transition-colors">
          Sticker Album Tracker
        </Link>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition-colors text-xl"
          aria-label="Toggle menu"
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Dropdown menu */}
      {menuOpen && (
        <div className="border-t border-gray-100 bg-white shadow-md">
          <div className="max-w-3xl mx-auto px-4 py-3 flex flex-col gap-1">
            <p className="text-xs text-gray-400 px-3 pb-1">{profile?.username}</p>
            {NAV_LINKS.map(({ label, path }) => (
              <Link
                key={path}
                to={path}
                onClick={() => setMenuOpen(false)}
                className="px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors text-sm font-medium"
              >
                {label}
              </Link>
            ))}
            <div className="border-t border-gray-100 mt-2 pt-2">
              <button
                onClick={handleSignOut}
                className="w-full text-left px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors text-sm font-medium"
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
