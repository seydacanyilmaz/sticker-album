// MyStickers.jsx
// Spreadsheet-style view of all 980 stickers with live count updates.
// Filter by status, search by code prefix, export current view as CSV.

import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useProfile } from '../lib/ProfileContext'
import { useStickers } from '../lib/StickersContext'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'collected', label: 'Collected' },
  { key: 'missing', label: 'Missing' },
  { key: 'duplicates', label: 'Duplicates' },
]

function getStatus(count) {
  if (count === 0) return 'Missing'
  if (count === 1) return 'Collected'
  return 'Duplicate'
}

// Compact "x ago" label for the Last changed column. Null = never tracked → "—".
function formatRelative(iso) {
  if (!iso) return '—'
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 10) return 'just now'
  if (sec < 60) return `${sec} seconds ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} minute${min !== 1 ? 's' : ''} ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hour${hr !== 1 ? 's' : ''} ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} day${day !== 1 ? 's' : ''} ago`
  const month = Math.floor(day / 30)
  if (month < 12) return `${month} month${month !== 1 ? 's' : ''} ago`
  const yr = Math.floor(day / 365)
  return `${yr} year${yr !== 1 ? 's' : ''} ago`
}

// Full local date-time, used for the hover tooltip on the relative label.
function formatAbsolute(iso) {
  return iso ? new Date(iso).toLocaleString() : ''
}

// Inline count editor for a single row: a number input plus an explicit Save
// button that only appears once the value has actually changed. Nothing is
// written until Save (or Enter) is pressed. The draft resyncs whenever the
// external count changes (realtime, or another edit).
function CountEditor({ count, onCommit }) {
  const [draft, setDraft] = useState(String(count))

  // Resync the draft when the external count changes (realtime, another edit).
  // Adjusting state during render is React's recommended alternative to a
  // setState-in-effect here — no cascading render, no focus loss while typing.
  const [prevCount, setPrevCount] = useState(count)
  if (count !== prevCount) {
    setPrevCount(count)
    setDraft(String(count))
  }

  const parsed = Math.max(0, parseInt(draft, 10) || 0)
  const dirty = parsed !== count

  function save() {
    setDraft(String(parsed))
    onCommit(parsed)
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min="0"
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && dirty) save() }}
        aria-label="Count"
        className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      {dirty && (
        <button
          type="button"
          onClick={save}
          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors"
        >
          Save
        </button>
      )}
    </div>
  )
}

export default function MyStickers() {
  const { profile } = useProfile()
  const { stickers, loadingStickers } = useStickers()

  const [userCounts, setUserCounts] = useState({})
  const [userUpdatedAt, setUserUpdatedAt] = useState({})
  const [loadingCounts, setLoadingCounts] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sortByRecent, setSortByRecent] = useState(false)
  const [saveError, setSaveError] = useState(null)

  // Mirror of userCounts so commitCount can read the latest count without
  // depending on userCounts (which would rebuild the callback on every edit).
  const countsRef = useRef(userCounts)
  useEffect(() => { countsRef.current = userCounts }, [userCounts])

  const fetchCounts = useCallback(async () => {
    if (!profile) return
    setLoadingCounts(true)
    const { data } = await supabase.from('user_stickers').select('sticker_id, count, updated_at').eq('user_id', profile.id)
    const counts = {}
    const updatedAt = {}
    for (const row of data || []) {
      counts[row.sticker_id] = row.count
      updatedAt[row.sticker_id] = row.updated_at
    }
    setUserCounts(counts)
    setUserUpdatedAt(updatedAt)
    setLoadingCounts(false)
  }, [profile])

  // Manually set a sticker's count. Optimistic: update local state immediately,
  // then write to user_stickers (update existing row, or insert a new one).
  // count 0 keeps the row at 0 (no delete), matching the Record/Donate flows.
  // Manual edits intentionally never write a PPNS snapshot — only RecordNew does.
  const commitCount = useCallback(async (sticker, rawCount) => {
    if (!profile) return
    const newCount = Math.max(0, Math.floor(rawCount) || 0)
    const prev = countsRef.current[sticker.id] ?? 0
    if (newCount === prev) return

    // Optimistic update (sync into the ref too so back-to-back clicks stay correct).
    countsRef.current = { ...countsRef.current, [sticker.id]: newCount }
    setUserCounts(countsRef.current)
    setSaveError(null)

    const { data: existing } = await supabase
      .from('user_stickers').select('id')
      .eq('user_id', profile.id).eq('sticker_id', sticker.id).maybeSingle()

    const { error } = existing
      ? await supabase.from('user_stickers').update({ count: newCount }).eq('id', existing.id)
      : await supabase.from('user_stickers').insert({ user_id: profile.id, sticker_id: sticker.id, count: newCount })

    if (error) {
      // Revert the optimistic change.
      countsRef.current = { ...countsRef.current, [sticker.id]: prev }
      setUserCounts(countsRef.current)
      setSaveError('Could not save your change. Please try again.')
    }
  }, [profile])

  useEffect(() => {
    if (!profile) return

    let active = true
    async function load() { if (active) await fetchCounts() }
    load()

    const channel = supabase
      .channel('my-stickers-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_stickers', filter: `user_id=eq.${profile.id}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setUserCounts((prev) => { const next = { ...prev }; delete next[payload.old.sticker_id]; return next })
            setUserUpdatedAt((prev) => { const next = { ...prev }; delete next[payload.old.sticker_id]; return next })
          } else {
            setUserCounts((prev) => ({ ...prev, [payload.new.sticker_id]: payload.new.count }))
            setUserUpdatedAt((prev) => ({ ...prev, [payload.new.sticker_id]: payload.new.updated_at }))
          }
        }
      )
      .subscribe()

    return () => { active = false; supabase.removeChannel(channel) }
  }, [profile, fetchCounts])

  if (loadingStickers || loadingCounts) return <p className="text-gray-500 dark:text-gray-400">Loading...</p>

  const collectedCount = stickers.filter((sticker) => (userCounts[sticker.id] ?? 0) >= 1).length
  const totalWithDuplicates = stickers.reduce((sum, sticker) => sum + (userCounts[sticker.id] ?? 0), 0)
  const duplicateStickerCount = stickers.filter((sticker) => (userCounts[sticker.id] ?? 0) >= 2).length
  const totalDuplicates = stickers.reduce((sum, sticker) => {
    const count = userCounts[sticker.id] ?? 0
    return sum + (count >= 2 ? count - 1 : 0)
  }, 0)

  const filtered = stickers.filter((sticker) => {
    if (search && !sticker.code.toLowerCase().startsWith(search.toLowerCase())) return false
    const count = userCounts[sticker.id] ?? 0
    if (filter === 'collected' && count < 1) return false
    if (filter === 'missing' && count !== 0) return false
    if (filter === 'duplicates' && count < 2) return false
    return true
  })

  // When "Recently changed" is on, most-recently-changed rows float to the top;
  // never-tracked rows (no timestamp) sink to the bottom. Otherwise keep the
  // natural sticker order from StickersContext.
  const ts = (id) => (userUpdatedAt[id] ? new Date(userUpdatedAt[id]).getTime() : -Infinity)
  const sorted = sortByRecent ? [...filtered].sort((a, b) => ts(b.id) - ts(a.id)) : filtered

  function exportCsv() {
    const rows = [
      ['Code', 'Category', 'Count', 'Status', 'Last changed'],
      ...sorted.map((s) => {
        const count = userCounts[s.id] ?? 0
        // Raw ISO keeps the CSV comma-free and machine-sortable.
        return [s.code, s.category, count, getStatus(count), userUpdatedAt[s.id] ?? '']
      }),
    ]
    const csv = rows.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `my-stickers-${filter}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">My Stickers</h2>

      {/* Controls */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code e.g. ENG1"
            autoComplete="off"
            className="flex-1 px-3 py-2.5 border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={() => setSortByRecent((v) => !v)}
            aria-pressed={sortByRecent}
            className={`px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap ${
              sortByRecent
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700'
            }`}
          >
            Recently changed
          </button>
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="px-4 py-2.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 transition-colors whitespace-nowrap"
          >
            Export CSV
          </button>
        </div>

        {filter === 'all' ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            You have collected <span className="font-semibold text-gray-900 dark:text-gray-100">{collectedCount}</span> stickers out of{' '}
            <span className="font-semibold text-gray-900 dark:text-gray-100">{stickers.length}</span>. Your total number of stickers including
            all duplicates is <span className="font-semibold text-gray-900 dark:text-gray-100">{totalWithDuplicates}</span>.
          </p>
        ) : filter === 'duplicates' ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            You have duplicates for <span className="font-semibold text-gray-900 dark:text-gray-100">{duplicateStickerCount}</span> stickers.
            Total number of duplicates is <span className="font-semibold text-gray-900 dark:text-gray-100">{totalDuplicates}</span>.
          </p>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">{filtered.length} sticker{filtered.length !== 1 ? 's' : ''}</p>
        )}

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Tip: you can fix any count directly in the table below — type a new number, then click Save.
        </p>

        {saveError && (
          <p className="text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{saveError}</p>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No stickers match this filter.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Code</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Category</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Count</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Last changed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sorted.map((sticker) => {
                const count = userCounts[sticker.id] ?? 0
                const status = getStatus(count)
                return (
                  <tr key={sticker.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-2.5 font-mono font-medium text-gray-900 dark:text-gray-100">{sticker.code}</td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{sticker.category}</td>
                    <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100">
                      <CountEditor count={count} onCommit={(n) => commitCount(sticker, n)} />
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${
                        status === 'Missing' ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300' :
                        status === 'Collected' ? 'bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300' :
                        'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                      }`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap" title={formatAbsolute(userUpdatedAt[sticker.id])}>
                      {formatRelative(userUpdatedAt[sticker.id])}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Link to="/" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
        ← Back to dashboard
      </Link>
    </div>
  )
}
