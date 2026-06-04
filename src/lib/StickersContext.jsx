// StickersContext.jsx
// Fetches the full sticker list once the user is logged in and shares
// it across the app. Any component can call useStickers() to get the list.

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'

const StickersContext = createContext({})

export function StickersProvider({ children }) {
  const { user } = useAuth()
  const [stickers, setStickers] = useState([])
  const [loadingStickers, setLoadingStickers] = useState(true)

  useEffect(() => {
    // Don't fetch until there is a logged-in user
    if (!user) {
      setStickers([])
      setLoadingStickers(false)
      return
    }

    async function fetchStickers() {

      setLoadingStickers(true)

      const { data, error } = await supabase
        .from('stickers')
        .select('id, code, category, album_id, albums(name)')

      if (error) {
        console.error('Error fetching stickers:', error.message)
      } else {
        const sorted = data.sort((a, b) => {
          if (a.category !== b.category) return a.category.localeCompare(b.category)
          const numA = parseInt(a.code.replace(/[^0-9]/g, ''), 10)
          const numB = parseInt(b.code.replace(/[^0-9]/g, ''), 10)
          return numA - numB
        })
        setStickers(sorted)
      }
      setLoadingStickers(false)
    }

    fetchStickers()
  }, [user]) // re-run whenever the logged-in user changes

  return (
    <StickersContext.Provider value={{ stickers, loadingStickers }}>
      {children}
    </StickersContext.Provider>
  )
}

export function useStickers() {
  return useContext(StickersContext)
}