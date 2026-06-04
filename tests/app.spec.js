import { test, expect } from '@playwright/test'

// Helper: type the code into StickerPicker and click the exact suggestion button
async function addSticker(page, code) {
  const input = page.locator('input[placeholder*="sticker code"]').first()
  await input.click()
  await input.pressSequentially(code, { delay: 30 })
  // getByRole with exact:true matches only the button whose accessible name is exactly `code`
  await page.getByRole('button', { name: code, exact: true }).first().click()
}

// Helper: get a MyStickers table row that starts with exactly `code` (not ENG10 when looking for ENG1)
function stickerRow(page, code) {
  return page.getByRole('row', { name: new RegExp(`^${code}\\s`) })
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

test('dashboard shows welcome message', async ({ page }) => {
  await page.goto('.')
  await expect(page.locator('h1')).toContainText('Welcome')
})

test('dashboard has navigation links', async ({ page }) => {
  await page.goto('.')
  await expect(page.getByRole('link', { name: 'Record new stickers' }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Record a trade' }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Record donated stickers' }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'My Stickers' }).first()).toBeVisible()
})

// ─── RecordNew ───────────────────────────────────────────────────────────────

test('RecordNew: adds a new sticker and shows it in summary', async ({ page }) => {
  await page.goto('record-new')
  await addSticker(page, 'ENG1')
  await page.click('button:has-text("Confirm")')
  await expect(page.locator('text=Added to album')).toBeVisible()
  await expect(page.locator('text=ENG1')).toBeVisible()
})

test('RecordNew: adding same sticker twice shows one new and one duplicate', async ({ page }) => {
  await page.goto('record-new')
  await addSticker(page, 'ENG2')
  await addSticker(page, 'ENG2')
  await page.click('button:has-text("Confirm")')
  await expect(page.locator('text=Added to album')).toBeVisible()
  await expect(page.locator('text=Duplicates')).toBeVisible()
})

test('RecordNew: recording an already-collected sticker shows it as duplicate', async ({ page }) => {
  // ENG1 was added in the previous test (count=1), adding again → all duplicates
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

// ─── MyStickers ──────────────────────────────────────────────────────────────

test('MyStickers: shows ENG1 with correct count and status', async ({ page }) => {
  await page.goto('my-stickers')
  // ENG1 has count 2 (added once, then added again above)
  const row = stickerRow(page, 'ENG1')
  await expect(row).toBeVisible()
  await expect(row.locator('td').nth(2)).toContainText('2')
  await expect(row.locator('td').nth(3)).toContainText('Duplicate')
})

test('MyStickers: Duplicates filter shows ENG1', async ({ page }) => {
  await page.goto('my-stickers')
  await page.click('button:has-text("Duplicates")')
  await expect(stickerRow(page, 'ENG1')).toBeVisible()
})

test('MyStickers: Missing filter hides ENG1', async ({ page }) => {
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
  // ENG1 has count 2 — donate one, goes to 1
  await page.goto('record-donated')
  await addSticker(page, 'ENG1')
  await page.click('button:has-text("Confirm")')
  await expect(page.locator('text=Stickers recorded successfully')).toBeVisible()
})

test('RecordDonated: donating count=1 sticker shows warning chip', async ({ page }) => {
  // ENG1 now has count 1 — selecting it should show the ⚠️ warning
  await page.goto('record-donated')
  await addSticker(page, 'ENG1')
  await expect(page.locator('span[title*="1 copy"]')).toBeVisible()
})

test('RecordDonated: donating more than available shows naughty message', async ({ page }) => {
  // ENG1 has count 1 — donate twice → clamped to 0
  await page.goto('record-donated')
  await addSticker(page, 'ENG1')
  await addSticker(page, 'ENG1')
  await page.click('button:has-text("Confirm")')
  await expect(page.locator('text=naughty')).toBeVisible()
})

test('RecordDonated: donating sticker with no record shows naughty message', async ({ page }) => {
  // FWC1 has never been recorded — donating it should warn
  await page.goto('record-donated')
  await addSticker(page, 'FWC1')
  await page.click('button:has-text("Confirm")')
  await expect(page.locator('text=naughty')).toBeVisible()
})

// ─── MyStickers (post-donate) ─────────────────────────────────────────────────

test('MyStickers: ENG1 shows count 0 and Missing after donations', async ({ page }) => {
  await page.goto('my-stickers')
  const row = stickerRow(page, 'ENG1')
  await expect(row.locator('td').nth(2)).toContainText('0')
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
