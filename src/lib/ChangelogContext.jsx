// ChangelogContext.jsx
// Decides when to show the "What's new" popup. A user sees entries newer than
// profiles.last_seen_changelog_id (null = seen nothing → sees everything). The
// popup auto-opens once per session when there are unseen entries; dismissing it
// (or any close after unseen entries existed) marks them seen in the DB.
//
// Open-state is DERIVED from state set only in event handlers — never in an
// effect — to keep the react-hooks lint rules happy.

import { createContext, useContext, useState } from 'react'
import { supabase } from './supabaseClient'
import { useProfile } from './ProfileContext'
import { CHANGELOG, LATEST_CHANGELOG_ID } from '../changelog'
import ChangelogModal from '../components/ChangelogModal'

const ChangelogContext = createContext({})

export function ChangelogProvider({ children }) {
  const { profile } = useProfile()
  const [manualOpen, setManualOpen] = useState(false)
  const [autoDismissed, setAutoDismissed] = useState(false)

  const lastSeen = profile?.last_seen_changelog_id ?? 0
  const unseen = CHANGELOG.filter((e) => e.id > lastSeen)

  const autoOpen = Boolean(profile) && unseen.length > 0 && !autoDismissed
  const isOpen = manualOpen || autoOpen

  // Auto-open shows just the new entries; opening manually shows the full history.
  const entries = !manualOpen && unseen.length > 0 ? unseen : CHANGELOG

  function openManually() {
    setManualOpen(true)
  }

  async function close() {
    setManualOpen(false)
    setAutoDismissed(true)
    // Mark everything seen once, the first time a user closes after having unseen entries.
    if (profile && lastSeen < LATEST_CHANGELOG_ID) {
      await supabase
        .from('profiles')
        .update({ last_seen_changelog_id: LATEST_CHANGELOG_ID })
        .eq('id', profile.id)
    }
  }

  return (
    <ChangelogContext.Provider value={{ openManually, hasEntries: CHANGELOG.length > 0 }}>
      {children}
      {isOpen && <ChangelogModal entries={entries} onClose={close} />}
    </ChangelogContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useChangelog() {
  return useContext(ChangelogContext)
}
