import { test, expect } from '@playwright/test'
import { addSticker, stickerRow, resetToZero, setCount } from './helpers'

// These tests never assume a clean database. Any test that depends on a sticker's
// count first drives that sticker to a known value with setCount / resetToZero, so
// the suite is idempotent and can be re-run any number of times without a DB reset.

// ─── Dashboard ───────────────────────────────────────────────────────────────

test('dashboard shows welcome message', async ({ page }) => {
  await page.goto('.')
  await expect(page.locator('h1')).toContainText('Welcome')
})

test('dashboard has navigation links', async ({ page }) => {
  await page.goto('.')
  await expect(page.getByRole('link', { name: 'Record new stickers' }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Record a swap' }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Record donated stickers' }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'My Stickers' }).first()).toBeVisible()
})

// Guards the pagination fix: "Everyone's progress" (which fetches every user's rows)
// must report the same collected/total for the current user as My Stickers (which
// fetches only the current user). They diverged when the unpaginated Dashboard query
// hit PostgREST's 1000-row cap and silently dropped some of the user's rows.
test('dashboard self progress matches My Stickers totals', async ({ page }) => {
  await page.goto('my-stickers')
  const mine = await page.getByText(/You have collected/).innerText()
  const m = mine.match(/collected\s+(\d+)\s+stickers out of\s+\d+\.\s+Your total number of stickers including all duplicates is\s+(\d+)/)
  expect(m, `Could not parse My Stickers summary: ${mine}`).not.toBeNull()

  await page.goto('.')
  const section = page.locator('section').filter({ hasText: "Everyone's progress" })
  await expect(section.getByText(/You have completed/)).toBeVisible()
  const dash = await section.innerText()
  const d = dash.match(/You have completed\s+(\d+)\s+out of\s+\d+\s+stickers\.\s+You have\s+(\d+)\s+total/)
  expect(d, `Could not parse Dashboard self line: ${dash}`).not.toBeNull()

  expect(d[1]).toBe(m[1]) // completed === collected
  expect(d[2]).toBe(m[2]) // total (incl. duplicates) matches
})

// ─── RecordNew ───────────────────────────────────────────────────────────────

test('RecordNew: adds a new sticker and shows it in summary', async ({ page }) => {
  await setCount(page, 'ENG1', 0)
  await page.goto('record-new')
  await addSticker(page, 'ENG1')
  await page.click('button:has-text("Confirm")')
  await expect(page.locator('text=Added to album')).toBeVisible()
  await expect(page.locator('text=ENG1')).toBeVisible()
})

test('RecordNew: adding same sticker twice shows one new and one duplicate', async ({ page }) => {
  await setCount(page, 'ENG2', 0)
  await page.goto('record-new')
  await addSticker(page, 'ENG2')
  await addSticker(page, 'ENG2')
  await page.click('button:has-text("Confirm")')
  await expect(page.locator('text=Added to album')).toBeVisible()
  await expect(page.locator('text=Duplicates')).toBeVisible()
})

test('RecordNew: recording an already-collected sticker shows it as duplicate', async ({ page }) => {
  await setCount(page, 'ENG1', 1) // exactly one copy → collected
  await page.goto('record-new')
  await addSticker(page, 'ENG1')
  await page.click('button:has-text("Confirm")')
  await expect(page.locator('text=Duplicates')).toBeVisible()
  await expect(page.locator('text=Added to album')).not.toBeVisible()
})

test('RecordNew: undo removes last added sticker', async ({ page }) => {
  await page.goto('record-new')
  await addSticker(page, 'ENG3')
  await addSticker(page, 'ENG4')
  await page.click('button:has-text("Undo")')
  // ENG4 should be gone, ENG3 should remain — check chip count
  const chips = page.locator('span').filter({ hasText: /^ENG\d/ })
  await expect(chips).toHaveCount(1)
  await expect(chips.first()).toContainText('ENG3')
})

test('RecordNew: clear removes all selected stickers', async ({ page }) => {
  await page.goto('record-new')
  await addSticker(page, 'ENG5')
  await addSticker(page, 'ENG6')
  await page.click('button:has-text("Clear")')
  await expect(page.locator('button:has-text("Confirm")')).toBeDisabled()
})

test('StickerPicker: shows a count of selected stickers', async ({ page }) => {
  await page.goto('record-new')
  await addSticker(page, 'ENG5')
  await expect(page.locator('text=1 sticker selected')).toBeVisible()
  await addSticker(page, 'ENG6')
  await expect(page.locator('text=2 stickers selected')).toBeVisible()
})

test('RecordNew: summary headings show counts', async ({ page }) => {
  await setCount(page, 'ENG2', 0)
  await page.goto('record-new')
  await addSticker(page, 'ENG2')
  await addSticker(page, 'ENG2')
  await page.click('button:has-text("Confirm")')
  await expect(page.locator('text=Added to album (1):')).toBeVisible()
  await expect(page.locator('text=Duplicates (1):')).toBeVisible()
})

// ─── MyStickers ──────────────────────────────────────────────────────────────

test('MyStickers: shows a duplicate sticker with correct count and status', async ({ page }) => {
  await setCount(page, 'ENG1', 2)
  await page.goto('my-stickers')
  const row = stickerRow(page, 'ENG1')
  await expect(row).toBeVisible()
  await expect(row.locator('td').nth(2).locator('input')).toHaveValue('2')
  await expect(row.locator('td').nth(3)).toContainText('Duplicate')
})

test('MyStickers: Duplicates filter shows a duplicate sticker', async ({ page }) => {
  await setCount(page, 'ENG1', 2)
  await page.goto('my-stickers')
  await page.click('button:has-text("Duplicates")')
  await expect(stickerRow(page, 'ENG1')).toBeVisible()
})

test('MyStickers: Missing filter hides a collected sticker', async ({ page }) => {
  await setCount(page, 'ENG1', 1)
  await page.goto('my-stickers')
  await page.click('button:has-text("Missing")')
  await expect(stickerRow(page, 'ENG1')).not.toBeVisible()
})

test('MyStickers: search for ENG1 shows ENG1 but hides ENG2', async ({ page }) => {
  await page.goto('my-stickers')
  await page.fill('input[placeholder*="Search"]', 'ENG1')
  await expect(stickerRow(page, 'ENG1')).toBeVisible()
  await expect(stickerRow(page, 'ENG2')).not.toBeVisible()
})

// ─── RecordDonated ───────────────────────────────────────────────────────────

test('RecordDonated: donating shows success message', async ({ page }) => {
  await setCount(page, 'ENG1', 2)
  await page.goto('record-donated')
  await addSticker(page, 'ENG1')
  await page.click('button:has-text("Confirm")')
  await expect(page.locator('text=Stickers recorded successfully')).toBeVisible()
})

test('RecordDonated: donating count=1 sticker shows warning chip', async ({ page }) => {
  await setCount(page, 'ENG1', 1)
  await page.goto('record-donated')
  await addSticker(page, 'ENG1')
  await expect(page.locator('span[title*="1 copy"]')).toBeVisible()
})

test('RecordDonated: donating more than available shows naughty message', async ({ page }) => {
  await setCount(page, 'ENG1', 1)
  await page.goto('record-donated')
  await addSticker(page, 'ENG1')
  await addSticker(page, 'ENG1') // donating 2 when only 1 is held → clamp to 0
  await page.click('button:has-text("Confirm")')
  await expect(page.locator('text=naughty')).toBeVisible()
})

test('RecordDonated: donating sticker with no record shows naughty message', async ({ page }) => {
  await resetToZero(page, 'FWC1')
  await page.goto('record-donated')
  await addSticker(page, 'FWC1')
  await page.click('button:has-text("Confirm")')
  await expect(page.locator('text=naughty')).toBeVisible()
})

test('RecordDonated: selecting more than owned shows the live warning before confirm', async ({ page }) => {
  await setCount(page, 'ENG1', 1)
  await page.goto('record-donated')
  await addSticker(page, 'ENG1')
  await addSticker(page, 'ENG1') // selecting 2 when only 1 is held
  // The pre-confirm warning appears without clicking Confirm.
  await expect(page.locator('text=Your current record shows')).toBeVisible()
})

test('RecordDonated: selecting within owned count shows no live warning', async ({ page }) => {
  await setCount(page, 'ENG1', 2)
  await page.goto('record-donated')
  await addSticker(page, 'ENG1')
  await addSticker(page, 'ENG1') // selecting 2 when 2 are held → fine
  await expect(page.locator('text=Your current record shows')).not.toBeVisible()
})

test('RecordDonated: post-confirm naughty message uses "previous record"', async ({ page }) => {
  await setCount(page, 'ENG1', 1)
  await page.goto('record-donated')
  await addSticker(page, 'ENG1')
  await addSticker(page, 'ENG1')
  await page.click('button:has-text("Confirm")')
  await expect(page.locator('text=Your previous record showed')).toBeVisible()
})

test('MyStickers: a reset sticker shows count 0 and Missing', async ({ page }) => {
  await resetToZero(page, 'ENG1')
  await page.goto('my-stickers')
  const row = stickerRow(page, 'ENG1')
  await expect(row.locator('td').nth(2).locator('input')).toHaveValue('0')
  await expect(row.locator('td').nth(3)).toContainText('Missing')
})

// ─── Nav ─────────────────────────────────────────────────────────────────────

test('Nav: hamburger opens and closes menu', async ({ page }) => {
  await page.goto('.')
  // Sign out only exists inside the nav dropdown — good canary for open/closed state
  const signOut = page.locator('nav button:has-text("Sign out")')
  await expect(signOut).not.toBeVisible()
  await page.click('button[aria-label="Toggle menu"]')
  await expect(signOut).toBeVisible()
  await page.click('button[aria-label="Toggle menu"]')
  await expect(signOut).not.toBeVisible()
})

test('Nav: title link navigates to dashboard', async ({ page }) => {
  await page.goto('record-new')
  await page.click('a:has-text("Sticker Album Tracker")')
  await expect(page.locator('h1')).toContainText('Welcome')
})

test('Nav: How it works link opens the help page', async ({ page }) => {
  await page.goto('.')
  await page.click('button[aria-label="Toggle menu"]')
  await page.getByRole('link', { name: 'How it works' }).first().click()
  await expect(page.getByRole('heading', { name: 'How it works' })).toBeVisible()
})

// ─── Help page ─────────────────────────────────────────────────────────────────

test('Help: renders collapsible sections that expand on click', async ({ page }) => {
  await page.goto('help')
  await expect(page.getByRole('heading', { name: 'How it works' })).toBeVisible()
  // Section titles are visible while collapsed; their bodies are hidden until expanded.
  const swapSection = page.getByRole('heading', { name: 'Record a swap' })
  await expect(swapSection).toBeVisible()
  await expect(page.locator('text=Someone outside this app')).toBeHidden()
  // Expanding the section reveals its content.
  await swapSection.click()
  await expect(page.locator('text=Someone outside this app')).toBeVisible()
})

// ─── RecordSwap / swap ────────────────────────────────────────────────────────

test('RecordSwap: page uses Swap wording and outside-app option', async ({ page }) => {
  await page.goto('record-trade')
  await expect(page.locator('h2')).toContainText('Record a swap')
  await expect(page.locator('text=Swapped with')).toBeVisible()
  // The new "Someone outside this app" option exists in the dropdown
  await expect(page.locator('select#traded-with')).toContainText('Someone outside this app')
})

test('RecordSwap: recording an outside swap updates counts and shows success', async ({ page }) => {
  // Receiving BRA1 from someone outside the app should add exactly one copy and create
  // no notification. Reset BRA1 first so the count assertion is exact regardless of history.
  await setCount(page, 'BRA1', 0)
  await page.goto('record-trade')
  await page.selectOption('select#traded-with', { label: 'Someone outside this app' })
  await addSticker(page, 'BRA1', 0) // received panel
  await page.click('button:has-text("Confirm")')
  await expect(page.locator('text=Swap recorded successfully')).toBeVisible()

  await page.goto('my-stickers')
  const row = stickerRow(page, 'BRA1')
  await expect(row.locator('td').nth(2).locator('input')).toHaveValue('1')
  await expect(row.locator('td').nth(3)).toContainText('Collected')
})

test('RecordSwap: giving more than owned shows the live warning before confirm', async ({ page }) => {
  await setCount(page, 'ENG1', 1)
  await page.goto('record-trade')
  await addSticker(page, 'ENG1', 1) // given panel (index 1)
  await addSticker(page, 'ENG1', 1) // giving 2 when only 1 is held
  await expect(page.locator('text=Your current record shows')).toBeVisible()
})

// ─── MyStickers summary line ───────────────────────────────────────────────────

test('MyStickers: All filter shows the collection summary', async ({ page }) => {
  await page.goto('my-stickers')
  await expect(page.locator('text=You have collected')).toBeVisible()
  await expect(page.locator('text=out of')).toBeVisible()
})

test('MyStickers: Duplicates filter shows the duplicates summary', async ({ page }) => {
  await page.goto('my-stickers')
  await page.click('button:has-text("Duplicates")')
  await expect(page.locator('text=You have duplicates for')).toBeVisible()
})

// ─── MyStickers: manual count adjustment ───────────────────────────────────────

test('MyStickers: editing a count inline saves and updates status', async ({ page }) => {
  await setCount(page, 'ENG1', 1)
  await page.goto('my-stickers')
  const row = stickerRow(page, 'ENG1')
  const input = row.locator('input')
  await expect(input).toHaveValue('1')
  await input.fill('3')
  // The inline save is optimistic — the UI shows the new value instantly while the
  // DB write is still in flight. Wait for that write to land before reloading, or
  // page.reload() aborts the pending request and the change never persists.
  const saved = page.waitForResponse(
    (r) => r.url().includes('user_stickers') &&
      ['PATCH', 'POST'].includes(r.request().method()) &&
      r.status() < 300
  )
  await row.getByRole('button', { name: 'Save' }).click()
  await expect(input).toHaveValue('3')
  await expect(row.locator('td').nth(3)).toContainText('Duplicate')
  await saved
  // The new value persists across a reload.
  await page.reload()
  await expect(stickerRow(page, 'ENG1').locator('input')).toHaveValue('3')
})

test('MyStickers: Save button appears only after the count changes', async ({ page }) => {
  await setCount(page, 'ENG1', 1)
  await page.goto('my-stickers')
  const row = stickerRow(page, 'ENG1')
  // No pending change → no Save button.
  await expect(row.getByRole('button', { name: 'Save' })).toHaveCount(0)
  await row.locator('input').fill('2')
  await expect(row.getByRole('button', { name: 'Save' })).toBeVisible()
})

test('MyStickers: setting a count to 0 inline marks it Missing', async ({ page }) => {
  await setCount(page, 'ENG1', 2)
  await page.goto('my-stickers')
  const row = stickerRow(page, 'ENG1')
  await row.locator('input').fill('0')
  await row.getByRole('button', { name: 'Save' }).click()
  await expect(row.locator('input')).toHaveValue('0')
  await expect(row.locator('td').nth(3)).toContainText('Missing')
})

// ─── MyStickers: Collected filter (count >= 1) ─────────────────────────────────

test('MyStickers: Collected filter includes duplicates', async ({ page }) => {
  await setCount(page, 'ENG1', 2) // a duplicate is still "collected"
  await page.goto('my-stickers')
  await page.click('button:has-text("Collected")')
  await expect(stickerRow(page, 'ENG1')).toBeVisible()
})

test('MyStickers: Collected filter button is labelled just "Collected"', async ({ page }) => {
  await page.goto('my-stickers')
  await expect(page.getByRole('button', { name: 'Collected', exact: true })).toBeVisible()
  await expect(page.locator('text=Have 1 copy')).toHaveCount(0)
})

// ─── MyStickers: Last changed column + Recently changed sort ───────────────────

test('MyStickers: Last changed column updates after an edit', async ({ page }) => {
  await setCount(page, 'ENG1', 1)
  await page.goto('my-stickers')
  const row = stickerRow(page, 'ENG1')
  await row.locator('input').fill('2')
  await row.getByRole('button', { name: 'Save' }).click()
  // Last changed is the 5th column (index 4); the DB trigger stamps it to ~now and
  // it arrives over the realtime subscription.
  await expect(row.locator('td').nth(4)).toContainText(/just now|seconds ago|minute/, { timeout: 10000 })
})

test('MyStickers: Recently changed sort floats the latest edit to the top', async ({ page }) => {
  await setCount(page, 'ENG1', 1)
  await page.goto('my-stickers')
  const row = stickerRow(page, 'ENG1')
  await row.locator('input').fill('4')
  await row.getByRole('button', { name: 'Save' }).click()
  // Wait for the fresh timestamp to land so the sort key is up to date.
  await expect(row.locator('td').nth(4)).toContainText(/just now|seconds ago/, { timeout: 10000 })
  await page.click('button:has-text("Recently changed")')
  // ENG1 was edited last, so it should be the first row under the recency sort.
  await expect(page.locator('tbody tr').first().locator('td').nth(0)).toHaveText('ENG1')
})
