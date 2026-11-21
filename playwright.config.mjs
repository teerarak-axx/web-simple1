// E2E tests for the admin: npm run test:e2e
// The server runs on its own port with a throwaway DATA_DIR, seeded demo data and a test admin.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig, devices } from '@playwright/test'

export const PORT = 8091
export const ADMIN_EMAIL = 'e2e@test.example'
export const ADMIN_PASSWORD = 'e2e-password-1234'
export const AUTH_FILE = 'e2e/.auth/admin.json'

// Set once in the runner; workers inherit it, so specs can open the same database.
process.env.E2E_DATA_DIR ||= mkdtempSync(join(tmpdir(), 'web-simple1-e2e-'))
export const DATA_DIR = process.env.E2E_DATA_DIR

const env = { DATA_DIR, PORT: String(PORT), ADMIN_EMAIL, ADMIN_PASSWORD }

export default defineConfig({
  testDir: 'e2e',
  // One worker: desktop and mobile toggle the same project and read the same counts.
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.mjs$/, use: { ...devices['Desktop Chrome'] } },
    {
      name: 'desktop',
      dependencies: ['setup'],
      testMatch: /.*\.spec\.mjs$/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, storageState: AUTH_FILE },
    },
    {
      name: 'mobile',
      dependencies: ['setup'],
      testMatch: /.*\.spec\.mjs$/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, storageState: AUTH_FILE },
    },
  ],
  webServer: {
    command: 'node seed/seed.mjs && node scripts/admin.mjs && node server.mjs',
    env,
    url: `http://localhost:${PORT}/admin/login`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
