import { mkdirSync } from 'node:fs'
import { expect } from '@playwright/test'
import { ADMIN_EMAIL, ADMIN_PASSWORD } from '../playwright.config.mjs'
import { expectedCounts, KPI_LABELS, kpiCard, kpiSection, kpiValue, login, test } from './helpers.mjs'

const SCREENSHOT_DIR = 'e2e/screenshots'
const SECTION_LINKS = ['/admin/s/hero', '/admin/s/about', '/admin/s/mission', '/admin/s/services', '/admin/s/brand', '/admin/contact']
const MENU = (page) => page.getByRole('navigation', { name: 'เมนูแอดมิน' }).getByRole('link')

test.describe('dashboard', () => {
  test('header, title and actions', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ภาพรวม')
    await expect(page.getByRole('main').getByRole('link', { name: 'เพิ่มผลงาน' })).toHaveAttribute('href', '/admin/projects/new')
    await expect(page.getByRole('main').getByRole('link', { name: 'ดูเว็บ' })).toBeVisible()
  })

  test('KPI cards are in order and match the database', async ({ page }) => {
    await page.goto('/admin')
    const section = kpiSection(page)
    await expect(section.locator('strong[data-count]')).toHaveCount(4)
    const text = await section.innerText()
    const positions = KPI_LABELS.map((label) => text.indexOf(label))
    expect(positions.every((p) => p >= 0), `labels in: ${text}`).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))

    const expected = expectedCounts()
    for (const label of KPI_LABELS) expect(await kpiValue(page, label), label).toBe(expected[label])
    await expect(kpiCard(page, 'ช่องทางติดต่อ')).toContainText(new RegExp(`${expected['ช่องทางติดต่อ']}\\s*/\\s*3`))
  })

  test('publish switch flips and the KPI follows', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByRole('heading', { level: 2, name: 'ผลงาน', exact: true })).toBeVisible()
    const switches = page.getByRole('switch', { name: /^แสดง .+ บนเว็บ$/ })
    expect(await switches.count()).toBeGreaterThan(0)

    const name = await switches.first().getAttribute('aria-label')
    const toggle = page.getByRole('switch', { name, exact: true })
    const before = await toggle.getAttribute('aria-checked')
    const shownBefore = await kpiValue(page, 'แสดงบนเว็บ')

    await toggle.click()
    await page.waitForLoadState('load')
    await expect(toggle).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true')
    expect(await kpiValue(page, 'แสดงบนเว็บ')).toBe(shownBefore + (before === 'true' ? -1 : 1))

    // Put it back.
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', before)
    expect(await kpiValue(page, 'แสดงบนเว็บ')).toBe(shownBefore)
  })

  test('page sections link to each editor', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByRole('heading', { level: 2, name: 'ส่วนของหน้าเว็บ' })).toBeVisible()
    const hrefs = await page.getByRole('main').getByRole('link').evaluateAll((links) => links.map((a) => a.getAttribute('href')))
    for (const href of SECTION_LINKS) expect(hrefs, href).toContain(href)
  })

  test('reduced motion: numbers are final at once, no long animations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/admin')
    const counts = await kpiSection(page).locator('strong[data-count]')
      .evaluateAll((els) => els.map((el) => [el.textContent.trim(), el.dataset.count]))
    for (const [shown, target] of counts) expect(shown).toBe(target)
    const long = await page.evaluate(() => document.getAnimations()
      .filter((a) => a.playState === 'running')
      .map((a) => ({ name: a.animationName ?? a.constructor.name, ms: a.effect?.getComputedTiming().duration }))
      .filter((a) => typeof a.ms !== 'number' || a.ms > 10))
    expect(long).toEqual([])
  })
})

// Console errors are checked on every test by the fixture in helpers.mjs.
test('every menu link opens a page with an h1', async ({ page }) => {
  await page.goto('/admin')
  const hrefs = await MENU(page).evaluateAll((links) => links.map((a) => a.getAttribute('href')))
  expect(hrefs.length).toBeGreaterThan(0)
  for (const href of [...hrefs, '/admin/projects/new']) {
    const response = await page.goto(href)
    expect(response.status(), href).toBe(200)
    await expect(page.getByRole('heading', { level: 1 }), href).toBeVisible()
  }
})

test('no horizontal scroll at phone width', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile only')
  for (const path of ['/admin', '/admin/projects', '/admin/s/hero', '/admin/contact', '/admin/projects/new']) {
    await page.goto(path)
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth }))
    expect(scrollWidth, path).toBeLessThanOrEqual(innerWidth)
  }
})

test('screenshots for review', async ({ page }, testInfo) => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true })
  for (const [path, name] of [['/admin', 'dashboard'], ['/admin/projects', 'projects'], ['/admin/s/hero', 'hero']]) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
    // Let any count-up finish before the shot.
    for (const el of await page.locator('strong[data-count]').all()) await expect(el).toHaveText(await el.getAttribute('data-count'))
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}-${testInfo.project.name}.png`, fullPage: true })
  }
})

test.describe('login', () => {
  // The browser logs the 401 response of a failed login as a console error.
  test.use({ storageState: { cookies: [], origins: [] }, allowedErrors: [/status of 401/] })

  test('wrong password shows an error', async ({ page }) => {
    await login(page, ADMIN_EMAIL, 'not-the-password-123')
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('button', { name: 'เข้าสู่ระบบ' })).toBeVisible()
  })

  // Uses its own session so the shared one stays valid.
  test('log in, then log out back to the login page', async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ภาพรวม')
    await page.getByRole('button', { name: /ออก/ }).click()
    await expect(page).toHaveURL(/\/admin\/login$/)
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/login$/)
  })
})
