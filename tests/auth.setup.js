import { test as setup } from '@playwright/test'
import { mkdir } from 'fs/promises'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { LATEST_CHANGELOG_ID } from '../src/changelog.js'

dotenv.config({ path: '.env' })

// Mark the changelog as already seen for a test account so the "What's new" popup
// doesn't auto-open and intercept clicks during the suite. (changelog.spec.js drives
// the popup itself by temporarily clearing this.)
async function markChangelogSeen(email, password) {
  const supa = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
  const { data, error } = await supa.auth.signInWithPassword({ email, password })
  if (!error && data?.user) {
    await supa.from('profiles').update({ last_seen_changelog_id: LATEST_CHANGELOG_ID }).eq('id', data.user.id)
  }
  await supa.auth.signOut()
}

setup('authenticate', async ({ page }) => {
  await mkdir('playwright/.auth', { recursive: true })

  await page.goto('.')
  await page.fill('input[type="email"]', process.env.TEST_EMAIL)
  await page.fill('input[type="password"]', process.env.TEST_PASSWORD)
  await page.click('button:has-text("Sign in")')

  // Wait until the dashboard heading appears — confirms login succeeded
  await page.waitForSelector('h1:has-text("Welcome")', { timeout: 15000 })

  await page.context().storageState({ path: 'playwright/.auth/user.json' })

  // Keep the changelog popup out of the way for both test accounts.
  await markChangelogSeen(process.env.TEST_EMAIL, process.env.TEST_PASSWORD)
  if (process.env.TEST_EMAIL_B && process.env.TEST_PASSWORD_B) {
    await markChangelogSeen(process.env.TEST_EMAIL_B, process.env.TEST_PASSWORD_B)
  }
})
