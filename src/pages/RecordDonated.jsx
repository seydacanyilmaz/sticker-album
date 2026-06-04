// RecordDonated.jsx
// Records donated stickers — decrements count.
// Warns on count=1 stickers and duplicate selections.

import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useProfile } from '../lib/ProfileContext'
import { useStickers } from '../lib/StickersContext'
import StickerPicker from '../components/StickerPicker'

export default function RecordDonated() {
  const { profile } = useProfile()
  const navigate = useNavigate()
  const { loadingStickers } = useStickers()

  const [selected, setSelected] = useState([])
  const [history, setHistory] = useState([])
  const [warningIds, setWarningIds] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [clampedCodes, setClampedCodes] = useState([])

  useEffect(() => {
    if (!profile) return
    fetchWarningIds()
  }, [profile])

  async function fetchWarningIds() {
    const { data } = await supabase
      .from('user_stickers')
      .select('sticker_id')
      .eq('user_id', profile.id)
      .eq('count', 1)
    setWarningIds(data ? data.map((r) => r.sticker_id) : [])
  }

  function clearFeedback() { setSuccess(false); setClampedCodes([]) }

  function handleSelect(sticker) { setHistory((p) => [...p, selected]); setSelected((p) => [...p, sticker]); clearFeedback() }
  function handleRemove(index) { setHistory((p) => [...p, selected]); setSelected((p) => p.filter((_, i) => i !== index)); clearFeedback() }
  function handleUndo() {
    if (history.length === 0) return
    setSelected(history[history.length - 1]); setHistory((p) => p.slice(0, -1)); clearFeedback()
  }
  function handleClear() { setHistory((p) => [...p, selected]); setSelected([]); clearFeedback() }

  async function handleConfirm() {
    if (selected.length === 0) return
    setLoading(true)
    setError(null)

    const deltas = {}
    for (const sticker of selected) deltas[sticker.id] = (deltas[sticker.id] || 0) + 1

    const codeById = {}
    for (const sticker of selected) codeById[sticker.id] = sticker.code

    const clamped = []

    for (const [stickerId, delta] of Object.entries(deltas)) {
      const { data: existing } = await supabase
        .from('user_stickers').select('id, count')
        .eq('user_id', profile.id).eq('sticker_id', stickerId).single()

      if (existing) {
        const newCount = Math.max(0, existing.count - delta)
        if (existing.count - delta < 0) clamped.push(codeById[stickerId])
        const { error: updateError } = await supabase
          .from('user_stickers').update({ count: newCount }).eq('id', existing.id)
        if (updateError) { setError('Something went wrong. Please try again.'); setLoading(false); return }
      } else {
        clamped.push(codeById[stickerId])
      }
    }

    setSelected([])
    setHistory([])
    setSuccess(true)
    setClampedCodes(clamped)
    setLoading(false)
    fetchWarningIds()
  }

  if (loadingStickers) return <p className="text-gray-500">Loading stickers...</p>

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Record donated stickers</h2>

      <StickerPicker
        selected={selected}
        onSelect={handleSelect}
        onRemove={handleRemove}
        warningIds={warningIds}
        warnOnDuplicateSelection={true}
      />

      <div className="flex gap-2">
        <button
          onClick={handleConfirm}
          disabled={loading || selected.length === 0}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading ? 'Saving...' : 'Confirm'}
        </button>
        <button
          onClick={handleUndo}
          disabled={history.length === 0}
          className="px-4 py-2.5 bg-white hover:bg-gray-50 disabled:opacity-40 text-gray-700 text-sm font-medium rounded-lg border border-gray-300 transition-colors"
        >
          Undo
        </button>
        <button
          onClick={handleClear}
          disabled={selected.length === 0}
          className="px-4 py-2.5 bg-white hover:bg-gray-50 disabled:opacity-40 text-gray-700 text-sm font-medium rounded-lg border border-gray-300 transition-colors"
        >
          Clear
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          Stickers recorded successfully!
        </p>
      )}
      {clampedCodes.length > 0 && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Your current record showed that you didn't have that many of <span className="font-semibold">{clampedCodes.join(', ')}</span>. If you are sure about the number you are donating, that means you have been naughty and not kept track properly. The number of {clampedCodes.length === 1 ? 'this sticker' : 'these stickers'} is set to 0 now. Please double check My Stickers page and fix your record accordingly!
        </p>
      )}

      <Link to="/" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
        ← Back to dashboard
      </Link>
    </div>
  )
}
