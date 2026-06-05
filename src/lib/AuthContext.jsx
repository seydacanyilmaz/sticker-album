// AuthContext.jsx
// Creates a React context that holds the current user session.
// Any component in the app can call useAuth() to find out who is logged in.

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

// Create the context object — this is what we'll share across the app
const AuthContext = createContext({})

// AuthProvider wraps the whole app and listens for auth state changes.
// When a user logs in or out, Supabase fires an event and we update the state.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)      // the logged-in user, or null
  const [loading, setLoading] = useState(true) // true while we check for an existing session

  useEffect(() => {
    // Check if there's already a session when the app loads
    // (e.g. the user logged in yesterday and their session is still valid)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for future login/logout events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      }
    )

    // Clean up the listener when the component unmounts
    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

// useAuth is a custom hook — any component can call useAuth() to get the
// current user and loading state instead of importing AuthContext directly.
// (Colocated with the provider by design; Fast Refresh rule disabled for it.)
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}