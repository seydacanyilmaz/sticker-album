// RecordNew.jsx
// Records newly obtained stickers — increments count per sticker.
// Shows a post-confirm summary of new vs duplicate stickers.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useProfile } from '../lib/ProfileContext'
import { useStickers } from '../lib/StickersContext'
import StickerPicker from '../components/StickerPicker'

export default function RecordNew() {
  const { profile } = useProfile()
  const { loadingStickers } = useStickers()

  const [selected, setSelected] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [summary, setSummary] = useState(null)

  function handleSelect(sticker) {
    setHistory((prev) => [...prev, selected])
    setSelected((prev) => [...prev, sticker])
    setSummary(null)
  }

  function handleRemove(index) {
    setHistory((prev) => [...prev, selected])
    setSelected((prev) => prev.filter((_, i) => i !== index))
    setSummary(null)
  }

  function handleUndo() {
    if (history.length === 0) return
    setSelected(history[history.length - 1])
    setHistory((prev) => prev.slice(0, -1))
    setSummary(null)
  }

  function handleClear() {
    setHistory((prev) => [...prev, selected])
    setSelected([])
    setSummary(null)
  }

  // Appends a snapshot row for the PPNS graph. Failure here never blocks the
  // record itself (counts are already saved) — we just log and move on.
  async function logPpnsSnapshot(newCount) {
    try {
      const batchSize = selected.length

      // Running cumulative pack total = previous snapshot's total + this batch.
      const { data: lastSnap } = await supabase
        .from('progress_snapshots')
        .select('pack_stickers_total')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const packStickersTotal = (lastSnap?.pack_stickers_total ?? 0) + batchSize

      // Running distinct count (stickers with at least one copy).
      const { count: uniqueCount } = await supabase
        .from('user_stickers')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .gte('count', 1)

      await supabase.from('progress_snapshots').insert({
        user_id: profile.id,
        batch_size: batchSize,
        new_count: newCount,
        pack_stickers_total: packStickersTotal,
        unique_count: uniqueCount ?? 0,
      })
    } catch (e) {
      console.error('Failed to log PPNS snapshot:', e)
    }
  }

  async function handleConfirm() {
    if (selected.length === 0) return
    setLoading(true)
    setError(null)

    const deltas = {}
    for (const sticker of selected) {
      deltas[sticker.id] = (deltas[sticker.id] || 0) + 1
    }

    const codeById = {}
    for (const sticker of selected) codeById[sticker.id] = sticker.code

    const stickerIds = Object.keys(deltas)

    const { data: existingRows, error: fetchError } = await supabase
      .from('user_stickers')
      .select('sticker_id, count')
      .eq('user_id', profile.id)
      .in('sticker_id', stickerIds)

    if (fetchError) { setError('Something went wrong. Please try again.'); setLoading(false); return }

    const oldCounts = {}
    for (const row of existingRows) oldCounts[row.sticker_id] = row.count

    for (const [stickerId, delta] of Object.entries(deltas)) {
      const { data: existing } = await supabase
        .from('user_stickers')
        .select('id, count')
        .eq('user_id', profile.id)
        .eq('sticker_id', stickerId)
        .single()

      if (existing) {
        const { error: updateError } = await supabase
          .from('user_stickers')
          .update({ count: existing.count + delta })
          .eq('id', existing.id)
        if (updateError) { setError('Something went wrong. Please try again.'); setLoading(false); return }
      } else {
        const { error: insertError } = await supabase
          .from('user_stickers')
          .insert({ user_id: profile.id, sticker_id: stickerId, count: delta })
        if (insertError) { setError('Something went wrong. Please try again.'); setLoading(false); return }
      }
    }

    const newStickers = []
    const duplicateStickers = []

    for (const [stickerId, delta] of Object.entries(deltas)) {
      const oldCount = oldCounts[stickerId] ?? 0
      const code = codeById[stickerId]
      const newCount = oldCount === 0 ? 1 : 0
      const dupCount = delta - newCount
      if (newCount > 0) newStickers.push(code)
      for (let i = 0; i < dupCount; i++) duplicateStickers.push(code)
    }

    // --- PPNS snapshot ---
    // Log one data point for the Price-Per-New-Sticker graph. Only recording new
    // stickers drives this curve (buying packs), so each Confirm appends a snapshot.
    // Each row is self-contained: batch_size + new_count give THIS batch's PPNS
    // (immune to donations/swaps between records); pack_stickers_total is the
    // running pack-spend X-axis; unique_count is the running distinct total.
    await logPpnsSnapshot(newStickers.length)

    setSelected([])
    setHistory([])
    setSummary({ newStickers, duplicateStickers })
    setLoading(false)
  }

  if (loadingStickers) return <p className="text-gray-500 dark:text-gray-400">Loading stickers...</p>

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Record new stickers</h2>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Tip: for a smoother{' '}
        <Link to="/ppns" className="underline hover:text-gray-700 dark:hover:text-gray-200">PPNS graph</Link>,
        confirm in smaller batches (~20–30) rather than one huge batch. It still works either way.
      </p>

      <StickerPicker
        selected={selected}
        onSelect={handleSelect}
        onRemove={handleRemove}
        warnOnDuplicateSelection={false}
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

      {error && (
        <p className="text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>
      )}

      {summary && (
        <div className="space-y-2">
          {summary.newStickers.length > 0 && (
            <p className="text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
              <span className="font-semibold">Added to album ({summary.newStickers.length}):</span> {summary.newStickers.join(', ')}
            </p>
          )}
          {summary.duplicateStickers.length > 0 && (
            <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
              <span className="font-semibold">Duplicates ({summary.duplicateStickers.length}):</span> {summary.duplicateStickers.join(', ')}
            </p>
          )}
          {summary.newStickers.length === 0 && summary.duplicateStickers.length === 0 && (
            <p className="text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
              Stickers recorded successfully!
            </p>
          )}
        </div>
      )}

      <Link to="/" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
        ← Back to dashboard
      </Link>
    </div>
  )
}
