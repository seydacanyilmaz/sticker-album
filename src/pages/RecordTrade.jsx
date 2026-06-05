// RecordTrade.jsx
// Records a swap — two StickerPicker panels (received / given).
// Creates a trade_notifications row for the other user (table name unchanged).
// Supports pre-fill via navigation state from the Dashboard swap detail modal.

import { useState, useEffect, useCallback } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useProfile } from '../lib/ProfileContext'
import { useStickers } from '../lib/StickersContext'
import StickerPicker from '../components/StickerPicker'

// Sentinel value for swapping with someone who isn't a user of this app —
// counts are adjusted but no swap notification is sent to anyone.
const OUTSIDE = 'outside'

export default function RecordTrade() {
  const { profile } = useProfile()
  const location = useLocation()
  const { loadingStickers } = useStickers()

  // Pre-fill from the Dashboard swap detail modal (navigation state). Read once
  // at mount via lazy initial state so there's no setState-in-effect.
  const prefill = location.state || {}

  const [otherUsers, setOtherUsers] = useState([])
  const [tradedWithUserId, setTradedWithUserId] = useState(prefill.tradedWithUserId || '')

  const [selectedReceived, setSelectedReceived] = useState(prefill.selectedReceived || [])
  const [historyReceived, setHistoryReceived] = useState([])

  const [selectedGiven, setSelectedGiven] = useState(prefill.selectedGiven || [])
  const [historyGiven, setHistoryGiven] = useState([])

  const [warningIds, setWarningIds] = useState([])
  const [alreadyHaveIds, setAlreadyHaveIds] = useState([])
  const [ownedCounts, setOwnedCounts] = useState({})

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [clampedCodes, setClampedCodes] = useState([])

  const fetchOtherUsers = useCallback(async () => {
    // Hide test accounts from real users; test users can still see each other.
    let query = supabase.from('profiles').select('id, username').neq('id', profile.id)
    if (!profile.is_test) query = query.eq('is_test', false)
    const { data } = await query
    setOtherUsers(data || [])
  }, [profile])

  const fetchWarningIds = useCallback(async () => {
    const { data } = await supabase
      .from('user_stickers').select('sticker_id, count')
      .eq('user_id', profile.id).gt('count', 0)
    const rows = data || []
    const counts = {}
    for (const r of rows) counts[r.sticker_id] = r.count
    setOwnedCounts(counts)
    setWarningIds(rows.filter((r) => r.count === 1).map((r) => r.sticker_id))
    setAlreadyHaveIds(rows.map((r) => r.sticker_id))
  }, [profile])

  useEffect(() => {
    if (!profile) return
    let active = true
    async function load() {
      if (!active) return
      await Promise.all([fetchOtherUsers(), fetchWarningIds()])
    }
    load()
    return () => { active = false }
  }, [profile, fetchOtherUsers, fetchWarningIds])

  function clearFeedback() { setSuccess(false); setClampedCodes([]) }

  function handleSelectReceived(s) { setHistoryReceived((p) => [...p, selectedReceived]); setSelectedReceived((p) => [...p, s]); clearFeedback() }
  function handleRemoveReceived(i) { setHistoryReceived((p) => [...p, selectedReceived]); setSelectedReceived((p) => p.filter((_, j) => j !== i)); clearFeedback() }
  function handleUndoReceived() { if (!historyReceived.length) return; setSelectedReceived(historyReceived[historyReceived.length - 1]); setHistoryReceived((p) => p.slice(0, -1)); clearFeedback() }
  function handleClearReceived() { setHistoryReceived((p) => [...p, selectedReceived]); setSelectedReceived([]); clearFeedback() }

  function handleSelectGiven(s) { setHistoryGiven((p) => [...p, selectedGiven]); setSelectedGiven((p) => [...p, s]); clearFeedback() }
  function handleRemoveGiven(i) { setHistoryGiven((p) => [...p, selectedGiven]); setSelectedGiven((p) => p.filter((_, j) => j !== i)); clearFeedback() }
  function handleUndoGiven() { if (!historyGiven.length) return; setSelectedGiven(historyGiven[historyGiven.length - 1]); setHistoryGiven((p) => p.slice(0, -1)); clearFeedback() }
  function handleClearGiven() { setHistoryGiven((p) => [...p, selectedGiven]); setSelectedGiven([]); clearFeedback() }

  async function handleConfirm() {
    if (!tradedWithUserId) { setError('Please select who you swapped with.'); return }
    if (selectedReceived.length === 0 && selectedGiven.length === 0) { setError('Please add at least one sticker.'); return }

    setLoading(true)
    setError(null)

    const receivedDeltas = {}
    for (const s of selectedReceived) receivedDeltas[s.id] = (receivedDeltas[s.id] || 0) + 1

    const givenDeltas = {}
    for (const s of selectedGiven) givenDeltas[s.id] = (givenDeltas[s.id] || 0) + 1

    const codeById = {}
    for (const s of [...selectedReceived, ...selectedGiven]) codeById[s.id] = s.code

    const clamped = []

    for (const [stickerId, delta] of Object.entries(receivedDeltas)) {
      const { data: existing } = await supabase.from('user_stickers').select('id, count')
        .eq('user_id', profile.id).eq('sticker_id', stickerId).single()
      if (existing) {
        const { error: e } = await supabase.from('user_stickers').update({ count: existing.count + delta }).eq('id', existing.id)
        if (e) { setError('Something went wrong. Please try again.'); setLoading(false); return }
      } else {
        const { error: e } = await supabase.from('user_stickers').insert({ user_id: profile.id, sticker_id: stickerId, count: delta })
        if (e) { setError('Something went wrong. Please try again.'); setLoading(false); return }
      }
    }

    for (const [stickerId, delta] of Object.entries(givenDeltas)) {
      const { data: existing } = await supabase.from('user_stickers').select('id, count')
        .eq('user_id', profile.id).eq('sticker_id', stickerId).single()
      if (existing) {
        const newCount = Math.max(0, existing.count - delta)
        if (existing.count - delta < 0) clamped.push(codeById[stickerId])
        const { error: e } = await supabase.from('user_stickers').update({ count: newCount }).eq('id', existing.id)
        if (e) { setError('Something went wrong. Please try again.'); setLoading(false); return }
      } else {
        clamped.push(codeById[stickerId])
      }
    }

    // Trading with someone outside the app: adjust counts only, notify no one.
    if (tradedWithUserId !== OUTSIDE) {
      const changes = [
        ...Object.entries(receivedDeltas).map(([sticker_id, n]) => ({ sticker_id, delta: -n })),
        ...Object.entries(givenDeltas).map(([sticker_id, n]) => ({ sticker_id, delta: n })),
      ]

      const { error: notifError } = await supabase.from('trade_notifications').insert({
        from_user_id: profile.id,
        to_user_id: tradedWithUserId,
        changes,
        status: 'pending',
      })
      if (notifError) { setError('Something went wrong. Please try again.'); setLoading(false); return }
    }

    setSelectedReceived([]); setHistoryReceived([])
    setSelectedGiven([]); setHistoryGiven([])
    setSuccess(true); setClampedCodes(clamped)
    setLoading(false)
    fetchWarningIds()
  }

  if (loadingStickers) return <p className="text-gray-500 dark:text-gray-400">Loading stickers...</p>

  // Stickers selected to give away more times than the user currently owns — the live "naughty" warning.
  const givenCounts = {}
  for (const s of selectedGiven) givenCounts[s.id] = (givenCounts[s.id] || 0) + 1
  const overSelectedGivenCodes = [...new Set(
    selectedGiven.filter((s) => givenCounts[s.id] > (ownedCounts[s.id] ?? 0)).map((s) => s.code)
  )]

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Record a swap</h2>

      {/* User selector */}
      <div className="space-y-1">
        <label htmlFor="traded-with" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Swapped with
        </label>
        <select
          id="traded-with"
          value={tradedWithUserId}
          onChange={(e) => setTradedWithUserId(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 dark:text-gray-100"
        >
          <option value="">Select a user...</option>
          {otherUsers.map((u) => (
            <option key={u.id} value={u.id}>{u.username}</option>
          ))}
          <option value={OUTSIDE}>Someone outside this app</option>
        </select>
      </div>

      {/* Two StickerPicker panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <StickerPicker
            label="Stickers received"
            selected={selectedReceived}
            onSelect={handleSelectReceived}
            onRemove={handleRemoveReceived}
            warningIds={alreadyHaveIds}
            warningTooltip="You already have this sticker"
            warnOnDuplicateSelection={true}
          />
          <div className="flex gap-2">
            <button onClick={handleUndoReceived} disabled={historyReceived.length === 0}
              className="px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 transition-colors">
              Undo
            </button>
            <button onClick={handleClearReceived} disabled={selectedReceived.length === 0}
              className="px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 transition-colors">
              Clear
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <StickerPicker
            label="Stickers given"
            selected={selectedGiven}
            onSelect={handleSelectGiven}
            onRemove={handleRemoveGiven}
            warningIds={warningIds}
            warnOnDuplicateSelection={true}
            labelWarning={overSelectedGivenCodes.length > 0}
            labelWarningTooltip="You are giving more copies than you currently have"
          />
          <div className="flex gap-2">
            <button onClick={handleUndoGiven} disabled={historyGiven.length === 0}
              className="px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 transition-colors">
              Undo
            </button>
            <button onClick={handleClearGiven} disabled={selectedGiven.length === 0}
              className="px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 transition-colors">
              Clear
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={handleConfirm}
        disabled={loading || (selectedReceived.length === 0 && selectedGiven.length === 0)}
        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {loading ? 'Saving...' : 'Confirm'}
      </button>

      {overSelectedGivenCodes.length > 0 && (
        <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          Your current record shows that you don't have that many of <span className="font-semibold">{overSelectedGivenCodes.join(', ')}</span>. If you are sure about the number you are giving, that means you have been naughty and not kept track properly. If you confirm, the number of {overSelectedGivenCodes.length === 1 ? 'this sticker' : 'these stickers'} will be set to 0. Please double check My Stickers page and fix your record accordingly!
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
          Swap recorded successfully!
        </p>
      )}
      {clampedCodes.length > 0 && (
        <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          Your previous record showed that you didn't have that many of <span className="font-semibold">{clampedCodes.join(', ')}</span>. If you are sure about the number you are giving, that means you have been naughty and not kept track properly. The number of {clampedCodes.length === 1 ? 'this sticker' : 'these stickers'} is set to 0 now. Please double check My Stickers page and fix your record accordingly!
        </p>
      )}

      <Link to="/" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
        ← Back to dashboard
      </Link>
    </div>
  )
}
