// Login.jsx
// The login page. Users enter their email and password to sign in.
// On success, the AuthContext will automatically update and the app
// will redirect them to the dashboard.

import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  // Track what the user is typing
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Track the state of the form
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleLogin() {
    setLoading(true)
    setError(null)

    // Call Supabase to sign in with email and password
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
    }

    // If login succeeds, we don't need to do anything here —
    // AuthContext is listening for auth changes and will update automatically,
    // which will trigger App.jsx to redirect to the dashboard

    setLoading(false)
  }

  return (
    <div>
      <h1>Sticker Album Tracker</h1>
      <h2>Sign in</h2>

      {/* Show error message if login fails */}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div>
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          placeholder="Your password"
        />
      </div>

      <button onClick={handleLogin} disabled={loading}>
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
    </div>
  )
}