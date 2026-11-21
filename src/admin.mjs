import { asset } from './assets.mjs'
import { db } from './db.mjs'
import { html } from './html.mjs'
import { icon } from './icons.mjs'
import { deleteImage, MAX_IMAGE_BYTES, picture, saveImage, UserError } from './images.mjs'
import { clientIp, isLoggedIn, login, loginBlocked, logout, sessionCookie } from './auth.mjs'

const TYPES = ['บ้าน', 'คาเฟ่', 'รีสอร์ต', 'สำนักงาน']
const MAX_BODY_BYTES = MAX_IMAGE_BYTES + 1024 * 1024
export const SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; img-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
}
const FILE_HINT = html`<small>JPG, PNG หรือ WebP ไม่เกิน 8 MB</small>`

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY_HEADERS, ...headers })
  res.end(String(body))
}
const redirect = (res, to, headers = {}) => send(res, 303, '', { Location: to, ...headers })

function cookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [key, value] = part.trim().split('=')
    if (key === name) return value
  }
  return undefined
}

async function readForm(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new UserError('ไฟล์รูปต้องไม่เกิน 8 MB')
    chunks.push(chunk)
  }
  const form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': req.headers['content-type'] || '' } })
    .formData().catch(() => { throw new UserError('ส่งฟอร์มไม่สำเร็จ กรุณาลองใหม่') })
  return form
}

const text = (form, name) => String(form.get(name) ?? '').trim()

function requireText(value, label, max) {
  if (!value) throw new UserError(`กรุณากรอก${label}`)
  if (value.length > max) throw new UserError(`${label}ยาวเกิน ${max} ตัวอักษร`)
  return value
}

const GROUPS = [
  { id: 'hero', nav: 'Hero', title: 'รูป Hero หน้าแรก', icon: 'ph-images', slots: { hero: 'รูปใหญ่สุดที่ผู้ชมเห็นเป็นรูปแรก', hero_2: 'สไลด์ที่เปลี่ยนต่อจากรูปแรก', hero_3: 'สไลด์สุดท้าย' } },
  { id: 'about', nav: 'เกี่ยวกับ', title: 'เกี่ยวกับเรา', icon: 'ph-info', slots: { about: 'รูปแนวตั้งข้างข้อความ Welcome to', quote: 'รูปข้างคำคม', feature: 'รูปใหญ่กลางหน้า' } },
  { id: 'mission', nav: 'พันธกิจ', title: 'พันธกิจ', icon: 'ph-target', slots: { mission_1: 'รูปขวาบนในส่วน MISSION', mission_2: 'รูปซ้ายล่างในส่วน MISSION' } },
  { id: 'services', nav: 'บริการ', title: 'บริการ', icon: 'ph-leaf', slots: { service_design: 'การ์ดบริการใบที่ 1', service_build: 'การ์ดบริการใบที่ 2', service_care: 'การ์ดบริการใบที่ 3' } },
  { id: 'brand', nav: 'ทีมงาน', title: 'ทีมงานและโลโก้', icon: 'ph-users-three', slots: { team: 'รูปในส่วน OUR TEAM', logo: 'โลโก้บนแถบเมนู', og: 'รูปที่ขึ้นตอนแชร์ลิงก์ในโซเชียล' } },
]
const groupOfSlot = (key) => GROUPS.find((g) => key in g.slots)
// Sidebar sections: a grey heading, then one row per page as [id, href, label, icon]
const NAV = [
  ['หลัก', [['overview', '/admin', 'ภาพรวม', 'ph-squares-four']]],
  ['เนื้อหาเว็บ', GROUPS.map((g) => [g.id, `/admin/s/${g.id}`, g.nav, g.icon])],
  ['จัดการ', [['projects', '/admin/projects', 'ผลงาน', 'ph-folder-open'], ['contact', '/admin/contact', 'ติดต่อ', 'ph-phone']]],
]
const IMAGE_TYPES = 'image/jpeg,image/png,image/webp'
const slotRows = () => Object.fromEntries(db.prepare('SELECT * FROM site_images').all().map((s) => [s.key, s]))

function layout(title, content, { nav = true, saved = false, active = '', sub = '', actions = '' } = {}) {
  return html`<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} | แอดมิน</title>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=K2D:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="${asset('theme.js')}"></script>
  <link rel="stylesheet" href="${asset('admin.css')}">
  <script src="${asset('admin.js')}" defer></script>
</head>
<body class="${nav ? 'shell' : 'bare'}">
  ${nav && html`<aside class="side">
    <nav aria-label="เมนูแอดมิน">
      ${NAV.map(([heading, items]) => html`<p class="side-h">${heading}</p>
      ${items.map(([id, href, label, name]) => html`<a href="${href}" ${id === active && html`class="on" aria-current="page"`}>${icon(name)}${label}</a>`)}`)}
    </nav>
    <div class="side-end">
      <p class="side-h">ระบบ</p>
      <button class="theme-toggle" type="button" aria-label="สลับโหมดมืด" aria-pressed="false">${icon('ph-moon')}${icon('ph-sun')}โหมดมืด</button>
      <a href="/" target="_blank" rel="noopener">${icon('ph-arrow-square-out')}ดูเว็บ</a>
      <form method="post" action="/admin/logout"><button>${icon('ph-sign-out')}ออก</button></form>
    </div>
  </aside>`}
  <main>
    <header class="head page-head">
      <div><h1>${title}</h1>${sub && html`<p>${sub}</p>`}</div>
      ${actions && html`<div class="head-actions">${actions}</div>`}
    </header>
    ${saved && html`<p class="notice toast" role="status">บันทึกแล้ว</p>`}
    ${content}
  </main>
</body>
</html>`
}

const errorBox = (error) => error && html`<p class="error" role="alert">${error}</p>`
const thumb = (name, alt) => html`<img src="${picture(name, alt).src}" alt="${alt}" loading="lazy">`

function loginPage(error, email = '') {
  return layout('เข้าสู่ระบบ', html`
    ${errorBox(error)}
    <form class="stack" method="post" action="/admin/login">
      <label>อีเมล <input type="email" name="email" value="${email}" required autocomplete="username"></label>
      <label>รหัสผ่าน <input type="password" name="password" required autocomplete="current-password"></label>
      <button>เข้าสู่ระบบ</button>
    </form>`, { nav: false })
}

const changeButton = (slot, label = 'เปลี่ยนรูป') => html`<form method="post" action="/admin/slots/${slot.key}" enctype="multipart/form-data" data-autosubmit>
  <input type="hidden" name="alt" value="${slot.alt}">
  <input type="hidden" name="from" value="card">
  <label class="button tonal">${icon('ph-upload-simple')}${label}<input class="file" type="file" name="image" accept="${IMAGE_TYPES}"></label>
</form>`

const publishSwitch = (p, next) => html`<form method="post" action="/admin/projects/${p.id}/publish">
  <input type="hidden" name="next" value="${next}">
  <button class="switch" role="switch" aria-checked="${p.published ? 'true' : 'false'}" aria-label="แสดง ${p.title} บนเว็บ"><span></span></button>
</form>`

function projectRows() {
  return db.prepare(`SELECT p.*, COUNT(i.id) AS photos FROM projects p
    LEFT JOIN project_images i ON i.project_id = p.id GROUP BY p.id ORDER BY p.sort, p.year DESC`).all()
}

const SOCIALS = [['line', 'LINE'], ['facebook', 'Facebook'], ['tiktok', 'TikTok']]
// The project page lays the album out two to a row; six photos fill three rows.
const ALBUM_TARGET = 6

function albumRing(photos) {
  const done = Math.min(photos, ALBUM_TARGET)
  return html`<svg class="pring" viewBox="0 0 40 40" role="img" aria-label="รูปอัลบั้ม ${photos} จาก ${ALBUM_TARGET} รูปที่แนะนำ">
    <circle class="pring-track" cx="20" cy="20" r="16"/>
    <circle class="pring-bar" cx="20" cy="20" r="16" pathLength="100" stroke-dasharray="100" stroke-dashoffset="${100 - Math.round((done / ALBUM_TARGET) * 100)}" transform="rotate(-90 20 20)"/>
    <text x="20" y="24.5" text-anchor="middle">${photos}</text>
  </svg>`
}

const kpi = (name, label, n, of = '') => html`<div class="kpi card">
  <b class="chip">${icon(name)}</b>
  <span>${label}</span>
  <p><strong data-count="${n}">${n}</strong>${of && html`<small>${of}</small>`}</p>
</div>`

function dashboard(saved) {
  const slots = slotRows()
  const projects = projectRows()
  const shown = projects.filter((p) => p.published).length
  const photos = projects.reduce((sum, p) => sum + p.photos, 0)
  const urls = Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, r.value]))
  const links = SOCIALS.filter(([key]) => urls[key]).length

  return layout('ภาพรวม', html`
    <section class="kpis" aria-label="สรุป">
      ${kpi('ph-folder-open', 'ผลงานทั้งหมด', projects.length)}
      ${kpi('ph-arrow-square-out', 'แสดงบนเว็บ', shown)}
      ${kpi('ph-images', 'รูปทั้งหมด', Object.keys(slots).length + projects.length + photos)}
      ${kpi('ph-phone', 'ช่องทางติดต่อ', links, ` / ${SOCIALS.length}`)}
    </section>

    <section>
      <div class="sec-head"><h2>ผลงาน</h2><a href="/admin/projects">ดูทั้งหมด</a></div>
      ${projects.length === 0 && html`<p class="empty card">ยังไม่มีผลงาน กดปุ่ม “เพิ่มผลงาน” ด้านบนเพื่อเริ่ม</p>`}
      <div class="cards">
        ${projects.slice(0, 8).map((p) => html`<article class="pcard card lift">
          ${thumb(p.cover, '')}
          <div class="pcard-body">
            <div class="pcard-top">
              <div>
                <h3><a class="stretch" href="/admin/projects/${p.id}">${p.title}</a></h3>
                <p class="loc">${icon('ph-map-pin')}${p.location}</p>
              </div>
              ${albumRing(p.photos)}
            </div>
            <ul class="pills">
              <li>ปี ${p.year}</li>
              <li>${p.type}</li>
              <li>${p.photos} รูป</li>
            </ul>
            <div class="pcard-foot">
              <span>${p.published ? 'แสดงบนเว็บ' : 'ซ่อนอยู่'}</span>
              ${publishSwitch(p, 'home')}
            </div>
          </div>
        </article>`)}
      </div>
    </section>

    <section>
      <div class="sec-head"><h2>ส่วนของหน้าเว็บ</h2></div>
      <div class="cards">
        ${GROUPS.map((g) => {
          const first = slots[Object.keys(g.slots)[0]]
          return html`<article class="scard card lift">
            ${first ? thumb(first.image, '') : html`<b class="scard-icon">${icon(g.icon)}</b>`}
            <div class="scard-body">
              <h3><a class="stretch" href="/admin/s/${g.id}">${g.title}</a></h3>
              <p>${Object.keys(g.slots).length} รูป</p>
              ${g.id === 'hero' && slots.hero && changeButton(slots.hero, 'เปลี่ยนรูป Hero')}
              <div class="scard-foot"><span class="more">จัดการ ›</span></div>
            </div>
          </article>`
        })}
        <article class="scard card lift">
          <b class="scard-icon">${icon('ph-phone')}</b>
          <div class="scard-body">
            <h3><a class="stretch" href="/admin/contact">ช่องทางติดต่อ</a></h3>
            <p>เปิดอยู่ ${links} จาก ${SOCIALS.length} ปุ่ม</p>
            <div class="scard-foot"><span class="more">จัดการ ›</span></div>
          </div>
        </article>
      </div>
    </section>`, {
    saved,
    active: 'overview',
    sub: 'สรุปผลงานและรูปทั้งหมดบนเว็บไซต์ของคุณ',
    actions: html`<a class="button" href="/admin/projects/new">${icon('ph-plus')}เพิ่มผลงาน</a>
      <a class="button plain" href="/" target="_blank" rel="noopener">${icon('ph-arrow-square-out')}ดูเว็บ</a>`,
  })
}

function groupPage(group, saved) {
  const slots = slotRows()
  const keys = Object.keys(group.slots).filter((key) => slots[key])
  return layout(group.title, html`<div class="${group.id === 'hero' ? 'slots-hero' : 'slots'}">
    ${keys.map((key) => html`<article class="slot lift">
      <a class="slot-pic" href="/admin/slots/${key}" aria-label="แก้ไข${slots[key].label}">${thumb(slots[key].image, slots[key].alt)}</a>
      <div class="slot-body">
        <h2>${slots[key].label}</h2>
        <p>${group.slots[key]}</p>
        <div class="slot-actions">${changeButton(slots[key])}<a class="button plain" href="/admin/slots/${key}">${icon('ph-pencil-simple')}แก้คำบรรยาย</a></div>
      </div>
    </article>`)}
  </div>`, { saved, active: group.id, sub: 'กดเปลี่ยนรูปเพื่ออัปโหลดรูปใหม่ หรือแก้คำบรรยายให้ตรงกับรูป' })
}

function projectsPage(saved) {
  const projects = projectRows()
  return layout('ผลงาน', html`
    ${projects.length === 0 && html`<p class="empty card">ยังไม่มีผลงาน</p>`}
    <div class="project-grid">
      ${projects.map((p) => html`<article class="project lift">
        <a href="/admin/projects/${p.id}">${thumb(p.cover, p.cover_alt)}</a>
        <div class="project-body">
          <a href="/admin/projects/${p.id}">${p.title}</a>
          <p>${p.type} · ${p.year} · รูปอัลบั้ม ${p.photos} รูป</p>
        </div>
        ${publishSwitch(p, 'list')}
      </article>`)}
    </div>`, {
    saved,
    active: 'projects',
    sub: 'เปิดสวิตช์เพื่อแสดงผลงานบนเว็บ ปิดเพื่อซ่อน',
    actions: html`<a class="button" href="/admin/projects/new">${icon('ph-plus')}เพิ่มผลงาน</a>`,
  })
}

function contactPage(saved, error, values) {
  const urls = values ?? Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, r.value]))
  return layout('ช่องทางติดต่อ', html`
    ${errorBox(error)}
    <form class="stack narrow" method="post" action="/admin/contact">
      ${SOCIALS.map(([key, label]) => html`<label class="social-field">
        <span class="brand-${key}">${icon(key)}${label}</span>
        <input type="url" name="${key}" value="${urls[key]}" placeholder="https://">
      </label>`)}
      <button>บันทึก</button>
    </form>`, { saved, active: 'contact', sub: 'เว้นว่างเพื่อซ่อนปุ่มนั้นจากหน้าเว็บ' })
}

function slotPage(slot, { error, replaced, alt = slot.alt } = {}) {
  return layout(slot.label, html`
    ${errorBox(error)}
    ${replaced && html`<p class="notice" role="status">เปลี่ยนรูปแล้ว กรุณาตรวจคำบรรยายให้ตรงกับรูปใหม่</p>`}
    <div class="preview">${thumb(slot.image, slot.alt)}</div>
    <form class="stack" method="post" enctype="multipart/form-data">
      <label>เปลี่ยนรูป (ไม่เลือกก็ได้) <input type="file" name="image" accept="${IMAGE_TYPES}"> ${FILE_HINT}</label>
      <label>คำบรรยายรูป (alt) <input name="alt" value="${alt}" maxlength="160" required></label>
      <button>บันทึก</button>
    </form>`, { active: groupOfSlot(slot.key)?.id })
}

function projectForm(project, { error, saved } = {}) {
  const isNew = !project.id
  const album = isNew ? [] : db.prepare('SELECT * FROM project_images WHERE project_id = ? ORDER BY sort, id').all(project.id)
  const savedTitle = isNew ? '' : db.prepare('SELECT title FROM projects WHERE id = ?').get(project.id)?.title
  return layout(isNew ? 'เพิ่มผลงาน' : savedTitle || 'แก้ไขผลงาน', html`
    ${errorBox(error)}
    ${!isNew && project.cover && html`<div class="preview">${thumb(project.cover, project.cover_alt)}</div>`}
    <form class="stack" method="post" enctype="multipart/form-data" action="${isNew ? '/admin/projects' : `/admin/projects/${project.id}`}">
      <label>ชื่อผลงาน <input name="title" value="${project.title}" maxlength="80" required></label>
      <label>ชื่อใน URL <input name="slug" value="${project.slug}" maxlength="80" pattern="[a-z0-9]+(-[a-z0-9]+)*" required aria-describedby="slug-hint">
        <small id="slug-hint">ใช้ a-z, 0-9 และขีดกลาง เช่น mae-rim-teak-garden</small></label>
      <div class="pair">
        <label>ประเภท <select name="type">${TYPES.map((t) => html`<option ${t === project.type && 'selected'}>${t}</option>`)}</select></label>
        <label>ปีที่แล้วเสร็จ <input type="number" name="year" value="${project.year}" min="1900" max="2100" required></label>
      </div>
      <div class="pair">
        <label>สถานที่ <input name="location" value="${project.location}" maxlength="80" required></label>
        <label>พื้นที่ <input name="area" value="${project.area}" maxlength="40" required></label>
      </div>
      <label>ข้อมูลร่มเงา <input name="shade" value="${project.shade}" maxlength="60" required></label>
      <label>คำอธิบายสำหรับ Google <textarea name="summary" rows="2" maxlength="160" required aria-describedby="summary-hint">${project.summary}</textarea>
        <small id="summary-hint">ไม่เกิน 160 ตัวอักษร</small></label>
      <label>รายละเอียดงาน <textarea name="body" rows="7" maxlength="3000" required aria-describedby="body-hint">${project.body}</textarea>
        <small id="body-hint">ขึ้นบรรทัดใหม่เพื่อแบ่งย่อหน้า</small></label>
      <label>รูปปก ${!isNew && '(ไม่เลือกก็ได้)'} <input type="file" name="cover" accept="image/jpeg,image/png,image/webp" ${isNew && 'required'}> ${FILE_HINT}</label>
      <label>คำบรรยายรูปปก (alt) <input name="cover_alt" value="${project.cover_alt}" maxlength="160" required></label>
      <div class="pair">
        <label>ลำดับบนหน้าเว็บ <input type="number" name="sort" value="${project.sort}" required></label>
        <label class="check"><input type="checkbox" name="published" ${project.published && 'checked'}> แสดงบนเว็บ</label>
      </div>
      <button>บันทึก</button>
    </form>
    ${!isNew && html`
    <section>
      <h2>อัลบั้มรูป</h2>
      <ul class="album">
        ${album.map((r, i) => html`<li>
          ${thumb(r.image, r.alt)}
          <form class="inline" method="post" action="/admin/images/${r.id}">
            <label>คำบรรยายรูป <input name="alt" value="${r.alt}" maxlength="160" required></label>
            <button class="tonal">บันทึก</button>
          </form>
          <div class="actions">
            <form method="post" action="/admin/images/${r.id}/move"><input type="hidden" name="by" value="-1"><button class="plain" ${i === 0 && 'disabled'} aria-label="ย้ายรูปขึ้น">ขึ้น</button></form>
            <form method="post" action="/admin/images/${r.id}/move"><input type="hidden" name="by" value="1"><button class="plain" ${i === album.length - 1 && 'disabled'} aria-label="ย้ายรูปลง">ลง</button></form>
            <form method="post" action="/admin/images/${r.id}/delete" data-confirm="ลบรูปนี้ถาวร?"><button class="danger">ลบ</button></form>
          </div>
        </li>`)}
      </ul>
      <form class="stack" method="post" enctype="multipart/form-data" action="/admin/projects/${project.id}/images">
        <h3>เพิ่มรูป</h3>
        <label>ไฟล์รูป <input type="file" name="image" accept="image/jpeg,image/png,image/webp" required> ${FILE_HINT}</label>
        <label>คำบรรยายรูป (alt) <input name="alt" maxlength="160" required></label>
        <button class="tonal">เพิ่มรูป</button>
      </form>
    </section>
    <section>
      <h2>ลบผลงาน</h2>
      <form method="post" action="/admin/projects/${project.id}/delete" data-confirm="ลบผลงานนี้และรูปทั้งหมดถาวร?"><button class="danger">ลบผลงานนี้</button></form>
    </section>`}`, { saved, active: 'projects' })
}

const EMPTY_PROJECT = { title: '', slug: '', type: TYPES[0], location: '', year: new Date().getFullYear(), area: '', shade: '', summary: '', body: '', cover_alt: '', published: 0, sort: 0 }

function readProjectFields(form) {
  const year = Number(text(form, 'year'))
  const sort = Number(text(form, 'sort'))
  const fields = {
    title: text(form, 'title'), slug: text(form, 'slug'), type: text(form, 'type'), location: text(form, 'location'),
    year, area: text(form, 'area'), shade: text(form, 'shade'), summary: text(form, 'summary'), body: text(form, 'body'),
    cover_alt: text(form, 'cover_alt'), published: form.get('published') ? 1 : 0, sort,
  }
  return fields
}

function validateProject(f) {
  requireText(f.title, 'ชื่อผลงาน', 80)
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.slug)) throw new UserError('ชื่อใน URL ใช้ได้เฉพาะ a-z, 0-9 และขีดกลาง')
  if (!TYPES.includes(f.type)) throw new UserError('ประเภทไม่ถูกต้อง')
  if (!Number.isInteger(f.year) || f.year < 1900 || f.year > 2100) throw new UserError('ปีไม่ถูกต้อง')
  if (!Number.isInteger(f.sort)) throw new UserError('ลำดับต้องเป็นตัวเลข')
  requireText(f.location, 'สถานที่', 80)
  requireText(f.area, 'พื้นที่', 40)
  requireText(f.shade, 'ข้อมูลร่มเงา', 60)
  requireText(f.summary, 'คำอธิบายสำหรับ Google', 160)
  requireText(f.body, 'รายละเอียดงาน', 3000)
  requireText(f.cover_alt, 'คำบรรยายรูปปก', 160)
  const other = db.prepare('SELECT id FROM projects WHERE slug = ?').get(f.slug)
  if (other && other.id !== f.id) throw new UserError('ชื่อใน URL นี้ถูกใช้แล้ว')
}

async function saveProject(id, form) {
  const existing = id ? db.prepare('SELECT * FROM projects WHERE id = ?').get(id) : null
  const fields = { ...readProjectFields(form), id }
  try {
    validateProject(fields)
    const file = form.get('cover')
    const hasFile = file && typeof file !== 'string' && file.size > 0
    const cover = hasFile || !existing ? await saveImage(file, fields.slug) : existing.cover
    const { id: _, ...values } = { ...fields, cover }
    const names = Object.keys(values)
    let projectId = id
    if (existing) {
      db.prepare(`UPDATE projects SET ${names.map((n) => `${n} = ?`).join(', ')}, updated_at = date('now') WHERE id = ?`)
        .run(...Object.values(values), id)
      if (cover !== existing.cover) await deleteImage(existing.cover)
    } else {
      projectId = db.prepare(`INSERT INTO projects (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`)
        .run(...Object.values(values)).lastInsertRowid
    }
    return { projectId }
  } catch (error) {
    if (!(error instanceof UserError)) throw error
    return { error: error.message, fields: { ...existing, ...fields } }
  }
}

const touchProject = (id) => db.prepare("UPDATE projects SET updated_at = date('now') WHERE id = ?").run(id)

async function postRoutes(req, res, path, form) {
  let m
  if ((m = path.match(/^\/admin\/slots\/([a-z0-9_]+)$/))) {
    const slot = db.prepare('SELECT * FROM site_images WHERE key = ?').get(m[1])
    if (!slot) return false
    try {
      const alt = requireText(text(form, 'alt'), 'คำบรรยายรูป', 160)
      const file = form.get('image')
      const image = file && typeof file !== 'string' && file.size > 0 ? await saveImage(file, slot.key) : slot.image
      db.prepare('UPDATE site_images SET image = ?, alt = ? WHERE key = ?').run(image, alt, slot.key)
      if (image !== slot.image) await deleteImage(slot.image)
      redirect(res, text(form, 'from') === 'card' ? `/admin/slots/${slot.key}?replaced=1` : `/admin/s/${groupOfSlot(slot.key)?.id}?saved=1`)
    } catch (error) {
      if (!(error instanceof UserError)) throw error
      send(res, 400, slotPage(slot, { error: error.message, alt: text(form, 'alt') }))
    }
    return true
  }

  if (path === '/admin/contact') {
    const save = db.prepare('UPDATE settings SET value = ? WHERE key = ?')
    const urls = ['line', 'facebook', 'tiktok'].map((key) => [key, text(form, key)])
    // Store the parsed href: it percent-encodes quotes and brackets, so the link is always one clean attribute.
    const parsed = urls.map(([, value]) => value && URL.parse(value))
    if (parsed.some((url, i) => urls[i][1] && (url?.protocol !== 'https:' || !url.hostname.includes('.')))) {
      send(res, 400, contactPage(false, 'ลิงก์ต้องขึ้นต้นด้วย https:// และเป็นที่อยู่เว็บที่ถูกต้อง', Object.fromEntries(urls)))
      return true
    }
    urls.forEach(([key], i) => save.run(parsed[i] ? parsed[i].href : '', key))
    redirect(res, '/admin/contact?saved=1')
    return true
  }

  if (path === '/admin/projects') {
    const result = await saveProject(null, form)
    if (result.error) send(res, 400, projectForm(result.fields, { error: result.error }))
    else redirect(res, `/admin/projects/${result.projectId}?saved=1`)
    return true
  }

  if ((m = path.match(/^\/admin\/projects\/(\d+)$/))) {
    const id = Number(m[1])
    if (!db.prepare('SELECT 1 FROM projects WHERE id = ?').get(id)) return false
    const result = await saveProject(id, form)
    if (result.error) send(res, 400, projectForm(result.fields, { error: result.error }))
    else redirect(res, `/admin/projects/${id}?saved=1`)
    return true
  }

  if ((m = path.match(/^\/admin\/projects\/(\d+)\/publish$/))) {
    const id = Number(m[1])
    if (!db.prepare('SELECT 1 FROM projects WHERE id = ?').get(id)) return false
    db.prepare("UPDATE projects SET published = 1 - published, updated_at = date('now') WHERE id = ?").run(id)
    redirect(res, text(form, 'next') === 'home' ? '/admin?saved=1' : '/admin/projects?saved=1')
    return true
  }

  if ((m = path.match(/^\/admin\/projects\/(\d+)\/delete$/))) {
    const id = Number(m[1])
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id)
    if (!project) return false
    const album = db.prepare('SELECT image FROM project_images WHERE project_id = ?').all(id)
    db.prepare('DELETE FROM projects WHERE id = ?').run(id)
    await Promise.all([project.cover, ...album.map((r) => r.image)].map(deleteImage))
    redirect(res, '/admin/projects?saved=1')
    return true
  }

  if ((m = path.match(/^\/admin\/projects\/(\d+)\/images$/))) {
    const id = Number(m[1])
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id)
    if (!project) return false
    try {
      const alt = requireText(text(form, 'alt'), 'คำบรรยายรูป', 160)
      const image = await saveImage(form.get('image'), project.slug)
      db.prepare(`INSERT INTO project_images (project_id, image, alt, sort)
        VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort), 0) + 1 FROM project_images WHERE project_id = ?))`).run(id, image, alt, id)
      touchProject(id)
      redirect(res, `/admin/projects/${id}?saved=1`)
    } catch (error) {
      if (!(error instanceof UserError)) throw error
      send(res, 400, projectForm(project, { error: error.message }))
    }
    return true
  }

  if ((m = path.match(/^\/admin\/images\/(\d+)(\/delete|\/move)?$/))) {
    const row = db.prepare('SELECT * FROM project_images WHERE id = ?').get(Number(m[1]))
    if (!row) return false
    if (m[2] === '/delete') {
      db.prepare('DELETE FROM project_images WHERE id = ?').run(row.id)
      await deleteImage(row.image)
    } else if (m[2] === '/move') {
      const album = db.prepare('SELECT id FROM project_images WHERE project_id = ? ORDER BY sort, id').all(row.project_id)
      const from = album.findIndex((r) => r.id === row.id)
      const to = from + (text(form, 'by') === '-1' ? -1 : 1)
      if (album[to]) {
        ;[album[from], album[to]] = [album[to], album[from]]
        const update = db.prepare('UPDATE project_images SET sort = ? WHERE id = ?')
        album.forEach((r, i) => update.run(i + 1, r.id))
      }
    } else {
      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(row.project_id)
      const alt = text(form, 'alt')
      if (!alt || alt.length > 160) { send(res, 400, projectForm(project, { error: 'กรุณากรอกคำบรรยายรูป ไม่เกิน 160 ตัวอักษร' })); return true }
      db.prepare('UPDATE project_images SET alt = ? WHERE id = ?').run(alt, row.id)
    }
    touchProject(row.project_id)
    redirect(res, `/admin/projects/${row.project_id}?saved=1`)
    return true
  }
  return false
}

function getRoutes(res, path, saved, replaced) {
  let m
  if (path === '/admin') { send(res, 200, dashboard(saved)); return true }
  if (path === '/admin/projects') { send(res, 200, projectsPage(saved)); return true }
  if (path === '/admin/contact') { send(res, 200, contactPage(saved)); return true }
  if ((m = path.match(/^\/admin\/s\/([a-z]+)$/))) {
    const group = GROUPS.find((g) => g.id === m[1])
    if (!group) return false
    send(res, 200, groupPage(group, saved))
    return true
  }
  if (path === '/admin/projects/new') { send(res, 200, projectForm(EMPTY_PROJECT)); return true }
  if ((m = path.match(/^\/admin\/projects\/(\d+)$/))) {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(Number(m[1]))
    if (!project) return false
    send(res, 200, projectForm(project, { saved }))
    return true
  }
  if ((m = path.match(/^\/admin\/slots\/([a-z0-9_]+)$/))) {
    const slot = db.prepare('SELECT * FROM site_images WHERE key = ?').get(m[1])
    if (!slot) return false
    send(res, 200, slotPage(slot, { replaced }))
    return true
  }
  return false
}

function notFound(res) {
  send(res, 404, layout('ไม่พบหน้านี้', html`<p class="empty card">หน้านี้ไม่มีอยู่หรือถูกลบไปแล้ว <a href="/admin">กลับไปหน้าภาพรวม</a></p>`))
  return true
}

// Returns false only before login (the login route with an unknown method), so the caller can answer 404.
export async function handleAdmin(req, res, url) {
  const path = url.pathname
  const token = cookie(req, 'sid')

  if (req.method === 'POST') {
    // SameSite=Strict already blocks forged posts in browsers; this also covers older clients.
    // Without Origin the Referer is checked instead; a request with neither is let through.
    const source = req.headers.origin ?? req.headers.referer
    if (source !== undefined && URL.parse(source)?.host !== req.headers.host) { send(res, 403, 'ปฏิเสธคำขอจากเว็บอื่น'); return true }
  }

  if (path === '/admin/login') {
    if (req.method === 'GET') {
      if (isLoggedIn(token)) redirect(res, '/admin')
      else send(res, 200, loginPage())
      return true
    }
    if (req.method !== 'POST') return false
    const ip = clientIp(req)
    if (loginBlocked(ip)) { send(res, 429, loginPage('ลองเข้าสู่ระบบผิดหลายครั้ง กรุณารอ 15 นาที')); return true }
    const form = await readForm(req)
    const session = await login(text(form, 'email'), String(form.get('password') ?? ''), ip)
    if (session) redirect(res, '/admin', { 'Set-Cookie': sessionCookie(session) })
    else send(res, 401, loginPage('อีเมลหรือรหัสผ่านไม่ถูกต้อง', text(form, 'email')))
    return true
  }

  if (!isLoggedIn(token)) {
    req.resume()
    redirect(res, '/admin/login')
    return true
  }

  if (req.method === 'GET') return getRoutes(res, path, url.searchParams.has('saved'), url.searchParams.has('replaced')) || notFound(res)
  if (req.method !== 'POST') return notFound(res)

  if (path === '/admin/logout') {
    req.resume()
    logout(token)
    redirect(res, '/admin/login', { 'Set-Cookie': sessionCookie('', 0) })
    return true
  }
  try {
    return await postRoutes(req, res, path, await readForm(req)) || notFound(res)
  } catch (error) {
    if (!(error instanceof UserError)) throw error
    send(res, 400, layout('บันทึกไม่สำเร็จ', html`${errorBox(error.message)}<a href="/admin">กลับหน้าจัดการ</a>`))
    return true
  }
}
