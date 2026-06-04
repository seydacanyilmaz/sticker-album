import { test as setup } from '@playwright/test'
import { mkdir } from 'fs/promises'

setup('authenticate', async ({ page }) => {
  await mkdir('playwright/.auth', { recursive: true })

  await page.goto('.')
  await page.fill('input[type="email"]', process.env.TEST_EMAIL)
  await page.fill('input[type="password"]', process.env.TEST_PASSWORD)
  await page.click('button:has-text("Sign in")')

  // Wait until the dashboard heading appears — confirms login succeeded
  await page.waitForSelector('h1:has-text("Welcome")', { timeout: 15000 })

  await page.context().storageState({ path: 'playwright/.auth/user.json' })
})
