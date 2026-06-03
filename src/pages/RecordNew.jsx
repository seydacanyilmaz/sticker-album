// RecordNew.jsx
// Page for recording newly obtained stickers.
// Increments the count for each selected sticker by 1 (or more if added multiple times).
// No warnings for duplicate selections — getting multiple copies in one batch is normal.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useProfile } from '../lib/ProfileContext'
import { useStickers } from '../lib/StickersContext'
import StickerPicker from '../components/StickerPicker'

export default function RecordNew() {
  const { profile } = useProfile()
  const navigate = useNavigate()
  const { stickers } = useStickers()

  const [selected, setSelected] = useState([])   // array of selected sticker objects
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Keep a history of states for undo functionality
  // Each entry is a snapshot of selected before a change
  const [history, setHistory] = useState([])

  function handleSelect(sticker) {
    // Save current state to history before making a change
    setHistory((prev) => [...prev, selected])
    setSelected((prev) => [...prev, sticker])
    setSuccess(false)
  }

  function handleRemove(index) {
    // Save current state to history before making a change
    setHistory((prev) => [...prev, selected])
    setSelected((prev) => prev.filter((_, i) => i !== index))
    setSuccess(false)
  }

  function handleUndo() {
    if (history.length === 0) return
    // Restore the last saved state
    const previous = history[history.length - 1]
    setSelected(previous)
    setHistory((prev) => prev.slice(0, -1))
    setSuccess(false)
  }

  function handleClear() {
    setHistory((prev) => [...prev, selected])
    setSelected([])
    setSuccess(false)
  }

  async function handleConfirm() {
    if (selected.length === 0) return
    setLoading(true)
    setError(null)

    // Count how many times each sticker id appears in the selection
    // e.g. if ENG1 was added twice, its delta will be 2
    const deltas = {}
    for (const sticker of selected) {
      deltas[sticker.id] = (deltas[sticker.id] || 0) + 1
    }

    // For each sticker, either update the existing row or insert a new one
    for (const [stickerId, delta] of Object.entries(deltas)) {
      // Check if a row already exists for this user + sticker
      const { data: existing } = await supabase
        .from('user_stickers')
        .select('id, count')
        .eq('user_id', profile.id)
        .eq('sticker_id', stickerId)
        .single()

      if (existing) {
        // Row exists — increment the count
        const { error: updateError } = await supabase
          .from('user_stickers')
          .update({ count: existing.count + delta })
          .eq('id', existing.id)

        if (updateError) {
          setError('Something went wrong. Please try again.')
          setLoading(false)
          return
        }
      } else {
        // No row yet — insert one with the delta as the starting count
        const { error: insertError } = await supabase
          .from('user_stickers')
          .insert({ user_id: profile.id, sticker_id: stickerId, count: delta })

        if (insertError) {
          setError('Something went wrong. Please try again.')
          setLoading(false)
          return
        }
      }
    }

    // All done — clear the selection and show success message
    setSelected([])
    setHistory([])
    setSuccess(true)
    setLoading(false)
  }

  return (
    <div>
      <h2>Record new stickers</h2>
      <p>Stickers loaded: {stickers.length}</p>

      <StickerPicker
        selected={selected}
        onSelect={handleSelect}
        onRemove={handleRemove}
        warnOnDuplicateSelection={false}
      />

      {/* Action buttons */}
      <div>
        <button
          onClick={handleConfirm}
          disabled={loading || selected.length === 0}
        >
          {loading ? 'Saving...' : 'Confirm'}
        </button>
        <button
          onClick={handleUndo}
          disabled={history.length === 0}
        >
          Undo
        </button>
        <button
          onClick={handleClear}
          disabled={selected.length === 0}
        >
          Clear
        </button>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {success && <p style={{ color: 'green' }}>Stickers recorded successfully!</p>}

      <button onClick={() => navigate('/')}>Back to dashboard</button>
    </div>
  )
}