import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { test as base, expect } from '@playwright/test'
import { DATA_DIR } from '../playwright.config.mjs'

export async function login(page, email, password) {
  await page.goto('/admin/login')
  await page.getByLabel('อีเมล').fill(email)
  await page.getByLabel('รหัสผ่าน').fill(password)
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click()
}

// Collects console errors and uncaught page errors (CSP violations are console errors).
export function watchErrors(page) {
  const errors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`${page.url()} console: ${msg.text()} [${msg.location().url}]`)
  })
  page.on('pageerror', (err) => errors.push(`${page.url()} pageerror: ${err.message}`))
  return errors
}

const GOOGLE_FONTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//

// Every test fails on console errors or page errors (CSP violations included).
// A describe block can allow known ones with test.use({ allowedErrors: [/pattern/] }).
export const test = base.extend({
  allowedErrors: [[], { option: true }],
  consoleErrors: [async ({ page, allowedErrors }, use) => {
    // Google Fonts is outside our control: when it hangs, the page's load event never fires.
    // Give it 8s, then drop it; a missing web font is not an admin bug.
    await page.route(GOOGLE_FONTS, async (route) => {
      try { await route.fulfill({ response: await route.fetch({ timeout: 8_000 }) }) } catch { await route.abort() }
    })
    allowedErrors = [...allowedErrors, /fonts\.(googleapis|gstatic)\.com/]
    const errors = watchErrors(page)
    await use(errors)
    expect(errors.filter((e) => !allowedErrors.some((re) => re.test(e))), 'console errors').toEqual([])
  }, { auto: true }],
})

// What the dashboard should show, read straight from the throwaway database.
export function expectedCounts() {
  const db = new DatabaseSync(join(DATA_DIR, 'site.db'), { readOnly: true })
  try {
    const n = (sql) => db.prepare(sql).get().n
    const projects = n('SELECT COUNT(*) AS n FROM projects')
    return {
      'ผลงานทั้งหมด': projects,
      'แสดงบนเว็บ': n('SELECT COUNT(*) AS n FROM projects WHERE published = 1'),
      'รูปทั้งหมด': n('SELECT COUNT(*) AS n FROM site_images') + projects + n('SELECT COUNT(*) AS n FROM project_images'),
      'ช่องทางติดต่อ': n("SELECT COUNT(*) AS n FROM settings WHERE key IN ('line','facebook','tiktok') AND value <> ''"),
    }
  } finally {
    db.close()
  }
}

export const KPI_LABELS = ['ผลงานทั้งหมด', 'แสดงบนเว็บ', 'รูปทั้งหมด', 'ช่องทางติดต่อ']

export const kpiSection = (page) => page.locator('section[aria-label="สรุป"]')

// The innermost element that holds both the label and its number.
export const kpiCard = (page, label) => kpiSection(page).locator('*')
  .filter({ hasText: label }).filter({ has: page.locator('strong[data-count]') }).last()

// Waits until the count-up has landed on data-count, then returns the number.
export async function kpiValue(page, label) {
  const strong = kpiCard(page, label).locator('strong[data-count]')
  const target = await strong.getAttribute('data-count')
  await expect(strong).toHaveText(target)
  return Number(target)
}
