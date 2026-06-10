// Dashboard.jsx
// Main page after login. Shows swap suggestions, swap notifications, and nav buttons.

import { useEffect, useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useProfile } from '../lib/ProfileContext'
import { useStickers } from '../lib/StickersContext'

export default function Dashboard() {
  const { profile, loadingProfile } = useProfile()
  const { stickers, loadingStickers } = useStickers()
  const navigate = useNavigate()

  const [swapSummaries, setSwapSummaries] = useState([])
  const [userProgress, setUserProgress] = useState([])
  const [loadingSwaps, setLoadingSwaps] = useState(true)

  const [notifications, setNotifications] = useState([])
  const [loadingNotifications, setLoadingNotifications] = useState(true)

  const [selectedSwap, setSelectedSwap] = useState(null)
  const [selectedNotification, setSelectedNotification] = useState(null)

  const fetchSwapSummaries = useCallback(async () => {
    setLoadingSwaps(true)

    const stickerById = {}
    for (const s of stickers) stickerById[s.id] = s

    // Hide test accounts from real users; test users can still see each other.
    let profilesQuery = supabase.from('profiles').select('id, username').neq('id', profile.id)
    if (!profile.is_test) profilesQuery = profilesQuery.eq('is_test', false)
    const { data: otherProfiles, error: profilesError } = await profilesQuery

    if (profilesError) { console.error(profilesError.message); setLoadingSwaps(false); return }

    // Fetch ALL users' rows in pages. PostgREST caps a single request at 1000 rows
    // by default, so an unpaginated select silently truncates once the whole
    // user_stickers table crosses 1000 rows — dropping some of the current user's
    // rows and under-counting progress/swaps. Page through with .range() until done.
    const PAGE_SIZE = 1000
    const allUserStickers = []
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data: page, error: stickersError } = await supabase
        .from('user_stickers')
        .select('user_id, sticker_id, count')
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)

      if (stickersError) { console.error(stickersError.message); setLoadingSwaps(false); return }
      if (!page || page.length === 0) break
      allUserStickers.push(...page)
      if (page.length < PAGE_SIZE) break
    }

    const stickerMap = {}
    for (const row of allUserStickers) {
      if (!stickerMap[row.user_id]) stickerMap[row.user_id] = {}
      stickerMap[row.user_id][row.sticker_id] = row.count
    }

    const myStickers = stickerMap[profile.id] || {}

    const summaries = otherProfiles.map((otherUser) => {
      const theirStickers = stickerMap[otherUser.id] || {}
      const allStickerIds = new Set([...Object.keys(myStickers), ...Object.keys(theirStickers)])

      const iCanOfferStickers = []
      const theyCanOfferMeStickers = []

      for (const stickerId of allStickerIds) {
        const myCount = myStickers[stickerId] ?? 0
        const theirCount = theirStickers[stickerId] ?? 0
        const sticker = stickerById[stickerId]
        if (!sticker) continue
        if (myCount >= 2 && theirCount === 0) iCanOfferStickers.push(sticker)
        if (theirCount >= 2 && myCount === 0) theyCanOfferMeStickers.push(sticker)
      }

      return {
        userId: otherUser.id,
        username: otherUser.username,
        iCanOffer: iCanOfferStickers.length,
        theyCanOffer: theyCanOfferMeStickers.length,
        iCanOfferStickers,
        theyCanOfferMeStickers,
      }
    })

    setSwapSummaries(summaries)

    // Per-user progress (self + the same filtered set of other users). Reuses stickerMap
    // so test users are already excluded for real viewers.
    const progressUsers = [{ id: profile.id, username: profile.username }, ...otherProfiles]
    const progress = progressUsers.map((u) => {
      const counts = stickerMap[u.id] || {}
      let completed = 0
      let total = 0
      for (const c of Object.values(counts)) {
        if (c >= 1) completed += 1
        total += c
      }
      return { userId: u.id, username: u.username, isSelf: u.id === profile.id, completed, total }
    })
    progress.sort((a, b) => b.completed - a.completed)
    setUserProgress(progress)

    setLoadingSwaps(false)
  }, [profile, stickers])

  const fetchNotifications = useCallback(async () => {
    setLoadingNotifications(true)
    const { data, error } = await supabase
      .from('trade_notifications')
      .select('id, changes, created_at, from_user_id, profiles!from_user_id(username)')
      .eq('to_user_id', profile.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) console.error(error.message)
    else setNotifications(data)
    setLoadingNotifications(false)
  }, [profile])

  useEffect(() => {
    if (!profile || loadingStickers) return
    let active = true
    async function load() {
      if (!active) return
      await Promise.all([fetchSwapSummaries(), fetchNotifications()])
    }
    load()
    return () => { active = false }
  }, [profile, loadingStickers, fetchSwapSummaries, fetchNotifications])

  async function handleNotification(notificationId, action) {
    if (action === 'accepted') {
      const notification = notifications.find((n) => n.id === notificationId)
      for (const change of notification.changes) {
        const { data: existing } = await supabase
          .from('user_stickers')
          .select('id, count')
          .eq('user_id', profile.id)
          .eq('sticker_id', change.sticker_id)
          .single()

        if (existing) {
          await supabase.from('user_stickers').update({ count: existing.count + change.delta }).eq('id', existing.id)
        } else {
          await supabase.from('user_stickers').insert({ user_id: profile.id, sticker_id: change.sticker_id, count: change.delta })
        }
      }
    }

    await supabase.from('trade_notifications').update({ status: action }).eq('id', notificationId)
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
    setSelectedNotification(null)
    fetchSwapSummaries()
  }

  function handleStartTrade(swap) {
    setSelectedSwap(null)
    navigate('/record-trade', {
      state: {
        selectedReceived: swap.theyCanOfferMeStickers,
        selectedGiven: swap.iCanOfferStickers,
        tradedWithUserId: swap.userId,
      },
    })
  }

  if (loadingProfile) return <p className="p-8 text-gray-500 dark:text-gray-400">Loading...</p>

  const stickerById = {}
  for (const s of stickers) stickerById[s.id] = s

  // Turns a notification's changes into a readable list of sticker codes,
  // appending ×N when more than one copy is involved. `sign` picks the direction:
  // delta > 0 = stickers you received, delta < 0 = stickers you gave.
  function codesFor(changes, sign) {
    return changes
      .filter((c) => (sign > 0 ? c.delta > 0 : c.delta < 0))
      .map((c) => {
        const code = stickerById[c.sticker_id]?.code ?? '?'
        const n = Math.abs(c.delta)
        return n > 1 ? `${code} ×${n}` : code
      })
      .join(', ')
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Welcome, {profile?.username}</h1>

      {/* Navigation buttons */}
      <section className="grid grid-cols-2 gap-3">
        {[
          { label: 'Record new stickers', path: '/record-new' },
          { label: 'Record a swap', path: '/record-trade' },
          { label: 'Record donated stickers', path: '/record-donated' },
          { label: 'My Stickers', path: '/my-stickers' },
          { label: 'Price per new sticker', path: '/ppns' },
        ].map(({ label, path }) => (
          <Link
            key={path}
            to={path}
            className="block py-3 px-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium text-sm rounded-xl transition-colors"
          >
            {label}
          </Link>
        ))}
      </section>

      {/* Swap notification banners */}
      {!loadingNotifications && notifications.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Pending swap notifications</h2>
          {notifications.map((notification) => (
            <div key={notification.id} className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3">
              <p className="text-sm text-amber-900 dark:text-amber-200">
                <span className="font-semibold">{notification.profiles.username}</span> recorded a swap with you —
                they received <span className="font-semibold">{notification.changes.filter(c => c.delta < 0).length}</span> stickers
                and gave you <span className="font-semibold">{notification.changes.filter(c => c.delta > 0).length}</span> stickers.
                Apply these changes to your collection?
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedNotification(notification)}
                  className="px-4 py-2 bg-white dark:bg-amber-900/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-100 text-sm font-medium rounded-lg border border-amber-300 dark:border-amber-700 transition-colors"
                >
                  See details
                </button>
                <button
                  onClick={() => handleNotification(notification.id, 'accepted')}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Accept
                </button>
                <button
                  onClick={() => handleNotification(notification.id, 'dismissed')}
                  className="px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Swap summaries */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Swap suggestions</h2>
        {loadingSwaps ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Calculating swaps...</p>
        ) : swapSummaries.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No swap suggestions yet.</p>
        ) : (
          <div className="space-y-2">
            {swapSummaries.map((summary) => (
              <div key={summary.userId} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  You can offer <span className="font-semibold text-blue-700 dark:text-blue-400">{summary.iCanOffer}</span> stickers
                  to <span className="font-semibold">{summary.username}</span> and they have{' '}
                  <span className="font-semibold text-blue-700 dark:text-blue-400">{summary.theyCanOffer}</span> you need.
                </p>
                <button
                  onClick={() => setSelectedSwap(summary)}
                  className="shrink-0 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors font-medium"
                >
                  See details
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Everyone's progress */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Everyone's progress</h2>
        {loadingSwaps ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading progress...</p>
        ) : userProgress.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No progress to show yet.</p>
        ) : (
          <div className="space-y-2">
            {userProgress.map((u) => (
              <div key={u.userId} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">{u.isSelf ? 'You' : u.username}</span>{' '}
                  {u.isSelf ? 'have' : 'has'} completed{' '}
                  <span className="font-semibold text-green-700 dark:text-green-400">{u.completed}</span> out of{' '}
                  <span className="font-semibold">{stickers.length}</span> stickers.{' '}
                  {u.isSelf ? 'You have' : 'They have'}{' '}
                  <span className="font-semibold">{u.total}</span> total stickers including duplicates.
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Swap detail modal */}
      {selectedSwap && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
          onClick={() => setSelectedSwap(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Swap details with {selectedSwap.username}
            </h3>

            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                You can offer ({selectedSwap.iCanOffer}):
              </h4>
              {selectedSwap.iCanOfferStickers.length > 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {selectedSwap.iCanOfferStickers.map(s => s.code).join(', ')}
                </p>
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500">Nothing to offer.</p>
              )}
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {selectedSwap.username} can offer you ({selectedSwap.theyCanOffer}):
              </h4>
              {selectedSwap.theyCanOfferMeStickers.length > 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {selectedSwap.theyCanOfferMeStickers.map(s => s.code).join(', ')}
                </p>
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500">Nothing to offer.</p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleStartTrade(selectedSwap)}
                disabled={selectedSwap.iCanOffer === 0 && selectedSwap.theyCanOffer === 0}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Start a swap with these stickers
              </button>
              <button
                onClick={() => setSelectedSwap(null)}
                className="px-4 py-2.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Swap notification detail modal — review before accepting */}
      {selectedNotification && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
          onClick={() => setSelectedNotification(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Swap recorded by {selectedNotification.profiles.username}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Review the changes below. Accepting applies them to your collection automatically.
            </p>

            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                You receive ({selectedNotification.changes.filter(c => c.delta > 0).length}):
              </h4>
              {selectedNotification.changes.some(c => c.delta > 0) ? (
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{codesFor(selectedNotification.changes, 1)}</p>
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500">Nothing.</p>
              )}
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                You give ({selectedNotification.changes.filter(c => c.delta < 0).length}):
              </h4>
              {selectedNotification.changes.some(c => c.delta < 0) ? (
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{codesFor(selectedNotification.changes, -1)}</p>
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500">Nothing.</p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleNotification(selectedNotification.id, 'accepted')}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Accept
              </button>
              <button
                onClick={() => handleNotification(selectedNotification.id, 'dismissed')}
                className="px-4 py-2.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 transition-colors"
              >
                Dismiss
              </button>
              <button
                onClick={() => setSelectedNotification(null)}
                className="px-4 py-2.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
