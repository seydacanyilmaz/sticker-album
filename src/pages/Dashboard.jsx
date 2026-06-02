// Dashboard.jsx
// The main page users see after logging in.
// Shows swap suggestions with other users and navigation buttons.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useProfile } from '../lib/ProfileContext'

export default function Dashboard() {
  const { profile, loadingProfile } = useProfile()
  const navigate = useNavigate()

  // Will hold swap summary data for each other user
  const [swapSummaries, setSwapSummaries] = useState([])
  const [loadingSwaps, setLoadingSwaps] = useState(true)

  // Will hold any pending trade notifications for the current user
  const [notifications, setNotifications] = useState([])
  const [loadingNotifications, setLoadingNotifications] = useState(true)

  useEffect(() => {
    if (!profile) return
    fetchSwapSummaries()
    fetchNotifications()
  }, [profile])

  async function fetchSwapSummaries() {
    setLoadingSwaps(true)

    // Step 1: get all other users' profiles
    const { data: otherProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username')
      .neq('id', profile.id) // exclude the current user

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError.message)
      setLoadingSwaps(false)
      return
    }

    // Step 2: get all user_stickers rows for the current album
    // We fetch all users' stickers at once and filter in JavaScript
    const { data: allUserStickers, error: stickersError } = await supabase
      .from('user_stickers')
      .select('user_id, sticker_id, count')

    if (stickersError) {
      console.error('Error fetching stickers:', stickersError.message)
      setLoadingSwaps(false)
      return
    }

    // Step 3: build a lookup map for quick access
    // Format: { user_id: { sticker_id: count } }
    const stickerMap = {}
    for (const row of allUserStickers) {
      if (!stickerMap[row.user_id]) stickerMap[row.user_id] = {}
      stickerMap[row.user_id][row.sticker_id] = row.count
    }

    // Step 4: calculate swap summaries for each other user
    // A swap is possible when:
    // - I have count >= 2 (duplicate) AND they have count = 0 (missing) → I can offer it
    // - They have count >= 2 (duplicate) AND I have count = 0 (missing) → they can offer it
    const myStickers = stickerMap[profile.id] || {}

    const summaries = otherProfiles.map((otherUser) => {
      const theirStickers = stickerMap[otherUser.id] || {}

      // Get all sticker IDs that either user has a record for
      const allStickerIds = new Set([
        ...Object.keys(myStickers),
        ...Object.keys(theirStickers),
      ])

      let iCanOffer = 0   // my duplicates they are missing
      let theyCanOffer = 0 // their duplicates I am missing

      for (const stickerId of allStickerIds) {
        const myCount = myStickers[stickerId] ?? 0
        const theirCount = theirStickers[stickerId] ?? 0

        if (myCount >= 2 && theirCount === 0) iCanOffer++
        if (theirCount >= 2 && myCount === 0) theyCanOffer++
      }

      return {
        userId: otherUser.id,
        username: otherUser.username,
        iCanOffer,
        theyCanOffer,
      }
    })

    setSwapSummaries(summaries)
    setLoadingSwaps(false)
  }

  async function fetchNotifications() {
    setLoadingNotifications(true)

    // Fetch pending trade notifications addressed to the current user
    // Also fetch the sender's profile so we can show their username
    const { data, error } = await supabase
      .from('trade_notifications')
      .select('id, changes, created_at, from_user_id, profiles!from_user_id(username)')
      .eq('to_user_id', profile.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching notifications:', error.message)
    } else {
      setNotifications(data)
    }
    setLoadingNotifications(false)
  }

  async function handleNotification(notificationId, action) {
    // action is either 'accepted' or 'dismissed'

    if (action === 'accepted') {
      // Find the notification so we can apply the changes
      const notification = notifications.find((n) => n.id === notificationId)

      // Apply each sticker change to the current user's collection
      // changes is an array of { sticker_id, delta } where delta is +1 or -1
      for (const change of notification.changes) {
        // First check if a row already exists for this user + sticker
        const { data: existing } = await supabase
          .from('user_stickers')
          .select('id, count')
          .eq('user_id', profile.id)
          .eq('sticker_id', change.sticker_id)
          .single()

        if (existing) {
          // Update the existing row
          await supabase
            .from('user_stickers')
            .update({ count: existing.count + change.delta })
            .eq('id', existing.id)
        } else {
          // Insert a new row with the delta as the starting count
          await supabase
            .from('user_stickers')
            .insert({ user_id: profile.id, sticker_id: change.sticker_id, count: change.delta })
        }
      }
    }

    // Mark the notification as accepted or dismissed
    await supabase
      .from('trade_notifications')
      .update({ status: action })
      .eq('id', notificationId)

    // Remove it from the local list
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
  }

  if (loadingProfile) return <p>Loading...</p>

  return (
    <div>
      <h1>Welcome, {profile?.username}</h1>

      {/* Trade notification banners */}
      {!loadingNotifications && notifications.length > 0 && (
        <div>
          <h2>Pending trade notifications</h2>
          {notifications.map((notification) => (
            <div key={notification.id}>
              <p>
                {notification.profiles.username} recorded a trade with you —
                they received {notification.changes.filter(c => c.delta < 0).length} stickers
                and gave you {notification.changes.filter(c => c.delta > 0).length} stickers.
                Apply these changes to your collection?
              </p>
              <button onClick={() => handleNotification(notification.id, 'accepted')}>
                Accept
              </button>
              <button onClick={() => handleNotification(notification.id, 'dismissed')}>
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Swap summaries */}
      <div>
        <h2>Swap suggestions</h2>
        {loadingSwaps ? (
          <p>Calculating swaps...</p>
        ) : (
          swapSummaries.map((summary) => (
            <p key={summary.userId}>
              You can offer <strong>{summary.iCanOffer}</strong> stickers
              to <strong>{summary.username}</strong> and they have{' '}
              <strong>{summary.theyCanOffer}</strong> stickers you need.
            </p>
          ))
        )}
      </div>

      {/* Navigation buttons */}
      <div>
        <button onClick={() => navigate('/record-new')}>Record new stickers</button>
        <button onClick={() => navigate('/record-trade')}>Record a trade</button>
        <button onClick={() => navigate('/record-donated')}>Record donated stickers</button>
      </div>
    </div>
  )
}