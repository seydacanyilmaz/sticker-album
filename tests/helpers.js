// helpers.js
// Shared test helpers. The key idea: tests never assume a clean database — instead
// each test drives the stickers it cares about to a known count using the app's own
// Record/Donate flows. This makes every test idempotent and order-independent, with
// no direct DB access and no risk of deleting real data.

import { expect } from '@playwright/test'

// Type a code into a StickerPicker and click the exact suggestion.
// panelIndex 0 = first picker (e.g. "received"), 1 = second picker (e.g. "given").
export async function addSticker(page, code, panelIndex = 0) {
  const input = page.locator('input[placeholder*="sticker code"]').nth(panelIndex)
  await input.click()
  await input.pressSequentially(code, { delay: 30 })
  await page.getByRole('button', { name: code, exact: true }).first().click()
}

// A MyStickers table row that starts with exactly `code` (ENG1, not ENG10).
export function stickerRow(page, code) {
  return page.getByRole('row', { name: new RegExp(`^${code}\\s`) })
}

// Read the current count for a sticker from the MyStickers table.
// The Count column is an editable number input, so read its value (not cell text).
export async function getCount(page, code) {
  await page.goto('my-stickers')
  const row = stickerRow(page, code)
  await row.waitFor({ state: 'attached' })
  const txt = await row.locator('td').nth(2).locator('input').inputValue()
  return parseInt(txt, 10) || 0
}

// Drive a sticker's count down to exactly 0 by donating exactly however many the
// user currently has (so no over-donate "naughty" clamp is triggered).
export async function resetToZero(page, code) {
  const count = await getCount(page, code)
  if (count <= 0) return
  await page.goto('record-donated')
  for (let i = 0; i < count; i++) await addSticker(page, code)
  await page.click('button:has-text("Confirm")')
  await expect(page.locator('text=Stickers recorded successfully')).toBeVisible()
}

// Set a sticker's count to an exact target value (reset to 0, then record `target`).
export async function setCount(page, code, target) {
  await resetToZero(page, code)
  if (target <= 0) return
  await page.goto('record-new')
  for (let i = 0; i < target; i++) await addSticker(page, code)
  await page.click('button:has-text("Confirm")')
  await expect(page.locator('text=Added to album')).toBeVisible()
}
