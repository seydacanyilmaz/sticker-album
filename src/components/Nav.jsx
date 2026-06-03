// Nav.jsx
// Navigation bar shown on every page.
// Contains a hamburger menu linking to all pages and a sign out button.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useProfile } from '../lib/ProfileContext'

export default function Nav() {
  const { profile } = useProfile()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  function handleNavigate(path) {
    navigate(path)
    setMenuOpen(false) // close menu after navigating
  }

  return (
    <nav>
      {/* Top bar */}
      <div>
        <span>Sticker Album Tracker</span>
        <button onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Dropdown menu — only shown when menuOpen is true */}
      {menuOpen && (
        <div>
          <p>{profile?.username}</p>
          <button onClick={() => handleNavigate('/')}>Dashboard</button>
          <button onClick={() => handleNavigate('/record-new')}>Record new stickers</button>
          <button onClick={() => handleNavigate('/record-trade')}>Record a trade</button>
          <button onClick={() => handleNavigate('/record-donated')}>Record donated stickers</button>
          <button onClick={() => handleNavigate('/my-stickers')}>List my stickers</button>
          <button onClick={handleSignOut}>Sign out</button>
        </div>
      )}
    </nav>
  )
}