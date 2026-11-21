// Edge cases: odd stored theme values, toggle spam, keyboard-only use, reduced motion,
// the "saved" toast, narrow screens and very long project names.
import { expect } from '@playwright/test'
import { test } from './helpers.mjs'

const TOGGLE = 'button.theme-toggle[aria-label="สลับโหมดมืด"]'
const COVER = 'seed/images/about-plant-nursery.jpg'
const theme = (page) => page.evaluate(() => document.documentElement.dataset.theme)
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

async function tabTo(page, isTarget, max = 40) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab')
    if (await page.evaluate(isTarget)) return true
  }
  return false
}

test.describe('stored theme value is not trusted', () => {
  test.use({ colorScheme: 'light' })
  for (const value of ['x', '"><script>alert(1)</script>', '', 'DARK', 'dark ']) {
    test(`localStorage.theme = ${JSON.stringify(value)} falls back to the system scheme`, async ({ page }) => {
      await page.goto('/admin')
      await page.evaluate((v) => localStorage.setItem('theme', v), value)
      await page.reload()
      expect(await theme(page)).toBe('light')
      expect(await page.evaluate(() => document.querySelectorAll('script:not([src])').length), 'no inline script injected').toBe(0)
      const toggle = page.locator(TOGGLE)
      await toggle.scrollIntoViewIfNeeded()
      await expect(toggle).toHaveAttribute('aria-pressed', 'false')
      await toggle.click()
      expect(await theme(page)).toBe('dark')
      expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark')
    })
  }
})

test('theme toggle spam ends in a consistent state', async ({ page }) => {
  await page.goto('/admin')
  const toggle = page.locator(TOGGLE)
  await toggle.scrollIntoViewIfNeeded()
  const start = await theme(page)
  for (let i = 0; i < 21; i++) await toggle.click({ delay: 0 })
  const end = await theme(page)
  expect(end).not.toBe(start)
  await expect(toggle).toHaveAttribute('aria-pressed', String(end === 'dark'))
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(end)
})

test.describe('keyboard only', () => {
  for (const scheme of ['light', 'dark']) {
    test.describe(scheme, () => {
      test.use({ colorScheme: scheme })

      test('theme toggle is reachable, has a visible focus ring and works with Enter and Space', async ({ page }) => {
        await page.goto('/admin')
        expect(await tabTo(page, () => document.activeElement?.classList.contains('theme-toggle'))).toBe(true)
        const ring = await page.evaluate(() => {
          const cs = getComputedStyle(document.activeElement)
          return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), color: cs.outlineColor }
        })
        expect(ring.style, JSON.stringify(ring)).not.toBe('none')
        expect(ring.width).toBeGreaterThanOrEqual(2)
        await page.keyboard.press('Enter')
        expect(await theme(page)).toBe(scheme === 'dark' ? 'light' : 'dark')
        await page.keyboard.press('Space')
        expect(await theme(page)).toBe(scheme)
      })

      test('rail links are tabbable in order with a visible focus ring', async ({ page }) => {
        await page.goto('/admin')
        const seen = []
        for (let i = 0; i < 9; i++) {
          await page.keyboard.press('Tab')
          seen.push(await page.evaluate(() => {
            const el = document.activeElement
            return { text: el.textContent.trim(), ring: getComputedStyle(el).outlineStyle }
          }))
        }
        expect(seen.map((s) => s.text)).toEqual(['ภาพรวม', 'Hero', 'เกี่ยวกับ', 'พันธกิจ', 'บริการ', 'ทีมงาน', 'ผลงาน', 'ติดต่อ', 'โหมดมืด'])
        for (const s of seen) expect(s.ring, s.text).not.toBe('none')
      })
    })
  }

  test('publish switch toggles with Space', async ({ page }) => {
    await page.goto('/admin/projects')
    expect(await tabTo(page, () => document.activeElement?.getAttribute('role') === 'switch')).toBe(true)
    const name = await page.evaluate(() => document.activeElement.getAttribute('aria-label'))
    const toggle = page.getByRole('switch', { name, exact: true })
    const before = await toggle.getAttribute('aria-checked')
    await page.keyboard.press('Space')
    await page.waitForURL(/saved=1/)
    await expect(toggle).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', before)
  })
})

test.describe('motion', () => {
  test.describe('reduced', () => {
    test.use({ reducedMotion: 'reduce' })
    test('KPI numbers show their final value at once', async ({ page }) => {
      await page.goto('/admin', { waitUntil: 'domcontentloaded' })
      const values = await page.locator('[data-count]').evaluateAll((els) => els.map((e) => [e.textContent, e.dataset.count]))
      expect(values.length).toBe(4)
      for (const [shown, count] of values) expect(shown).toBe(count)
    })
  })

  test('KPI count-up lands on the exact value', async ({ page }) => {
    await page.goto('/admin')
    await expect.poll(() => page.locator('[data-count]').evaluateAll((els) => els.every((e) => e.textContent === e.dataset.count)), { timeout: 3000 }).toBe(true)
  })
})

test('saved toast appears, then fades and never blocks clicks', async ({ page }) => {
  await page.goto('/admin/contact')
  await page.getByRole('main').getByRole('button', { name: 'บันทึก', exact: true }).click()
  await page.waitForURL(/\/admin\/contact\?saved=1/)
  const toast = page.getByRole('status')
  await expect(toast).toHaveText('บันทึกแล้ว')
  await expect(toast).toHaveCSS('pointer-events', 'none')
  await expect.poll(() => toast.evaluate((e) => Number(getComputedStyle(e).opacity)), { timeout: 6000 }).toBe(0)
})

test.describe('320px wide', () => {
  test.use({ viewport: { width: 320, height: 700 }, colorScheme: 'dark' })
  for (const url of ['/admin', '/admin/projects', '/admin/projects/1', '/admin/contact', '/admin/s/hero', '/admin/projects/new']) {
    test(`no horizontal scroll: ${url}`, async ({ page }) => {
      await page.goto(url)
      expect(await overflow(page)).toBeLessThanOrEqual(0)
    })
  }
})

test.describe('very long project names', () => {
  // 80 characters is the form's maximum; one long Latin word must wrap too.
  const NAMES = {
    thai: ('สวนยาวมากๆ🌿🌳'.repeat(10)).slice(0, 78),
    latin: 'Supercalifragilistic'.repeat(4),
  }
  for (const [kind, name] of Object.entries(NAMES)) {
    test(`${kind}: dashboard, list and edit page do not scroll sideways`, async ({ page }) => {
      await page.goto('/admin/projects/new')
      const form = page.getByRole('main')
      await form.getByLabel('ชื่อผลงาน', { exact: true }).fill(name)
      await form.getByLabel(/^ชื่อใน URL/).fill(`long-${kind}-${Date.now()}`)
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
      try {
        const widths = {}
        for (const url of ['/admin', '/admin/projects', `/admin/projects/${id}`]) {
          await page.goto(url)
          widths[url] = await overflow(page)
        }
        expect(widths, 'horizontal overflow per page').toEqual({ '/admin': 0, '/admin/projects': 0, [`/admin/projects/${id}`]: 0 })
      } finally {
        await page.request.post(`/admin/projects/${id}/delete`, { form: { x: '1' } })
      }
    })
  }
})
