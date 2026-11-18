import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import sharp from 'sharp'

const dataDir = mkdtempSync(join(tmpdir(), 'ngaomai-'))
process.env.DATA_DIR = dataDir
process.env.SITE_URL = 'http://site.test'
delete process.env.SITE_INDEXABLE

const { server } = await import('../server.mjs')
const { db } = await import('../src/db.mjs')
const { hashPassword, setAdminPassword } = await import('../src/auth.mjs')
const { saveImage } = await import('../src/images.mjs')

const EMAIL = 'admin@test.example'
const PASSWORD = 'correct-horse-battery'
const KEYS = ['logo', 'hero', 'hero_2', 'hero_3', 'about', 'quote', 'feature', 'mission_1', 'mission_2',
  'service_design', 'service_build', 'service_care', 'team', 'og']
let base, sid, jpeg

const uploads = () => readdirSync(join(dataDir, 'uploads')).length
const imageFile = () => new File([jpeg], 'garden.jpg', { type: 'image/jpeg' })
const get = (path, headers = {}) => fetch(base + path, { headers, redirect: 'manual' })

function post(path, fields = {}, headers = { Cookie: `sid=${sid}` }) {
  const body = new FormData()
  for (const [key, value] of Object.entries(fields)) body.set(key, value)
  return fetch(base + path, { method: 'POST', body, headers, redirect: 'manual' })
}

const project = (extra = {}) => ({
  title: 'สวนทดสอบ', slug: 'test-garden', type: 'บ้าน', location: 'เชียงใหม่', year: '2026', area: '100 ตร.ม.',
  shade: 'ร่มเช้า', summary: 'สรุป', body: 'ย่อหน้าหนึ่ง\nย่อหน้าสอง', cover_alt: 'รูปปก', sort: '1', published: 'on',
  cover: imageFile(), ...extra,
})

before(async () => {
  jpeg = await sharp({ create: { width: 2000, height: 1200, channels: 3, background: '#476' } }).jpeg().toBuffer()
  setAdminPassword(EMAIL, await hashPassword(PASSWORD))
  for (const key of KEYS) {
    db.prepare('INSERT INTO site_images (key, label, image, alt) VALUES (?, ?, ?, ?)')
      .run(key, key, await saveImage(imageFile(), key), key)
  }
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})

after(() => {
  server.close()
  db.close()
  rmSync(dataDir, { recursive: true, force: true })
})

test('public pages carry their SEO tags', async () => {
  const home = await (await get('/')).text()
  assert.match(home, /<h1>/)
  assert.match(home, /application\/ld\+json/)
  assert.match(home, /content="noindex,nofollow"/)
  assert.match(home, /rel="canonical" href="http:\/\/site.test\/"/)
  assert.match(await (await get('/robots.txt')).text(), /Sitemap: http:\/\/site.test\/sitemap.xml/)
  assert.equal((await get('/projects/none')).status, 404)
})

test('admin pages and uploads refuse anyone not logged in', async () => {
  const res = await get('/admin')
  assert.equal(res.status, 303)
  assert.equal(res.headers.get('location'), '/admin/login')
  assert.equal((await post('/admin/projects', project(), {})).status, 303)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM projects').get().n, 0)
})

test('wrong password fails and the right one starts a session', async () => {
  assert.equal((await post('/admin/login', { email: EMAIL, password: 'wrong' }, {})).status, 401)
  const res = await post('/admin/login', { email: EMAIL, password: PASSWORD }, {})
  assert.equal(res.status, 303)
  const cookie = res.headers.get('set-cookie')
  assert.match(cookie, /HttpOnly; SameSite=Strict/)
  sid = cookie.match(/sid=([^;]+)/)[1]
  assert.equal((await get('/admin', { Cookie: `sid=${sid}` })).status, 200)
})

test('a post from another site is refused', async () => {
  const res = await post('/admin/projects', project(), { Cookie: `sid=${sid}`, Origin: 'https://evil.example' })
  assert.equal(res.status, 403)
})

test('bad uploads and missing alt text are refused', async () => {
  const before = uploads()
  const fake = new File(['<script>alert(1)</script>'], 'fake.jpg', { type: 'image/jpeg' })
  assert.equal((await post('/admin/projects', project({ cover: fake }))).status, 400)
  assert.equal((await post('/admin/projects', project({ cover_alt: '' }))).status, 400)
  assert.equal((await post('/admin/projects', project({ slug: 'Bad Slug' }))).status, 400)
  assert.equal(uploads(), before)
})

test('a project moves through add, hide and delete', async () => {
  const start = uploads()
  const created = await post('/admin/projects', project({ title: 'สวน <b>ทดสอบ</b>' }))
  assert.equal(created.status, 303)
  const adminPath = created.headers.get('location').split('?')[0]

  const page = await (await get('/projects/test-garden')).text()
  assert.match(page, /สวน &lt;b&gt;ทดสอบ/)
  assert.doesNotMatch(page, /<b>ทดสอบ/)
  assert.match(await (await get('/')).text(), /\/projects\/test-garden/)
  assert.match(await (await get('/sitemap.xml')).text(), /\/projects\/test-garden/)

  assert.equal((await post(`${adminPath}/images`, { image: imageFile(), alt: 'รูปหนึ่ง' })).status, 303)
  assert.equal((await post(`${adminPath}/images`, { image: imageFile(), alt: 'รูปสอง' })).status, 303)
  assert.equal(uploads(), start + 12)

  const [first, second] = db.prepare('SELECT id FROM project_images ORDER BY sort').all()
  assert.equal((await post(`/admin/images/${second.id}/move`, { by: '-1' })).status, 303)
  assert.equal(db.prepare('SELECT id FROM project_images ORDER BY sort').all()[0].id, second.id)
  assert.equal((await post(`/admin/images/${first.id}/delete`)).status, 303)
  assert.equal(uploads(), start + 8)

  const { cover: _, published: __, ...kept } = project({ title: 'สวนทดสอบ' })
  assert.equal((await post(adminPath, kept)).status, 303)
  assert.equal((await get('/projects/test-garden')).status, 404)
  assert.doesNotMatch(await (await get('/sitemap.xml')).text(), /test-garden/)

  assert.equal((await post(`${adminPath}/delete`)).status, 303)
  assert.equal(uploads(), start)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM project_images').get().n, 0)
})

test('a fixed picture can be replaced but has no delete route', async () => {
  const { image } = db.prepare("SELECT image FROM site_images WHERE key = 'hero'").get()
  assert.equal((await post('/admin/slots/hero', { alt: 'รูปใหม่', image: imageFile() })).status, 303)
  const row = db.prepare("SELECT * FROM site_images WHERE key = 'hero'").get()
  assert.notEqual(row.image, image)
  assert.equal(row.alt, 'รูปใหม่')
  assert.equal((await post('/admin/slots/hero', { alt: '' })).status, 400)
  assert.equal((await post('/admin/slots/hero_2', { alt: 'สไลด์สอง' })).status, 303)
  assert.equal((await get('/admin/slots/hero_2', { Cookie: `sid=${sid}` })).status, 200)
  assert.equal((await post('/admin/slots/hero/delete')).status, 404)
})

test('social buttons follow the admin settings and refuse unsafe links', async () => {
  assert.match(await (await get('/')).text(), /aria-label="LINE"><svg width="24" height="24"/)
  const urls = { line: 'https://line.me/ti/p/demo', facebook: '', tiktok: 'https://www.tiktok.com/@demo' }
  assert.equal((await post('/admin/contact', urls)).status, 303)
  const home = await (await get('/')).text()
  assert.match(home, /line\.me\/ti\/p\/demo/)
  assert.doesNotMatch(home, /aria-label="Facebook"/)
  assert.equal((await post('/admin/contact', { ...urls, line: 'javascript:alert(1)' })).status, 400)
  assert.match(await (await get('/')).text(), /line\.me\/ti\/p\/demo/)
})

test('replacing a picture from its card asks to check the description', async () => {
  const res = await post('/admin/slots/team', { alt: 'ทีมงาน', from: 'card', image: imageFile() })
  assert.equal(res.headers.get('location'), '/admin/slots/team?replaced=1')
  const page = await (await get('/admin/slots/team?replaced=1', { Cookie: `sid=${sid}` })).text()
  assert.match(page, /กรุณาตรวจคำบรรยาย/)
})

test('dashboard pages open and the publish switch hides a project', async () => {
  const headers = { Cookie: `sid=${sid}` }
  for (const path of ['/admin', '/admin/s/hero', '/admin/s/brand', '/admin/projects', '/admin/contact']) {
    assert.equal((await get(path, headers)).status, 200, path)
  }
  assert.equal((await get('/admin/s/nope', headers)).status, 404)

  const created = await post('/admin/projects', project({ slug: 'switch-garden' }))
  const adminPath = created.headers.get('location').split('?')[0]
  assert.equal((await post(`${adminPath}/publish`, { next: 'home' })).headers.get('location'), '/admin?saved=1')
  assert.equal((await get('/projects/switch-garden')).status, 404)
  await post(`${adminPath}/publish`)
  assert.equal((await get('/projects/switch-garden')).status, 200)
  await post(`${adminPath}/delete`)
})

test('mobile admin menu scrolls the current button into view and shows edge fades', async () => {
  const page = await (await get('/admin/contact', { Cookie: `sid=${sid}` })).text()
  assert.match(page, /<a href="\/admin\/contact" class="on" aria-current="page"/)
  assert.match(await (await get('/assets/admin.js')).text(), /\.side a\.on'\)\?\.scrollIntoView/)
  assert.match(await (await get('/assets/admin.css')).text(), /no-repeat local/)
})

test('assets revalidate so an update reaches returning visitors', async () => {
  const first = await get('/assets/site.css')
  assert.equal(first.headers.get('cache-control'), 'no-cache')
  assert.equal((await get('/assets/site.css', { 'If-None-Match': first.headers.get('etag') })).status, 304)
  const href = (await (await get('/')).text()).match(/href="(\/assets\/site\.css\?v=\d+)"/)[1]
  assert.equal((await get(href)).status, 200)
})

test('file routes cannot leave their folders', async () => {
  assert.equal((await get('/uploads/..%2f..%2f.env')).status, 404)
  assert.equal((await get('/assets/..%2f..%2fserver.mjs')).status, 404)
})

test('repeated wrong passwords lock the login', async () => {
  for (let i = 0; i < 5; i++) await post('/admin/login', { email: EMAIL, password: 'nope' }, {})
  assert.equal((await post('/admin/login', { email: EMAIL, password: PASSWORD }, {})).status, 429)
})
