// Logs in once and saves the session for the desktop and mobile projects.
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { expect } from '@playwright/test'
import { ADMIN_EMAIL, ADMIN_PASSWORD, AUTH_FILE } from '../playwright.config.mjs'
import { login, test as setup } from './helpers.mjs'

setup('log in as the test admin', async ({ page }) => {
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await expect(page).toHaveURL(/\/admin$/)
  mkdirSync(dirname(AUTH_FILE), { recursive: true })
  await page.context().storageState({ path: AUTH_FILE })
})
