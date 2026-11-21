import { mkdirSync } from 'node:fs'
import { expect } from '@playwright/test'
import { test } from './helpers.mjs'

const SHOTS = 'e2e/screenshots'
const TOGGLE = 'button.theme-toggle[aria-label="สลับโหมดมืด"]'
const ADMIN_PAGES = ['/admin', '/admin/projects', '/admin/s/hero', '/admin/contact', '/admin/projects/new', '/admin/projects/1']
const RAIL = [['ภาพรวม', '/admin'], ['Hero', '/admin/s/hero'], ['เกี่ยวกับ', '/admin/s/about'], ['พันธกิจ', '/admin/s/mission'], ['บริการ', '/admin/s/services'], ['ทีมงาน', '/admin/s/brand'], ['ผลงาน', '/admin/projects'], ['ติดต่อ', '/admin/contact'], ['ดูเว็บ', null], ['ออก', null]]
const dataTheme = (page) => page.evaluate(() => document.documentElement.dataset.theme)
const isMobile = (page) => (page.viewportSize()?.width ?? 1280) < 600

// Shared in-page helpers: normalise any CSS colour to [r,g,b,a] via canvas, WCAG maths.
const COLOR_LIB = `
  window.__rgba = (css) => { const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d', { willReadFrequently: true });
    x.clearRect(0,0,1,1); x.fillStyle = css; x.fillRect(0,0,1,1); const d = x.getImageData(0,0,1,1).data; return [d[0], d[1], d[2], d[3] / 255] };
  window.__lum = ([r,g,b]) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }; return .2126*f(r) + .7152*f(g) + .0722*f(b) };
  window.__bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = window.__rgba(getComputedStyle(e).backgroundColor); if (c[3] > .95) return c } return window.__rgba('#fff') };
  window.__contrast = (a, b) => { const [x, y] = [window.__lum(a), window.__lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05) };
`
const lib = (page) => page.evaluate(COLOR_LIB)

async function ensureToggle(page) {
  const t = page.locator(TOGGLE).first()
  if (isMobile(page)) await t.scrollIntoViewIfNeeded()
  return t
}
const setTheme = (page, theme) => page.evaluate((t) => localStorage.setItem('theme', t), theme)

test.describe('theme: detection and persistence', () => {
  for (const scheme of ['dark', 'light']) {
    test.describe(`system ${scheme}`, () => {
      test.use({ colorScheme: scheme })
      test(`/admin with empty storage is ${scheme}`, async ({ page }) => {
        await page.goto('/admin')
        expect(await page.evaluate(() => localStorage.getItem('theme'))).toBeNull()
        expect(await dataTheme(page)).toBe(scheme)
      })
    })
  }

  test('data-theme is light or dark on every admin page', async ({ page }) => {
    for (const url of ADMIN_PAGES) {
      await page.goto(url)
      expect(['light', 'dark'], url).toContain(await dataTheme(page))
    }
  })

  test.describe('toggle', () => {
    test.use({ colorScheme: 'light' })
    test('exists, flips, persists and overrides system scheme', async ({ page }) => {
      await page.goto('/admin')
      const t = await ensureToggle(page)
      await expect(t).toBeVisible()
      await expect(t).toHaveAttribute('aria-pressed', 'false')
      await t.click()
      expect(await dataTheme(page)).toBe('dark')
      await expect(t).toHaveAttribute('aria-pressed', 'true')
      expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark')

      await page.reload()
      expect(await dataTheme(page)).toBe('dark')
      const t2 = await ensureToggle(page)
      await expect(t2).toHaveAttribute('aria-pressed', 'true')
      await t2.click()
      expect(await dataTheme(page)).toBe('light')
      await expect(t2).toHaveAttribute('aria-pressed', 'false')
      await page.reload()
      expect(await dataTheme(page)).toBe('light')
    })
  })

  test.describe('stored choice beats system', () => {
    test.use({ colorScheme: 'dark' })
    test('stored light on a dark system stays light', async ({ page }) => {
      await page.goto('/admin')
      await setTheme(page, 'light')
      await page.reload()
      expect(await dataTheme(page)).toBe('light')
      await expect(await ensureToggle(page)).toHaveAttribute('aria-pressed', 'false')
    })
  })

  test.describe('no flash', () => {
    test.use({ colorScheme: 'light' })
    test('theme set at domcontentloaded; blocking /assets/theme.js in head', async ({ page }) => {
      await page.goto('/admin')
      await setTheme(page, 'dark')
      const seen = []
      await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { window.__dclTheme = document.documentElement.dataset.theme }))
      const resp = page.waitForResponse((r) => r.url().includes('/assets/theme.js'))
      await page.reload({ waitUntil: 'domcontentloaded' })
      seen.push(await page.evaluate(() => window.__dclTheme))
      expect(seen[0]).toBe('dark')
      expect((await resp).status()).toBe(200)
      const attrs = await page.evaluate(() => { const s = document.head.querySelector('script[src*="/assets/theme.js"]'); return s && { defer: s.defer, async: s.async, module: s.type === 'module' } })
      expect(attrs, 'theme.js script in <head>').not.toBeNull()
      expect(attrs).toEqual({ defer: false, async: false, module: false })
    })
  })
})

test.describe('theme: colours', () => {
  for (const theme of ['light', 'dark']) {
    test(`${theme}: body luminance, heading and primary button contrast`, async ({ page }) => {
      await page.goto('/admin')
      await setTheme(page, theme)
      await page.goto('/admin')
      expect(await dataTheme(page)).toBe(theme)
      await lib(page)
      const lum = await page.evaluate(() => window.__lum(window.__bgOf(document.body)))
      if (theme === 'dark') expect(lum, 'body luminance').toBeLessThan(0.2)
      else expect(lum, 'body luminance').toBeGreaterThan(0.8)

      const h = await page.evaluate(() => [...document.querySelectorAll('main h1, main h2')].map((el) => {
        const c = window.__rgba(getComputedStyle(el).color); return window.__contrast(c, window.__bgOf(el)) }))
      expect(h.length).toBeGreaterThan(0)
      for (const r of h) expect(r, 'heading contrast').toBeGreaterThanOrEqual(4.5)

      await page.goto('/admin/projects/new')
      await lib(page)
      const btn = page.getByRole('main').getByRole('button', { name: 'บันทึก', exact: true }).first()
      await expect(btn).toBeVisible()
      const r = await btn.evaluate((el) => window.__contrast(window.__rgba(getComputedStyle(el).color), window.__rgba(getComputedStyle(el).backgroundColor)))
      expect(r, 'primary button text vs bg').toBeGreaterThanOrEqual(4.5)
      const card = await btn.evaluate((el) => { const bg = window.__rgba(getComputedStyle(el).backgroundColor); let p = el.parentElement; return window.__contrast(bg, window.__bgOf(p)) })
      expect(card, 'primary button bg vs surrounding (non-text, informational)').toBeGreaterThan(1)
    })

    test(`${theme}: active sidebar item is distinct from idle items (tint, weight, bar, aria-current)`, async ({ page }) => {
      await page.goto('/admin')
      await setTheme(page, theme)
      await page.goto('/admin/projects')
      await lib(page)
      const nav = page.getByRole('navigation', { name: 'เมนูแอดมิน' })
      const active = nav.locator('a[aria-current="page"]')
      await expect(active).toHaveCount(1)
      await expect(active).toHaveText('ผลงาน')
      const idle = nav.getByRole('link', { name: 'Hero', exact: true })
      const read = (loc) => loc.evaluate((el) => {
        const cs = getComputedStyle(el)
        const bar = getComputedStyle(el, '::before')
        return {
          weight: Number(cs.fontWeight), bg: cs.backgroundColor, bar: bar.content !== 'none' && bar.content !== 'normal' && parseFloat(bar.width) >= 3,
          labelContrast: window.__contrast(window.__rgba(cs.color), window.__bgOf(el)),
        }
      })
      const on = await read(active)
      const off = await read(idle)
      expect(on.bar, 'active left bar').toBe(true)
      expect(off.bar, 'idle has no bar').toBe(false)
      expect(on.bg, 'active tint differs from idle').not.toBe(off.bg)
      expect(on.weight, 'active label is bolder').toBeGreaterThan(off.weight)
      expect(on.labelContrast, 'active label contrast').toBeGreaterThanOrEqual(4.5)
      expect(off.labelContrast, 'idle label contrast').toBeGreaterThanOrEqual(4.5)
    })

    test(`${theme}: publish switch differs from primary`, async ({ page }) => {
      await page.goto('/admin')
      await setTheme(page, theme)
      await page.goto('/admin')
      await lib(page)
      const sw = page.getByRole('switch').first()
      await expect(sw).toBeVisible()
      const name = await sw.getAttribute('aria-label')
      const exact = page.getByRole('switch', { name, exact: true })
      mkdirSync(SHOTS, { recursive: true })
      const shotName = (s) => `${SHOTS}/switch-${s}-${theme}-${isMobile(page) ? 'mobile' : 'desktop'}.png`
      // Make sure we look at both states, restoring the original at the end.
      const start = await exact.getAttribute('aria-checked')
      const flip = async () => { await exact.click(); await page.waitForLoadState('load'); await page.waitForTimeout(350) }
      if (start !== 'true') await flip()
      await expect(exact).toHaveAttribute('aria-checked', 'true')
      await exact.screenshot({ path: shotName('on') })
      const cols = await exact.evaluate((el) => {
        const probe = document.createElement('button'); probe.className = 'button'; document.body.append(probe)
        const primary = getComputedStyle(probe).backgroundColor; probe.remove()
        return { sw: getComputedStyle(el).backgroundColor, border: getComputedStyle(el).borderColor, primary }
      })
      expect(cols.sw, 'checked switch bg vs primary button bg').not.toBe(cols.primary)
      await flip()
      await expect(exact).toHaveAttribute('aria-checked', 'false')
      await exact.screenshot({ path: shotName('off') })
      if (start === 'true') await flip()
    })
  }
})

test.describe('rail', () => {
  test('links keep Thai labels and hrefs; icons visible and >= 20px', async ({ page }) => {
    await page.goto('/admin')
    const nav = page.locator('aside.side')
    for (const [label, href] of RAIL) {
      const a = href || label === 'ดูเว็บ' ? nav.getByRole('link', { name: label, exact: true }) : nav.getByRole('button', { name: label, exact: true })
      await expect(a, label).toHaveCount(1)
      if (href) await expect(a, label).toHaveAttribute('href', href)
      if (isMobile(page)) await a.scrollIntoViewIfNeeded()
      const svg = a.locator('svg').filter({ visible: true }).first()
      await expect(svg, `${label} icon`).toBeVisible()
      const box = await svg.boundingBox()
      expect(box.width, `${label} icon width`).toBeGreaterThanOrEqual(20)
    }
  })
})

test.describe('dark mode health', () => {
  test.use({ colorScheme: 'dark' })
  for (const url of ADMIN_PAGES) {
    test(`no console errors, no overflow: ${url}`, async ({ page }) => {
      await page.goto(url)
      expect(await dataTheme(page)).toBe('dark')
      await page.waitForLoadState('load')
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      if (isMobile(page)) expect(over, 'horizontal overflow at 375px').toBeLessThanOrEqual(0)
    })
  }

  test.describe('login page', () => {
    test.use({ storageState: { cookies: [], origins: [] } })
    test('dark, no console errors, no overflow', async ({ page }) => {
      await page.goto('/admin/login')
      expect(await dataTheme(page)).toBe('dark')
      await page.waitForLoadState('load')
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      if (isMobile(page)) expect(over).toBeLessThanOrEqual(0)
    })
  })
})

test.describe('theme screenshots', () => {
  const SHOT_PAGES = [['admin', '/admin'], ['projects', '/admin/projects'], ['contact', '/admin/contact'], ['project-1', '/admin/projects/1']]
  for (const theme of ['light', 'dark']) {
    test(`${theme}: screenshots`, async ({ page }) => {
      mkdirSync(SHOTS, { recursive: true })
      const size = isMobile(page) ? 'mobile' : 'desktop'
      await page.goto('/admin')
      await setTheme(page, theme)
      for (const [name, url] of SHOT_PAGES) {
        await page.goto(url)
        await page.waitForLoadState('load')
        await page.screenshot({ path: `${SHOTS}/${name}-${theme}-${size}.png`, fullPage: true })
      }
    })
    test.describe(`login ${theme}`, () => {
      test.use({ storageState: { cookies: [], origins: [] } })
      test(`${theme}: login screenshot`, async ({ page }) => {
        await page.goto('/admin/login')
        await setTheme(page, theme)
        await page.reload()
        await page.screenshot({ path: `${SHOTS}/login-${theme}-${isMobile(page) ? 'mobile' : 'desktop'}.png`, fullPage: true })
      })
    })
  }
})
