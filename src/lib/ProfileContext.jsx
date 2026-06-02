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
    // When there's no logged-in user, clear the profile
    if (!user) {
      setProfile(null)
      setLoadingProfile(false)
      return
    }

    // Fetch the profile row that matches the logged-in user's ID
    async function fetchProfile() {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single() // we expect exactly one row

      if (error) {
        console.error('Error fetching profile:', error.message)
      } else {
        setProfile(data)
      }
      setLoadingProfile(false)
    }

    fetchProfile()
  }, [user]) // re-run whenever the logged-in user changes

  return (
    <ProfileContext.Provider value={{ profile, loadingProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  return useContext(ProfileContext)
}