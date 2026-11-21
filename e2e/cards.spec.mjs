// Dashboard cards must stay tidy with the wider K2D font at every width.
import { expect } from '@playwright/test'
import { test } from './helpers.mjs'

const WIDTHS = [1920, 1440, 1366, 1100, 760, 375]
const IMG = 'seed/images/about-plant-nursery.jpg'

for (const scheme of ['light', 'dark']) {
  for (const width of WIDTHS) {
    test.describe(`dashboard cards, ${scheme}, ${width}px`, () => {
      test.use({ colorScheme: scheme, viewport: { width, height: 900 } })

      test('"จัดการ ›" is a single line, the only footer text; Hero upload sits above the footer, full width', async ({ page }) => {
        await page.goto('/admin')
        const cards = page.locator('section:has(h2:text-is("ส่วนของหน้าเว็บ")) .scard')
        await expect(cards).toHaveCount(6)
        const info = await cards.evaluateAll((els) => els.map((card) => {
          const rect = (e) => e.getBoundingClientRect()
          const more = card.querySelector('.more')
          const foot = card.querySelector('.scard-foot')
          const body = card.querySelector('.scard-body')
          const uploads = [...card.querySelectorAll('.button')].filter((b) => b.textContent.includes('เปลี่ยนรูป'))
          const cs = getComputedStyle(more)
          const lh = cs.lineHeight === 'normal' ? parseFloat(cs.fontSize) * 1.5 : parseFloat(cs.lineHeight)
          return {
            title: card.querySelector('h3').textContent.trim(), footText: foot.textContent.replace(/\s+/g, ' ').trim(),
            lines: more.getClientRects().length, h: rect(more).height, lh, nowrap: cs.whiteSpace,
            uploads: uploads.map((u) => ({ text: u.textContent.trim(), top: rect(u).top, bottom: rect(u).bottom, w: rect(u).width, h: rect(u).height })),
            footTop: rect(foot).top, moreTop: rect(more).top, bodyW: rect(body).width - parseFloat(getComputedStyle(body).paddingLeft) - parseFloat(getComputedStyle(body).paddingRight),
            cardW: rect(card).width, bodyBox: { l: rect(body).left, r: rect(body).right }, uploadInBody: uploads.every((u) => body.contains(u)),
          }
        }))
        for (const c of info) {
          expect(c.footText, `${c.title} footer`).toBe('จัดการ ›')
          expect(c.lines, `${c.title} "จัดการ ›" line boxes`).toBe(1)
          expect(c.h, `${c.title} height ${c.h} vs line-height ${c.lh}`).toBeLessThan(c.lh * 1.6)
          expect(c.nowrap, `${c.title} white-space`).toBe('nowrap')
        }
        const hero = info.filter((c) => c.uploads.length)
        expect(hero.map((c) => c.title), 'only the Hero card has an upload control').toEqual(['รูป Hero หน้าแรก'])
        const h = hero[0]
        expect(h.uploads).toHaveLength(1)
        expect(h.uploads[0].text).toBe('เปลี่ยนรูป Hero')
        expect(h.uploadInBody, 'upload is inside the card body').toBe(true)
        expect(h.uploads[0].bottom, 'upload bottom above the footer divider').toBeLessThanOrEqual(h.footTop)
        expect(h.uploads[0].bottom, 'upload above the footer link').toBeLessThanOrEqual(h.moreTop)
        expect(h.uploads[0].w / h.bodyW, `upload width ${h.uploads[0].w} of ${h.bodyW}`).toBeGreaterThanOrEqual(0.9)
        expect(h.uploads[0].h).toBeGreaterThanOrEqual(36)
      })

      test('the contact card footer is "จัดการ ›" on one line', async ({ page }) => {
        await page.goto('/admin')
        const card = page.locator('.scard', { has: page.getByRole('link', { name: 'ช่องทางติดต่อ' }) })
        const r = await card.locator('.more').evaluate((el) => ({ lines: el.getClientRects().length, text: el.textContent.trim(), foot: el.parentElement.textContent.replace(/\s+/g, ' ').trim() }))
        expect(r).toEqual({ lines: 1, text: 'จัดการ ›', foot: 'จัดการ ›' })
      })

      test('no two interactive elements overlap inside any card; project status text is one line clear of its switch', async ({ page }) => {
        await page.goto('/admin')
        const problems = await page.evaluate(() => {
          const out = []
          const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5
          for (const card of document.querySelectorAll('.scard, .pcard')) {
            const title = card.querySelector('h3').textContent.trim()
            // The stretched title link deliberately covers the card; the file input is invisible inside its button.
            const els = [...card.querySelectorAll('.button, button, .more, .pcard-foot span')].filter((e) => !e.closest('.stretch'))
            for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
              if (els[i].contains(els[j]) || els[j].contains(els[i])) continue
              if (hit(els[i].getBoundingClientRect(), els[j].getBoundingClientRect())) out.push(`${title}: "${els[i].textContent.trim()}" overlaps "${els[j].textContent.trim()}"`)
            }
          }
          for (const foot of document.querySelectorAll('.pcard-foot')) {
            const span = foot.querySelector('span'); const sw = foot.querySelector('.switch')
            const t = foot.closest('.pcard').querySelector('h3').textContent.trim()
            if (span.getClientRects().length !== 1) out.push(`${t}: status "${span.textContent.trim()}" wraps`)
            if (!['แสดงบนเว็บ', 'ซ่อนอยู่'].includes(span.textContent.trim())) out.push(`${t}: odd status text`)
            if (getComputedStyle(span).whiteSpace !== 'nowrap') out.push(`${t}: status not nowrap`)
            if (hit(span.getBoundingClientRect(), sw.getBoundingClientRect())) out.push(`${t}: status overlaps switch`)
            if (span.getBoundingClientRect().right > foot.getBoundingClientRect().right + 1) out.push(`${t}: status leaves the card`)
          }
          return out
        })
        expect(problems).toEqual([])
      })
    })
  }
}

test('the Hero card button uploads a picture and lands on the replace notice', async ({ page }) => {
  await page.goto('/admin')
  const before = await page.locator('.scard img').first().getAttribute('src')
  await page.getByText('เปลี่ยนรูป Hero').locator('input[type=file]').setInputFiles(IMG)
  await page.waitForURL(/\/admin\/slots\/hero\?replaced=1/)
  await expect(page.getByRole('status')).toContainText('เปลี่ยนรูปแล้ว')
  await page.goto('/admin')
  expect(await page.locator('.scard img').first().getAttribute('src'), 'hero picture changed').not.toBe(before)
})
