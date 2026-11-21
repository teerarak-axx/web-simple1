// The admin sidebar: a vertical list of horizontal rows (desktop) and a scrolling bottom bar (mobile).
import { mkdirSync } from 'node:fs'
import { expect } from '@playwright/test'
import { ADMIN_EMAIL, ADMIN_PASSWORD } from '../playwright.config.mjs'
import { test } from './helpers.mjs'

const SHOTS = 'e2e/screenshots'
const COVER = 'seed/images/about-plant-nursery.jpg'
const LABELS = ['ภาพรวม', 'Hero', 'เกี่ยวกับ', 'พันธกิจ', 'บริการ', 'ทีมงาน', 'ผลงาน', 'ติดต่อ', 'โหมดมืด', 'ดูเว็บ', 'ออก']
const HREFS = ['/admin', '/admin/s/hero', '/admin/s/about', '/admin/s/mission', '/admin/s/services', '/admin/s/brand', '/admin/projects', '/admin/contact']
const HEADINGS = ['หลัก', 'เนื้อหาเว็บ', 'จัดการ', 'ระบบ']
const isMobile = (page) => (page.viewportSize()?.width ?? 1280) < 761
const size = (page) => (isMobile(page) ? 'mobile' : 'desktop')
const setTheme = (page, t) => page.evaluate((v) => localStorage.setItem('theme', v), t)
const side = (page) => page.locator('aside.side')
const items = (page) => side(page).locator('a, button')
const itemOf = (page, label) => items(page).filter({ hasText: label }).first()
const skipOnMobile = (info) => test.skip(info.project.name === 'mobile', 'desktop layout only')

const COLOR_LIB = `
  window.__rgba = (css) => { const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d', { willReadFrequently: true });
    x.clearRect(0,0,1,1); x.fillStyle = css; x.fillRect(0,0,1,1); const d = x.getImageData(0,0,1,1).data; return [d[0], d[1], d[2], d[3] / 255] };
  window.__lum = ([r,g,b]) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }; return .2126*f(r) + .7152*f(g) + .0722*f(b) };
  // Blend translucent backgrounds from the element up to the first opaque one.
  window.__bgOf = (el) => { const layers = []; for (let e = el; e; e = e.parentElement) { const c = window.__rgba(getComputedStyle(e).backgroundColor); if (c[3] > 0) layers.push(c); if (c[3] > .99) break }
    let base = layers.length && layers.at(-1)[3] > .99 ? layers.pop() : window.__rgba('#fff'); for (const c of layers.reverse()) base = [0,1,2].map((i) => c[i] * c[3] + base[i] * (1 - c[3])).concat(1); return base };
  window.__contrast = (a, b) => { const [x, y] = [window.__lum(a), window.__lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05) };
`

for (const theme of ['light', 'dark']) {
  test.describe(`sidebar, ${theme}`, () => {
    test.use({ colorScheme: theme })

    test('landmark, 11 items with Thai labels and hrefs, group headings are plain text', async ({ page }) => {
      await page.goto('/admin')
      await expect(page.getByRole('navigation', { name: 'เมนูแอดมิน' })).toHaveCount(1)
      await expect(items(page)).toHaveCount(11)
      expect((await items(page).allInnerTexts()).map((t) => t.trim())).toEqual(LABELS)
      const links = page.getByRole('navigation', { name: 'เมนูแอดมิน' }).getByRole('link')
      expect(await links.evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual(HREFS)
      await expect(side(page).getByRole('link', { name: 'ดูเว็บ', exact: true })).toHaveAttribute('href', '/')
      await expect(side(page).getByRole('button', { name: 'ออก', exact: true })).toHaveCount(1)
      const heads = await side(page).locator('.side-h').evaluateAll((els) => els.map((el) => ({
        text: el.textContent.trim(), tag: el.tagName, tabindex: el.getAttribute('tabindex'), role: el.getAttribute('role'),
        interactive: !!el.closest('a, button') || !!el.querySelector('a, button'), display: getComputedStyle(el).display,
      })))
      expect(heads.map((h) => h.text)).toEqual(HEADINGS)
      for (const h of heads) {
        expect(h.tabindex, h.text).toBeNull()
        expect(h.role, h.text).toBeNull()
        expect(h.interactive, h.text).toBe(false)
        if (isMobile(page)) expect(h.display, `${h.text} hidden on mobile`).toBe('none')
      }
    })

    test('exactly one aria-current item, with tint, semi-bold label and a left bar; idle ones have none', async ({ page }) => {
      await page.goto('/admin/contact')
      await setTheme(page, theme)
      await page.reload()
      const state = await items(page).evaluateAll((els) => els.map((el) => {
        const cs = getComputedStyle(el)
        const bar = getComputedStyle(el, '::before')
        const svg = getComputedStyle(el.querySelector('svg'))
        return { label: el.textContent.trim(), current: el.getAttribute('aria-current'), weight: Number(cs.fontWeight), bg: cs.backgroundColor, color: cs.color, icon: svg.color, bar: bar.content !== 'none' && bar.content !== 'normal' && parseFloat(bar.width || '0') > 0 && parseFloat(bar.height || '0') > 0 }
      }))
      const active = state.filter((s) => s.current === 'page')
      expect(active.map((s) => s.label)).toEqual(['ติดต่อ'])
      const idle = state.filter((s) => s.current !== 'page')
      expect(active[0].bar, 'active bar').toBe(true)
      expect(idle.some((s) => s.bar), 'no idle bar').toBe(false)
      expect(active[0].weight).toBeGreaterThanOrEqual(600)
      expect(Math.max(...idle.map((s) => s.weight))).toBeLessThan(600)
      expect(active[0].bg, 'tinted background').not.toBe('rgba(0, 0, 0, 0)')
      expect(idle.every((s) => s.bg === 'rgba(0, 0, 0, 0)'), 'idle rows are transparent').toBe(true)
      expect(active[0].color, 'active label is coloured').not.toBe(idle[0].color)
      expect(active[0].icon, 'icon follows the label colour').toBe(active[0].color)
    })

    test('Tab follows the visual order and every item shows a focus ring', async ({ page }) => {
      await page.goto('/admin')
      const seen = []
      for (let i = 0; i < 11; i++) {
        await page.keyboard.press('Tab')
        seen.push(await page.evaluate(() => {
          const el = document.activeElement
          const cs = getComputedStyle(el)
          return { text: el.textContent.trim(), outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2, ring: /0px 0px 0px [2-9]px/.test(cs.boxShadow), top: el.getBoundingClientRect().top, left: el.getBoundingClientRect().left + document.querySelector('aside.side').scrollLeft }
        }))
      }
      expect(seen.map((s) => s.text)).toEqual(LABELS)
      for (const s of seen) expect(s.outline || s.ring, `${s.text} focus ring`).toBe(true)
      if (!isMobile(page)) for (let i = 1; i < seen.length; i++) expect(seen[i].top, `${seen[i].text} below the previous row`).toBeGreaterThan(seen[i - 1].top)
      else for (let i = 1; i < seen.length; i++) expect(seen[i].left, `${seen[i].text} right of the previous one`).toBeGreaterThan(seen[i - 1].left)
    })

    test('theme toggle: keyboard, aria-pressed, moon in light and sun in dark', async ({ page }) => {
      await page.goto('/admin')
      await setTheme(page, theme)
      await page.reload()
      const toggle = page.locator('button.theme-toggle[aria-label="สลับโหมดมืด"]')
      const icons = () => toggle.locator('svg').evaluateAll((els) => els.map((e) => getComputedStyle(e).display !== 'none'))
      await toggle.scrollIntoViewIfNeeded()
      await expect(toggle.locator('svg')).toHaveCount(2)
      expect(await icons(), 'moon first, sun second').toEqual([theme === 'light', theme === 'dark'])
      await expect(toggle).toHaveAttribute('aria-pressed', String(theme === 'dark'))
      await toggle.focus()
      await page.keyboard.press('Enter')
      await expect(toggle).toHaveAttribute('aria-pressed', String(theme !== 'dark'))
      expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme === 'dark' ? 'light' : 'dark')
      expect(await icons()).toEqual([theme !== 'light', theme !== 'dark'])
    })

    test('label and heading contrast >= 4.5:1 (idle, active, group headings)', async ({ page }) => {
      await page.goto('/admin/contact')
      await setTheme(page, theme)
      await page.reload()
      await page.evaluate(COLOR_LIB)
      const r = await page.evaluate(() => {
        const read = (el) => ({ text: el.textContent.trim(), ratio: window.__contrast(window.__rgba(getComputedStyle(el).color), window.__bgOf(el)) })
        return { rows: [...document.querySelectorAll('.side a, .side button')].map((e) => ({ ...read(e), on: e.matches('.on') })), heads: [...document.querySelectorAll('.side-h')].map(read).filter((_, i) => true) }
      })
      expect(r.rows.some((x) => x.on)).toBe(true)
      for (const x of r.rows) expect(x.ratio, `${x.text}${x.on ? ' (active)' : ''}`).toBeGreaterThanOrEqual(4.5)
      // Headings are hidden on the phone bar, where they do not matter.
      if (!isMobile(page)) for (const x of r.heads) expect(x.ratio, `heading ${x.text}`).toBeGreaterThanOrEqual(4.5)
    })

    test('no 3D leftovers: no images, no text shadow on titles or labels', async ({ page }) => {
      await page.goto('/admin/contact')
      await setTheme(page, theme)
      await page.reload()
      await expect(side(page).locator('img')).toHaveCount(0)
      const shadows = await page.evaluate(() => [document.querySelector('main h1'), ...document.querySelectorAll('.side a, .side button, .side-h')].map((e) => getComputedStyle(e).textShadow))
      expect(shadows.every((s) => s === 'none'), JSON.stringify(shadows)).toBe(true)
    })

    test('screenshot of the sidebar with /admin/contact active', async ({ page }) => {
      mkdirSync(SHOTS, { recursive: true })
      await page.goto('/admin')
      await setTheme(page, theme)
      await page.goto('/admin/contact')
      await page.waitForTimeout(400)
      await side(page).screenshot({ path: `${SHOTS}/sidebar-${theme}-${size(page)}.png` })
    })
  })
}

test('the old 3D pictures are gone from the server', async ({ request }) => {
  for (const path of ['/assets/nav/mission.webp', '/assets/nav/overview.webp', '/assets/nav/x.svg', '/assets/nav/../../.env']) {
    expect((await request.get(path)).status(), path).toBe(404)
  }
  expect((await request.get('/assets/admin.css')).status()).toBe(200)
})

test.describe('desktop rows', () => {
  test('rows are horizontal: icon left of the label, same centre, icon >= 20px, row >= 40px', async ({ page }, info) => {
    skipOnMobile(info)
    await page.goto('/admin')
    const rows = await items(page).evaluateAll((els) => els.map((el) => {
      const svg = [...el.querySelectorAll('svg')].find((v) => getComputedStyle(v).display !== 'none').getBoundingClientRect()
      const range = document.createRange()
      const text = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim())
      range.selectNodeContents(text)
      const t = range.getBoundingClientRect()
      const row = el.getBoundingClientRect()
      return { label: el.textContent.trim(), iconRight: svg.right, textLeft: t.left, iconMid: svg.top + svg.height / 2, textMid: t.top + t.height / 2, iconW: svg.width, rowH: row.height, rowW: row.width }
    }))
    expect(rows.length).toBe(11)
    for (const r of rows) {
      expect(r.iconRight, `${r.label} icon is left of its label`).toBeLessThanOrEqual(r.textLeft)
      expect(Math.abs(r.iconMid - r.textMid), `${r.label} vertical centres`).toBeLessThanOrEqual(5)
      expect(r.iconW, `${r.label} icon`).toBeGreaterThanOrEqual(20)
      expect(r.rowH, `${r.label} row`).toBeGreaterThanOrEqual(40)
      expect(r.rowW, `${r.label} row width`).toBeGreaterThan(150)
    }
  })

  for (const [w, h] of [[1920, 1080], [1440, 900], [1366, 768]]) {
    test.describe(`${w}x${h}`, () => {
      test.use({ viewport: { width: w, height: h } })
      test('the sidebar fits without scrolling and ออก is fully in the viewport', async ({ page }, info) => {
        skipOnMobile(info)
        await page.goto('/admin')
        const m = await side(page).evaluate((el) => ({ scrollH: el.scrollHeight, clientH: el.clientHeight }))
        expect(m.scrollH, JSON.stringify(m)).toBeLessThanOrEqual(m.clientH)
        const box = await itemOf(page, 'ออก').boundingBox()
        expect(box.y).toBeGreaterThanOrEqual(0)
        expect(box.y + box.height, 'ออก bottom edge').toBeLessThanOrEqual(h)
      })
    })
  }

  test.describe('1280x600', () => {
    test.use({ viewport: { width: 1280, height: 600 }, storageState: { cookies: [], origins: [] } })
    test('the sidebar scrolls and logout works from the scrolled sidebar', async ({ page }, info) => {
      skipOnMobile(info)
      await page.goto('/admin/login')
      await page.getByLabel('อีเมล').fill(ADMIN_EMAIL)
      await page.getByLabel('รหัสผ่าน').fill(ADMIN_PASSWORD)
      await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click()
      await page.waitForURL('**/admin')
      const m = await side(page).evaluate((el) => ({ scrollH: el.scrollHeight, clientH: el.clientHeight, overflowY: getComputedStyle(el).overflowY }))
      expect(m.scrollH, JSON.stringify(m)).toBeGreaterThan(m.clientH)
      expect(['auto', 'scroll']).toContain(m.overflowY)
      const out = itemOf(page, 'ออก')
      await out.scrollIntoViewIfNeeded()
      await expect(out).toBeInViewport({ ratio: 1 })
      await out.click()
      await page.waitForURL('**/admin/login')
      await page.goto('/admin')
      await expect(page).toHaveURL(/\/admin\/login/)
    })
  })
})

test.describe('typography (K2D)', () => {
  test('K2D is loaded for the admin text', async ({ page }, info) => {
    await page.goto('/admin')
    const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily)
    expect(family.replaceAll('"', '')).toMatch(/^K2D\b/)
    const loaded = await page.evaluate(async () => {
      await Promise.race([document.fonts.load('16px K2D', 'ภาพรวม'), new Promise((r) => setTimeout(r, 6000))])
      return { faces: [...document.fonts].filter((f) => f.family.replaceAll('"', '') === 'K2D' && f.status === 'loaded').length, check: document.fonts.check('16px K2D', 'ภาพรวม') }
    })
    if (!loaded.faces) {
      info.annotations.push({ type: 'skipped', description: 'Google Fonts unreachable: K2D did not load, falling back to Noto Sans Thai' })
      test.skip(true, 'Google Fonts unreachable')
    }
    expect(loaded.check).toBe(true)
  })

  test('Thai text is not clipped: line-height >= 1.2 and no vertical overflow', async ({ page }) => {
    for (const url of ['/admin', '/admin/projects/new', '/admin/contact']) {
      await page.goto(url)
      const bad = await page.evaluate(() => {
        const out = []
        const sels = ['main h1', 'main h2', 'main h3', 'main button', 'main .button', 'main input:not([type=file]):not([type=checkbox])', 'main select', 'main textarea', 'main label', '.side a', '.side button', '.side-h', '.kpi span', '.pills li', '.loc']
        for (const sel of sels) for (const el of document.querySelectorAll(sel)) {
          const cs = getComputedStyle(el)
          if (cs.display === 'none') continue
          const fs = parseFloat(cs.fontSize)
          const lh = cs.lineHeight === 'normal' ? 1.5 * fs : parseFloat(cs.lineHeight)
          if (lh / fs < 1.2) out.push(`${sel}: line-height ${(lh / fs).toFixed(2)}`)
          if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) && el.scrollHeight > el.clientHeight + 1 && cs.overflowY !== 'visible') out.push(`${sel} "${el.textContent.trim().slice(0, 20)}": scrollHeight ${el.scrollHeight} > ${el.clientHeight}`)
        }
        return [...new Set(out)]
      })
      expect(bad, url).toEqual([])
    }
  })
})

test.describe('long titles', () => {
  const NAMES = { latin: 'Supercalifragilistic'.repeat(4), thai: 'สวนยาวมากๆ🌿🌳'.repeat(10).slice(0, 78) }
  for (const [kind, name] of Object.entries(NAMES)) {
    test(`${kind}: no horizontal overflow and card titles stay inside their cards (320, 375, 1280, both themes)`, async ({ page }) => {
      await page.goto('/admin/projects/new')
      const form = page.getByRole('main')
      await form.getByLabel('ชื่อผลงาน', { exact: true }).fill(name)
      await form.getByLabel(/^ชื่อใน URL/).fill(`k2d-${kind}-${Date.now()}`)
      await form.getByLabel('สถานที่', { exact: true }).fill(name)
      await form.getByLabel('พื้นที่', { exact: true }).fill('100 ตร.ม.')
      await form.getByLabel('ข้อมูลร่มเงา', { exact: true }).fill('ร่ม')
      await form.getByLabel(/^คำอธิบายสำหรับ Google/).fill('สรุป')
      await form.getByLabel(/^รายละเอียดงาน/).fill('รายละเอียด')
      await form.getByLabel(/^รูปปก/).setInputFiles(COVER)
      await form.getByLabel('คำบรรยายรูปปก (alt)', { exact: true }).fill('รูป')
      await form.getByLabel('ลำดับบนหน้าเว็บ').fill('-100')
      await form.getByRole('button', { name: 'บันทึก', exact: true }).click()
      await page.waitForURL(/\/admin\/projects\/\d+\?saved=1/)
      const id = page.url().match(/projects\/(\d+)/)[1]
      const original = page.viewportSize()
      try {
        const problems = []
        for (const scheme of ['light', 'dark']) {
          await page.emulateMedia({ colorScheme: scheme })
          for (const w of [320, 375, 1280]) {
            await page.setViewportSize({ width: w, height: 800 })
            for (const url of ['/admin', '/admin/projects', `/admin/projects/${id}`]) {
              await page.goto(url)
              const r = await page.evaluate(() => ({
                over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                escaped: [...document.querySelectorAll('.pcard h3, .pcard .loc, .project-body a, main h1')].filter((e) => { const c = e.closest('.card, .project, header') ?? e.parentElement; return e.getBoundingClientRect().right > c.getBoundingClientRect().right + 1 }).map((e) => e.className || e.tagName),
              }))
              if (r.over > 0) problems.push(`${scheme}/${w}${url.replace(id, ':id')} overflow ${r.over}px`)
              if (r.escaped.length) problems.push(`${scheme}/${w}${url.replace(id, ':id')} escapes card: ${r.escaped}`)
            }
          }
        }
        expect(problems).toEqual([])
      } finally {
        await page.setViewportSize(original)
        await page.request.post(`/admin/projects/${id}/delete`, { form: { x: '1' } })
      }
    })
  }
})

test.describe('mobile bottom bar', () => {
  for (const width of [320, 375]) {
    test.describe(`${width}px`, () => {
      test.use({ viewport: { width, height: 700 }, isMobile: true, hasTouch: true })

      for (const scheme of ['light', 'dark']) {
        test(`${scheme}: no horizontal scroll, bar does not cover content, toast sits above the bar`, async ({ page }) => {
          await page.emulateMedia({ colorScheme: scheme })
          for (const url of ['/admin', '/admin/projects', '/admin/contact', '/admin/projects/1']) {
            await page.goto(url)
            expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), url).toBeLessThanOrEqual(0)
          }
          await page.goto('/admin')
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
          const gap = await page.evaluate(() => ({
            barTop: document.querySelector('aside.side').getBoundingClientRect().top,
            lastBottom: Math.max(...[...document.querySelectorAll('main > *:last-child, main section:last-child .card:last-child')].map((e) => e.getBoundingClientRect().bottom)),
          }))
          expect(gap.lastBottom, JSON.stringify(gap)).toBeLessThanOrEqual(gap.barTop)
          await page.goto('/admin/contact?saved=1')
          const toast = await page.getByRole('status').evaluate((el) => el.getBoundingClientRect().bottom)
          expect(toast, 'toast bottom above bar top').toBeLessThanOrEqual(await side(page).evaluate((el) => el.getBoundingClientRect().top))
        })
      }

      test('the current item is in view, targets are >= 38px, ออก is reachable by scrolling', async ({ page }) => {
        await page.goto('/admin/contact')
        await page.waitForTimeout(500)
        const box = await itemOf(page, 'ติดต่อ').boundingBox()
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1)
        for (const label of LABELS) {
          const b = await itemOf(page, label).boundingBox()
          expect(b.width, `${label} width`).toBeGreaterThanOrEqual(38)
          expect(b.height, `${label} height`).toBeGreaterThanOrEqual(38)
        }
        expect((await side(page).boundingBox()).height).toBeGreaterThanOrEqual(60)
        const out = itemOf(page, 'ออก')
        await out.scrollIntoViewIfNeeded()
        await expect(out).toBeInViewport({ ratio: 0.9 })
      })
    })
  }
})

test.describe('no console errors on every admin page', () => {
  for (const url of ['/admin', '/admin/projects', '/admin/projects/new', '/admin/projects/1', '/admin/s/hero', '/admin/s/about', '/admin/s/mission', '/admin/s/services', '/admin/s/brand', '/admin/contact', '/admin/slots/hero']) {
    test(`clean: ${url}`, async ({ page }) => {
      const r = await page.goto(url)
      expect(r.status()).toBe(200)
      await page.waitForLoadState('load')
    })
  }
  test.describe('404 pages', () => {
    test.use({ allowedErrors: [/status of 404/] })
    for (const url of ['/admin/nope', '/admin/projects/9999']) {
      test(`only the browser's own 404 line: ${url}`, async ({ page }) => {
        expect((await page.goto(url)).status()).toBe(404)
        await expect(side(page)).toBeVisible()
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      })
    }
  })
})
