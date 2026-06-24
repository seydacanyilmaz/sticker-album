// swap-notification.spec.js
// Two-user end-to-end test for the swap notification "See details" review modal.
//
// User 1 records a swap with User 2, then User 2 reviews and accepts it.
// Requires a second test account in .env.test:
//   TEST_EMAIL_B=...
//   TEST_PASSWORD_B=...
//
// Idempotent: before recording, User 2's slate is cleaned (pending notifications
// dismissed, ENG7 reset to 0) so the count assertion is exact on every re-run.
// Uses fresh browser contexts so each page logs in as a specific user.

import { test, expect } from '@playwright/test'
import { addSticker, stickerRow, resetToZero } from './helpers'

// Log in on a clean page and return the logged-in user's username (from the welcome header).
// The dashboard heading renders as "Welcome," for a moment before the profile loads, so we
// wait for a non-empty username to avoid reading "" (which would break later selectOption).
async function login(page, email, password) {
  await page.goto('.')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button:has-text("Sign in")')
  const heading = page.locator('h1', { hasText: 'Welcome,' })
  await expect(heading).toHaveText(/Welcome,\s+\S+/, { timeout: 15000 })
  return (await heading.innerText()).replace('Welcome,', '').trim()
}

// Dismiss every pending swap notification currently showing on the dashboard.
async function dismissAllNotifications(page) {
  await page.goto('.')
  const dismiss = page.locator('.bg-amber-50 button:has-text("Dismiss")')
  while ((await dismiss.count()) > 0) {
    await dismiss.first().click()
    await page.waitForTimeout(300)
  }
}

test('Swap notification: User 2 can review a swap in the See details modal and accept it', async ({ browser }) => {
  // Two logins + state reset + the full swap round-trip is more than the 30s default.
  test.setTimeout(120000)

  const emailA = process.env.TEST_EMAIL
  const passA = process.env.TEST_PASSWORD
  const emailB = process.env.TEST_EMAIL_B
  const passB = process.env.TEST_PASSWORD_B

  test.skip(!emailB || !passB, 'Set TEST_EMAIL_B / TEST_PASSWORD_B in .env.test to run the two-user test')

  // Fresh, independent sessions for each user.
  const ctxA = await browser.newContext({ storageState: undefined })
  const ctxB = await browser.newContext({ storageState: undefined })
  const pageA = await ctxA.newPage()
  const pageB = await ctxB.newPage()

  try {
    const nameA = await login(pageA, emailA, passA)
    const nameB = await login(pageB, emailB, passB)

    // Clean User 2's slate so the run is repeatable.
    await dismissAllNotifications(pageB)
    await resetToZero(pageB, 'ENG7')

    // User 1 records a swap WITH User 2:
    //   User 1 gives ENG7    -> User 2 receives ENG7
    //   User 1 receives ENG8 -> User 2 gives ENG8
    await pageA.goto('record-trade')
    await pageA.selectOption('select#traded-with', { label: nameB })
    await addSticker(pageA, 'ENG8', 0) // received by User 1
    await addSticker(pageA, 'ENG7', 1) // given by User 1
    await pageA.click('button:has-text("Confirm")')
    await expect(pageA.locator('text=Swap recorded successfully')).toBeVisible()

    // User 2 sees the pending notification from User 1.
    await pageB.goto('.')
    const banner = pageB.locator('.bg-amber-50', { hasText: nameA })
    await expect(banner.first()).toBeVisible()

    // Open the See details modal and review the swap.
    await banner.first().getByRole('button', { name: 'See details' }).click()
    const modal = pageB.locator('div.fixed.inset-0', { hasText: 'Swap recorded by' })
    await expect(modal).toBeVisible()
    await expect(modal.locator('h3')).toContainText(nameA)
    // From User 2's perspective: receives ENG7, gives ENG8.
    await expect(modal).toContainText('ENG7')
    await expect(modal).toContainText('ENG8')

    // Accept from within the modal — it should close and the banner should disappear.
    await modal.getByRole('button', { name: 'Accept' }).click()
    await expect(modal).not.toBeVisible()

    // User 2's ENG7 count went up by exactly 1 (received), from the reset baseline of 0.
    await pageB.goto('my-stickers')
    const row = stickerRow(pageB, 'ENG7')
    // Count cell is an inline editor since Phase 11 — read the input value, not cell text.
    await expect(row.locator('td').nth(2).locator('input')).toHaveValue('1')
    await expect(row.locator('td').nth(3)).toContainText('Collected')
  } finally {
    await ctxA.close()
    await ctxB.close()
  }
})
