// RecordDonated.jsx
// Records donated stickers — decrements count.
// Warns on count=1 stickers and duplicate selections.

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useProfile } from '../lib/ProfileContext'
import { useStickers } from '../lib/StickersContext'
import StickerPicker from '../components/StickerPicker'

export default function RecordDonated() {
  const { profile } = useProfile()
  const { loadingStickers } = useStickers()

  const [selected, setSelected] = useState([])
  const [history, setHistory] = useState([])
  const [warningIds, setWarningIds] = useState([])
  const [ownedCounts, setOwnedCounts] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [clampedCodes, setClampedCodes] = useState([])

  const fetchWarningIds = useCallback(async () => {
    const { data } = await supabase
      .from('user_stickers')
      .select('sticker_id, count')
      .eq('user_id', profile.id)
      .gt('count', 0)
    const rows = data || []
    const counts = {}
    for (const r of rows) counts[r.sticker_id] = r.count
    setOwnedCounts(counts)
    setWarningIds(rows.filter((r) => r.count === 1).map((r) => r.sticker_id))
  }, [profile])

  useEffect(() => {
    if (!profile) return
    let active = true
    async function load() { if (active) await fetchWarningIds() }
    load()
    return () => { active = false }
  }, [profile, fetchWarningIds])

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

  if (loadingStickers) return <p className="text-gray-500 dark:text-gray-400">Loading stickers...</p>

  // Stickers selected more times than the user currently owns — the live "naughty" warning.
  const selectionCounts = {}
  for (const s of selected) selectionCounts[s.id] = (selectionCounts[s.id] || 0) + 1
  const overSelectedCodes = [...new Set(
    selected.filter((s) => selectionCounts[s.id] > (ownedCounts[s.id] ?? 0)).map((s) => s.code)
  )]

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Record donated stickers</h2>

      <StickerPicker
        label="Stickers to donate"
        selected={selected}
        onSelect={handleSelect}
        onRemove={handleRemove}
        warningIds={warningIds}
        warnOnDuplicateSelection={true}
        labelWarning={overSelectedCodes.length > 0}
        labelWarningTooltip="You are donating more copies than you currently have"
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
          className="px-4 py-2.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 transition-colors"
        >
          Undo
        </button>
        <button
          onClick={handleClear}
          disabled={selected.length === 0}
          className="px-4 py-2.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 transition-colors"
        >
          Clear
        </button>
      </div>

      {overSelectedCodes.length > 0 && (
        <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          Your current record shows that you don't have that many of <span className="font-semibold">{overSelectedCodes.join(', ')}</span>. If you are sure about the number you are donating, that means you have been naughty and not kept track properly. If you confirm, the number of {overSelectedCodes.length === 1 ? 'this sticker' : 'these stickers'} will be set to 0. Please double check My Stickers page and fix your record accordingly!
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
          Stickers recorded successfully!
        </p>
      )}
      {clampedCodes.length > 0 && (
        <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          Your previous record showed that you didn't have that many of <span className="font-semibold">{clampedCodes.join(', ')}</span>. If you are sure about the number you are donating, that means you have been naughty and not kept track properly. The number of {clampedCodes.length === 1 ? 'this sticker' : 'these stickers'} is set to 0 now. Please double check My Stickers page and fix your record accordingly!
        </p>
      )}

      <Link to="/" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
        ← Back to dashboard
      </Link>
    </div>
  )
}
