// ProfileContext.jsx
// Fetches and shares the current user's profile (username, id, etc.)
// across the app. Any component can call useProfile() to get this data.

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'

const ProfileContext = createContext({})

export function ProfileProvider({ children }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(true)

  useEffect(() => {
    // `active` guards against a stale fetch resolving after the user changed
    // or the provider unmounted. All state updates happen inside this async
    // function (never synchronously in the effect body).
    let active = true

    async function loadProfile() {
      // When there's no logged-in user, clear the profile
      if (!user) {
        if (active) {
          setProfile(null)
          setLoadingProfile(false)
        }
        return
      }

      // Keep loadingProfile true until this user's profile actually arrives, so
      // consumers (e.g. Dashboard) don't render a half-loaded state showing
      // "Welcome," with no username during the fetch.
      if (active) setLoadingProfile(true)

      // Fetch the profile row that matches the logged-in user's ID
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single() // we expect exactly one row

      if (!active) return

      if (error) {
        console.error('Error fetching profile:', error.message)
      } else {
        setProfile(data)
      }
      setLoadingProfile(false)
    }

    loadProfile()
    return () => { active = false }
  }, [user]) // re-run whenever the logged-in user changes

  return (
    <ProfileContext.Provider value={{ profile, loadingProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProfile() {
  return useContext(ProfileContext)
}