// Dashboard.jsx
// Main page after login. Shows swap suggestions, trade notifications, and nav buttons.

import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useProfile } from '../lib/ProfileContext'
import { useStickers } from '../lib/StickersContext'

export default function Dashboard() {
  const { profile, loadingProfile } = useProfile()
  const { stickers, loadingStickers } = useStickers()
  const navigate = useNavigate()

  const [swapSummaries, setSwapSummaries] = useState([])
  const [loadingSwaps, setLoadingSwaps] = useState(true)

  const [notifications, setNotifications] = useState([])
  const [loadingNotifications, setLoadingNotifications] = useState(true)

  const [selectedSwap, setSelectedSwap] = useState(null)

  useEffect(() => {
    if (!profile || loadingStickers) return
    fetchSwapSummaries()
    fetchNotifications()
  }, [profile, loadingStickers])

  async function fetchSwapSummaries() {
    setLoadingSwaps(true)

    const stickerById = {}
    for (const s of stickers) stickerById[s.id] = s

    const { data: otherProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username')
      .neq('id', profile.id)

    if (profilesError) { console.error(profilesError.message); setLoadingSwaps(false); return }

    const { data: allUserStickers, error: stickersError } = await supabase
      .from('user_stickers')
      .select('user_id, sticker_id, count')

    if (stickersError) { console.error(stickersError.message); setLoadingSwaps(false); return }

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
    setLoadingSwaps(false)
  }

  async function fetchNotifications() {
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
  }

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

  if (loadingProfile) return <p className="p-8 text-gray-500">Loading...</p>

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Welcome, {profile?.username}</h1>

      {/* Trade notification banners */}
      {!loadingNotifications && notifications.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">Pending trade notifications</h2>
          {notifications.map((notification) => (
            <div key={notification.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <p className="text-sm text-amber-900">
                <span className="font-semibold">{notification.profiles.username}</span> recorded a trade with you —
                they received <span className="font-semibold">{notification.changes.filter(c => c.delta < 0).length}</span> stickers
                and gave you <span className="font-semibold">{notification.changes.filter(c => c.delta > 0).length}</span> stickers.
                Apply these changes to your collection?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleNotification(notification.id, 'accepted')}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Accept
                </button>
                <button
                  onClick={() => handleNotification(notification.id, 'dismissed')}
                  className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg border border-gray-300 transition-colors"
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
        <h2 className="text-lg font-semibold text-gray-800">Swap suggestions</h2>
        {loadingSwaps ? (
          <p className="text-sm text-gray-500">Calculating swaps...</p>
        ) : swapSummaries.length === 0 ? (
          <p className="text-sm text-gray-500">No swap suggestions yet.</p>
        ) : (
          <div className="space-y-2">
            {swapSummaries.map((summary) => (
              <div key={summary.userId} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
                <p className="text-sm text-gray-700">
                  You can offer <span className="font-semibold text-blue-700">{summary.iCanOffer}</span> stickers
                  to <span className="font-semibold">{summary.username}</span> and they have{' '}
                  <span className="font-semibold text-blue-700">{summary.theyCanOffer}</span> you need.
                </p>
                <button
                  onClick={() => setSelectedSwap(summary)}
                  className="shrink-0 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors font-medium"
                >
                  See details
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Navigation buttons */}
      <section className="grid grid-cols-2 gap-3">
        {[
          { label: 'Record new stickers', path: '/record-new' },
          { label: 'Record a trade', path: '/record-trade' },
          { label: 'Record donated stickers', path: '/record-donated' },
          { label: 'My Stickers', path: '/my-stickers' },
        ].map(({ label, path }) => (
          <Link
            key={path}
            to={path}
            className="block py-3 px-4 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium text-sm rounded-xl transition-colors"
          >
            {label}
          </Link>
        ))}
      </section>

      {/* Swap detail modal */}
      {selectedSwap && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
          onClick={() => setSelectedSwap(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900">
              Swap details with {selectedSwap.username}
            </h3>

            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-gray-700">
                You can offer ({selectedSwap.iCanOffer}):
              </h4>
              {selectedSwap.iCanOfferStickers.length > 0 ? (
                <p className="text-sm text-gray-600 leading-relaxed">
                  {selectedSwap.iCanOfferStickers.map(s => s.code).join(', ')}
                </p>
              ) : (
                <p className="text-sm text-gray-400">Nothing to offer.</p>
              )}
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-gray-700">
                {selectedSwap.username} can offer you ({selectedSwap.theyCanOffer}):
              </h4>
              {selectedSwap.theyCanOfferMeStickers.length > 0 ? (
                <p className="text-sm text-gray-600 leading-relaxed">
                  {selectedSwap.theyCanOfferMeStickers.map(s => s.code).join(', ')}
                </p>
              ) : (
                <p className="text-sm text-gray-400">Nothing to offer.</p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleStartTrade(selectedSwap)}
                disabled={selectedSwap.iCanOffer === 0 && selectedSwap.theyCanOffer === 0}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Start a trade with these stickers
              </button>
              <button
                onClick={() => setSelectedSwap(null)}
                className="px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg border border-gray-300 transition-colors"
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
