// RecordTrade.jsx
// Records a trade — two StickerPicker panels (received / given).
// Creates a trade_notifications row for the other user.
// Supports pre-fill via navigation state from the Dashboard swap detail modal.

import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useProfile } from '../lib/ProfileContext'
import { useStickers } from '../lib/StickersContext'
import StickerPicker from '../components/StickerPicker'

export default function RecordTrade() {
  const { profile } = useProfile()
  const navigate = useNavigate()
  const location = useLocation()
  const { loadingStickers } = useStickers()

  const [otherUsers, setOtherUsers] = useState([])
  const [tradedWithUserId, setTradedWithUserId] = useState('')

  const [selectedReceived, setSelectedReceived] = useState([])
  const [historyReceived, setHistoryReceived] = useState([])

  const [selectedGiven, setSelectedGiven] = useState([])
  const [historyGiven, setHistoryGiven] = useState([])

  const [warningIds, setWarningIds] = useState([])
  const [alreadyHaveIds, setAlreadyHaveIds] = useState([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [clampedCodes, setClampedCodes] = useState([])

  useEffect(() => {
    if (!profile) return
    fetchOtherUsers()
    fetchWarningIds()

    if (location.state) {
      if (location.state.selectedReceived) setSelectedReceived(location.state.selectedReceived)
      if (location.state.selectedGiven) setSelectedGiven(location.state.selectedGiven)
      if (location.state.tradedWithUserId) setTradedWithUserId(location.state.tradedWithUserId)
    }
  }, [profile])

  async function fetchOtherUsers() {
    const { data } = await supabase.from('profiles').select('id, username').neq('id', profile.id)
    setOtherUsers(data || [])
  }

  async function fetchWarningIds() {
    const { data } = await supabase
      .from('user_stickers').select('sticker_id, count')
      .eq('user_id', profile.id).gt('count', 0)
    const rows = data || []
    setWarningIds(rows.filter((r) => r.count === 1).map((r) => r.sticker_id))
    setAlreadyHaveIds(rows.map((r) => r.sticker_id))
  }

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
    if (!tradedWithUserId) { setError('Please select who you traded with.'); return }
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

    setSelectedReceived([]); setHistoryReceived([])
    setSelectedGiven([]); setHistoryGiven([])
    setSuccess(true); setClampedCodes(clamped)
    setLoading(false)
    fetchWarningIds()
  }

  if (loadingStickers) return <p className="text-gray-500">Loading stickers...</p>

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Record a trade</h2>

      {/* User selector */}
      <div className="space-y-1">
        <label htmlFor="traded-with" className="block text-sm font-medium text-gray-700">
          Traded with
        </label>
        <select
          id="traded-with"
          value={tradedWithUserId}
          onChange={(e) => setTradedWithUserId(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Select a user...</option>
          {otherUsers.map((u) => (
            <option key={u.id} value={u.id}>{u.username}</option>
          ))}
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
              className="px-4 py-2 bg-white hover:bg-gray-50 disabled:opacity-40 text-gray-700 text-sm font-medium rounded-lg border border-gray-300 transition-colors">
              Undo
            </button>
            <button onClick={handleClearReceived} disabled={selectedReceived.length === 0}
              className="px-4 py-2 bg-white hover:bg-gray-50 disabled:opacity-40 text-gray-700 text-sm font-medium rounded-lg border border-gray-300 transition-colors">
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
          />
          <div className="flex gap-2">
            <button onClick={handleUndoGiven} disabled={historyGiven.length === 0}
              className="px-4 py-2 bg-white hover:bg-gray-50 disabled:opacity-40 text-gray-700 text-sm font-medium rounded-lg border border-gray-300 transition-colors">
              Undo
            </button>
            <button onClick={handleClearGiven} disabled={selectedGiven.length === 0}
              className="px-4 py-2 bg-white hover:bg-gray-50 disabled:opacity-40 text-gray-700 text-sm font-medium rounded-lg border border-gray-300 transition-colors">
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

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          Trade recorded successfully!
        </p>
      )}
      {clampedCodes.length > 0 && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Your current record showed that you didn't have that many of <span className="font-semibold">{clampedCodes.join(', ')}</span>. If you are sure about the number you are giving, that means you have been naughty and not kept track properly. The number of {clampedCodes.length === 1 ? 'this sticker' : 'these stickers'} is set to 0 now. Please double check My Stickers page and fix your record accordingly!
        </p>
      )}

      <Link to="/" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
        ← Back to dashboard
      </Link>
    </div>
  )
}
