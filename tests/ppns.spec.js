// ppns.spec.js
// End-to-end tests for the Price-Per-New-Sticker (PPNS) feature added this session,
// plus a 200-pack opening SIMULATION whose data is intentionally LEFT in place on
// testuser2 so the chart can be viewed after the run.
//
// Feature tests (1–3) run as testuser1 via the normal UI (storageState).
// The simulation (4) and chart view (5) target testuser2.
//
// Requires the DELETE RLS policies on progress_snapshots + user_stickers (own rows)
// so the suite can reset between runs — see PROJECT_CONTEXT.md "DB migration: PPNS graph".
//
// Idempotent: every test resets the slice of data it depends on before asserting.
// The simulation resets testuser2's PPNS data, refills it, and does NOT clean up.

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { addSticker, setCount } from './helpers'

dotenv.config({ path: '.env' }) // VITE_SUPABASE_URL / ANON_KEY (TEST_* come from .env.test via config)

const SUPA_URL = process.env.VITE_SUPABASE_URL
const SUPA_KEY = process.env.VITE_SUPABASE_ANON_KEY

const PACK_PRICE = 1.25
const PACK_SIZE = 7

// A fresh signed-in supabase client for direct DB reads/writes as a given account.
async function supaFor(email, password) {
  const supa = createClient(SUPA_URL, SUPA_KEY)
  const { data, error } = await supa.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`sign in failed for ${email}: ${error.message}`)
  return { supa, userId: data.user.id }
}

// Log in through the UI and return the username — waits for the profile to load
// so the username isn't read as "" (same hardening as the swap-notification test).
async function login(page, email, password) {
  await page.goto('.')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button:has-text("Sign in")')
  const heading = page.locator('h1', { hasText: 'Welcome,' })
  await expect(heading).toHaveText(/Welcome,\s+\S+/, { timeout: 15000 })
  return (await heading.innerText()).replace('Welcome,', '').trim()
}

test.describe.serial('PPNS feature', () => {
  // 1) Recording new stickers writes a self-contained progress_snapshots row.
  test('RecordNew writes a PPNS snapshot with correct batch/new/total fields', async ({ page }) => {
    test.setTimeout(60000)
    const { supa, userId } = await supaFor(process.env.TEST_EMAIL, process.env.TEST_PASSWORD)

    // Clean slate for this user's snapshots so pack_stickers_total is deterministic.
    await supa.from('progress_snapshots').delete().eq('user_id', userId)

    // Two stickers, both forced to 0 so the batch records exactly 2 NEW stickers.
    await setCount(page, 'ENG1', 0)
    await setCount(page, 'ENG2', 0)

    await page.goto('record-new')
    await addSticker(page, 'ENG1', 0)
    await addSticker(page, 'ENG2', 0)
    await page.click('button:has-text("Confirm")')
    await expect(page.locator('text=Added to album')).toBeVisible()

    // The app awaits the snapshot insert before showing the summary, so it exists now.
    const { data: snap, error } = await supa
      .from('progress_snapshots')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    expect(error, error?.message).toBeNull()
    expect(snap.batch_size).toBe(2)
    expect(snap.new_count).toBe(2)
    expect(snap.pack_stickers_total).toBe(2) // first snapshot after reset
    expect(snap.unique_count).toBeGreaterThanOrEqual(2)

    await supa.auth.signOut()
  })

  // 2) The PPNS page is reachable, renders the chart + pricing inputs, and persists settings.
  test('PPNS page renders chart + inputs and persists pricing settings', async ({ page }) => {
    test.setTimeout(60000)

    // Reach it via the Dashboard nav button (verifies the wiring).
    await page.goto('.')
    await page.getByRole('link', { name: 'Price per new sticker' }).first().click()
    await expect(page).toHaveURL(/\/ppns$/)

    await expect(page.getByRole('heading', { name: 'Price per new sticker' })).toBeVisible()

    // Default pricing inputs.
    const packPrice = page.locator('label', { hasText: 'Pack price' }).locator('input')
    const perPack = page.locator('label', { hasText: 'Stickers per pack' }).locator('input')
    const buyPrice = page.locator('label', { hasText: 'Direct-buy price' }).locator('input')
    await expect(packPrice).toHaveValue(String(PACK_PRICE))
    await expect(perPack).toHaveValue(String(PACK_SIZE))
    await expect(buyPrice).toHaveValue('0.36')

    // Chart renders (test 1 left a snapshot for this user).
    await expect(page.locator('svg[aria-label="Price per new sticker chart"]')).toBeVisible()

    // Settings persist to localStorage across a reload.
    await buyPrice.fill('0.50')
    await page.reload()
    const buyPriceAfter = page.locator('label', { hasText: 'Direct-buy price' }).locator('input')
    await expect(buyPriceAfter).toHaveValue('0.50')

    // Restore default so the test is idempotent.
    await buyPriceAfter.fill('0.36')
  })

  // 3) The baseline button stamps profiles.ppns_baseline_at and the UI reflects it.
  test('Baseline reset sets ppns_baseline_at and shows the accurate-from notice', async ({ page }) => {
    test.setTimeout(60000)
    const { supa, userId } = await supaFor(process.env.TEST_EMAIL, process.env.TEST_PASSWORD)

    await page.goto('ppns')
    await page.getByRole('button', { name: "I've entered everything I currently own" }).click()
    await page.getByRole('button', { name: 'Yes, set baseline' }).click()

    await expect(page.locator('text=Accurate data starts from')).toBeVisible()

    const { data: profile } = await supa
      .from('profiles').select('ppns_baseline_at').eq('id', userId).single()
    expect(profile.ppns_baseline_at).not.toBeNull()

    // Tidy up: clear the baseline so this user's chart isn't left greyed.
    await supa.from('profiles').update({ ppns_baseline_at: null }).eq('id', userId)
    await supa.auth.signOut()
  })

  // 4) SIMULATION — testuser2 opens 200 packs (1400 stickers), recorded in batches of 21
  //    (every 3 packs). Mirrors the app's RecordNew snapshot logic exactly, but writes
  //    directly to Supabase (driving 1400 stickers through the UI would be impractically slow).
  //    Data is intentionally KEPT so the chart can be viewed afterward.
  test('Simulation: testuser2 opens 200 packs recorded in batches of 21 (data kept)', async () => {
    test.setTimeout(120000)
    const { supa, userId } = await supaFor(process.env.TEST_EMAIL_B, process.env.TEST_PASSWORD_B)

    // --- reset (needs the DELETE RLS policies) ---
    await supa.from('progress_snapshots').delete().eq('user_id', userId)
    await supa.from('user_stickers').delete().eq('user_id', userId)
    await supa.from('profiles').update({ ppns_baseline_at: null }).eq('id', userId)

    // Guard: confirm the reset actually emptied the table (a no-op delete means the
    // DELETE policy migration hasn't been applied yet).
    const { count: leftover } = await supa
      .from('progress_snapshots').select('id', { count: 'exact', head: true }).eq('user_id', userId)
    expect(leftover, 'progress_snapshots not empty after reset — run the DELETE RLS policy migration').toBe(0)

    // --- sticker pool ---
    const { data: stickers, error: sErr } = await supa.from('stickers').select('id')
    expect(sErr, sErr?.message).toBeNull()
    const ids = stickers.map((s) => s.id)
    expect(ids.length).toBeGreaterThan(0)

    // --- simulate ---
    const PACKS = 200
    const PER_BATCH = 21 // 3 packs
    const totalStickers = PACKS * PACK_SIZE // 1400

    const counts = new Map() // sticker_id -> count (only ids ever drawn are present, all > 0)
    const snapshots = []
    let packStickersTotal = 0
    let drawn = 0
    let batchIndex = 0
    const expectedBatches = Math.ceil(totalStickers / PER_BATCH) // 67
    const baseTime = Date.now() - expectedBatches * 60000 // 1-min spacing, all in the past

    while (drawn < totalStickers) {
      const thisBatch = Math.min(PER_BATCH, totalStickers - drawn)
      const batchDraws = []
      for (let i = 0; i < thisBatch; i++) batchDraws.push(ids[Math.floor(Math.random() * ids.length)])

      // new_count = distinct stickers in this batch whose PRE-batch count was 0 (app semantics).
      const seenNew = new Set()
      let newCount = 0
      for (const id of batchDraws) {
        if ((counts.get(id) || 0) === 0 && !seenNew.has(id)) { seenNew.add(id); newCount++ }
      }
      for (const id of batchDraws) counts.set(id, (counts.get(id) || 0) + 1)

      packStickersTotal += thisBatch
      drawn += thisBatch
      snapshots.push({
        user_id: userId,
        batch_size: thisBatch,
        new_count: newCount,
        pack_stickers_total: packStickersTotal,
        unique_count: counts.size,
        created_at: new Date(baseTime + batchIndex * 60000).toISOString(),
      })
      batchIndex++
    }

    // --- write snapshots + final collection counts ---
    const { error: snapErr } = await supa.from('progress_snapshots').insert(snapshots)
    expect(snapErr, snapErr?.message).toBeNull()

    const stickerRows = []
    for (const [id, c] of counts) stickerRows.push({ user_id: userId, sticker_id: id, count: c })
    const { error: usErr } = await supa.from('user_stickers').insert(stickerRows)
    expect(usErr, usErr?.message).toBeNull()

    // --- assertions ---
    expect(snapshots.length).toBe(expectedBatches)
    const last = snapshots[snapshots.length - 1]
    expect(last.pack_stickers_total).toBe(totalStickers) // 1400
    expect(last.batch_size).toBe(14) // 1400 - 66*21
    expect(last.unique_count).toBe(counts.size)
    // Realistic collection fraction for 1400 uniform draws over ~980 stickers.
    expect(counts.size).toBeGreaterThan(500)
    expect(counts.size).toBeLessThan(ids.length)
    // PPNS must rise above the £0.36 direct-buy price at some point (the "stop buying" signal).
    const costPerSticker = PACK_PRICE / PACK_SIZE
    const crossed = snapshots.some((s) => s.new_count === 0 || (s.batch_size * costPerSticker) / s.new_count >= 0.36)
    expect(crossed).toBe(true)

    // Persisted count matches.
    const { count: snapCount } = await supa
      .from('progress_snapshots').select('id', { count: 'exact', head: true }).eq('user_id', userId)
    expect(snapCount).toBe(expectedBatches)

    await supa.auth.signOut()
  })

  // 5) The simulated data renders a real curve and triggers the stop-buying indicator.
  test('Chart: testuser2 sees the simulated curve and a stop-buying signal', async ({ browser }) => {
    test.setTimeout(60000)
    const ctx = await browser.newContext({ storageState: undefined })
    const page = await ctx.newPage()
    try {
      await login(page, process.env.TEST_EMAIL_B, process.env.TEST_PASSWORD_B)
      await page.goto('ppns')

      await expect(page.locator('svg[aria-label="Price per new sticker chart"]')).toBeVisible()
      await expect(page.getByText(/bought\s+1400\s+stickers/)).toBeVisible()
      // PPNS has climbed past the direct-buy price → the amber "stop buying" message shows.
      await expect(page.getByText('has reached the direct-buy price')).toBeVisible()
    } finally {
      await ctx.close()
    }
  })
})
