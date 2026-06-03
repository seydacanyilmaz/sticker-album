// StickersContext.jsx
// Fetches the full sticker list for the current album once and shares
// it across the app. Any component can call useStickers() to get the list.

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const StickersContext = createContext({})

export function StickersProvider({ children }) {
  const [stickers, setStickers] = useState([])   // full list of sticker objects
  const [loadingStickers, setLoadingStickers] = useState(true)

  useEffect(() => {
    async function fetchStickers() {
      // Fetch all stickers joined with their album name
      // We order by category first, then by code so they appear grouped
      const { data, error } = await supabase
        .from('stickers')
        .select('id, code, category, album_id, albums(name)')

      if (error) {
        console.error('Error fetching stickers:', error.message)
      } else {
        // Sort by category first, then numerically by the number part of the code
        const sorted = data.sort((a, b) => {
          if (a.category !== b.category) return a.category.localeCompare(b.category)
          // Extract the number from the code e.g. 'ENG10' → 10
          const numA = parseInt(a.code.replace(/[^0-9]/g, ''), 10)
          const numB = parseInt(b.code.replace(/[^0-9]/g, ''), 10)
          return numA - numB
        })
        setStickers(sorted)
      }
      setLoadingStickers(false)
    }

    fetchStickers()
  }, [])

  return (
    <StickersContext.Provider value={{ stickers, loadingStickers }}>
      {children}
    </StickersContext.Provider>
  )
}

export function useStickers() {
  return useContext(StickersContext)
}