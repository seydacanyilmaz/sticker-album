// changelog.spec.js
// "What's new" popup: auto-shows unseen entries on login, marks them seen on dismiss,
// doesn't reappear, and reopens from the menu. Idempotent — it temporarily clears
// testuser1's seen-marker and restores it afterward so the rest of the suite (which
// uses testuser1) isn't disturbed.

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { LATEST_CHANGELOG_ID } from '../src/changelog.js'

dotenv.config({ path: '.env' })

async function signInUser1() {
  const supa = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
  const { data, error } = await supa.auth.signInWithPassword({
    email: process.env.TEST_EMAIL,
    password: process.env.TEST_PASSWORD,
  })
  if (error) throw new Error(`sign in failed: ${error.message}`)
  return { supa, userId: data.user.id }
}

const changelogModal = (page) => page.locator('div.fixed.inset-0', { hasText: "What's new" })

test('Changelog: popup shows unseen entries, marks them seen, and reopens from the menu', async ({ page }) => {
  test.setTimeout(60000)
  const { supa, userId } = await signInUser1()
  try {
    // Pretend the user has never seen the changelog.
    await supa.from('profiles').update({ last_seen_changelog_id: null }).eq('id', userId)

    // On load the popup auto-appears with the inaugural PPNS entry.
    await page.goto('.')
    await expect(changelogModal(page)).toBeVisible()
    await expect(changelogModal(page).getByText('Price per new sticker (PPNS)')).toBeVisible()

    // Dismiss → closes and persists the seen marker (the DB write is async, so poll).
    await changelogModal(page).getByRole('button', { name: 'Got it' }).click()
    await expect(changelogModal(page)).toBeHidden()

    await expect.poll(async () => {
      const { data } = await supa
        .from('profiles').select('last_seen_changelog_id').eq('id', userId).single()
      return data?.last_seen_changelog_id
    }, { timeout: 5000 }).toBe(LATEST_CHANGELOG_ID)

    // Reload → it does NOT auto-show again.
    await page.reload()
    await expect(changelogModal(page)).toBeHidden()

    // The "What's new" menu item reopens it on demand.
    await page.click('button[aria-label="Toggle menu"]')
    await page.getByRole('button', { name: "What's new" }).click()
    await expect(changelogModal(page)).toBeVisible()
  } finally {
    // Restore so the rest of the suite (testuser1) doesn't get the popup.
    await supa.from('profiles').update({ last_seen_changelog_id: LATEST_CHANGELOG_ID }).eq('id', userId)
    await supa.auth.signOut()
  }
})
