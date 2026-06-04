// MyStickers.jsx
// Spreadsheet-style view of all 980 stickers with live count updates.
// Filter by status, search by code prefix, export current view as CSV.

import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useProfile } from '../lib/ProfileContext'
import { useStickers } from '../lib/StickersContext'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'collected', label: 'Collected (Have 1 copy)' },
  { key: 'missing', label: 'Missing' },
  { key: 'duplicates', label: 'Duplicates' },
]

function getStatus(count) {
  if (count === 0) return 'Missing'
  if (count === 1) return 'Collected'
  return 'Duplicate'
}

export default function MyStickers() {
  const { profile } = useProfile()
  const navigate = useNavigate()
  const { stickers, loadingStickers } = useStickers()

  const [userCounts, setUserCounts] = useState({})
  const [loadingCounts, setLoadingCounts] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!profile) return

    fetchCounts()

    const channel = supabase
      .channel('my-stickers-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_stickers', filter: `user_id=eq.${profile.id}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setUserCounts((prev) => { const next = { ...prev }; delete next[payload.old.sticker_id]; return next })
          } else {
            setUserCounts((prev) => ({ ...prev, [payload.new.sticker_id]: payload.new.count }))
          }
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [profile])

  async function fetchCounts() {
    setLoadingCounts(true)
    const { data } = await supabase.from('user_stickers').select('sticker_id, count').eq('user_id', profile.id)
    const counts = {}
    for (const row of data || []) counts[row.sticker_id] = row.count
    setUserCounts(counts)
    setLoadingCounts(false)
  }

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
    if (filter === 'collected' && count !== 1) return false
    if (filter === 'missing' && count !== 0) return false
    if (filter === 'duplicates' && count < 2) return false
    return true
  })

  function exportCsv() {
    const rows = [
      ['Code', 'Category', 'Count', 'Status'],
      ...filtered.map((s) => {
        const count = userCounts[s.id] ?? 0
        return [s.code, s.category, count, getStatus(count)]
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((sticker) => {
                const count = userCounts[sticker.id] ?? 0
                const status = getStatus(count)
                return (
                  <tr key={sticker.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-2.5 font-mono font-medium text-gray-900 dark:text-gray-100">{sticker.code}</td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{sticker.category}</td>
                    <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100">{count}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${
                        status === 'Missing' ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300' :
                        status === 'Collected' ? 'bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300' :
                        'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                      }`}>
                        {status}
                      </span>
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
