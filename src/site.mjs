import { asset } from './assets.mjs'
import { db } from './db.mjs'
import { html, raw } from './html.mjs'
import { icon } from './icons.mjs'
import { picture } from './images.mjs'

const SITE = {
  name: 'เงาไม้ การ์เด้น',
  latinName: 'NGAO MAI GARDEN',
  phone: '02-000-0000',
  phoneHref: 'tel:+6620000000',
  email: 'hello@ngaomai.example',
  street: '88 ถนนตัวอย่าง ตำบลริมใต้',
  city: 'อำเภอแม่ริม เชียงใหม่ 50180',
  mailto: `mailto:hello@ngaomai.example?subject=${encodeURIComponent('ขอคุยเรื่องจัดสวน')}`,
}
const SERVICES = ['ออกแบบสวน', 'ออกแบบและจัดสวน', 'ดูแลสวนรายเดือน']

const baseUrl = () => (process.env.SITE_URL || 'http://127.0.0.1:8090').replace(/\/$/, '')
// Set SITE_INDEXABLE=1 only for a real company: the demo business must stay out of search results.
const robots = () => (process.env.SITE_INDEXABLE === '1' ? 'index,follow' : 'noindex,nofollow')

function projectCard(row) {
  return { ...row, url: `/projects/${row.slug}`, coverPic: picture(row.cover, row.cover_alt) }
}

const publishedProjects = () => db.prepare('SELECT * FROM projects WHERE published = 1 ORDER BY sort, year DESC').all()

function siteImages() {
  return Object.fromEntries(db.prepare('SELECT * FROM site_images').all().map((r) => [r.key, picture(r.image, r.alt)]))
}

// "<" is escaped so that text from the admin can never close the script tag.
function jsonLd(data) {
  return raw(`<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`)
}

const img = (pic, sizes, width, height, extra = html`loading="lazy"`) => html`<img src="${pic.src}" srcset="${pic.srcset}" sizes="${sizes}" width="${width}" height="${height}" alt="${pic.alt}" ${extra}>`

const NAV = [['/#top', 'Home'], ['/#about', 'About us'], ['/#services', 'Service'], ['/#gallery', 'Gallery'], ['/#contact', 'Contact us']]

function layout({ title, description, canonical, ogImage, ogType = 'website', ld, content }) {
  const logo = siteImages().logo
  return html`<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta name="robots" content="${robots()}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="${ogType}">
  <meta property="og:site_name" content="${SITE.name}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${canonical}">
  ${ogImage && html`<meta property="og:image" content="${ogImage}">`}
  <meta name="twitter:card" content="summary_large_image">
  <script>document.documentElement.classList.add('js')</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Forum&family=Kanit:wght@300;400;500&family=Poppins:wght@400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${asset('site.css')}">
  ${ld}
</head>
<body>
  <a class="skip" href="#main">ข้ามไปเนื้อหา</a>
  <header class="bar">
    <div class="bar-in">
      <a class="brand" href="/">${logo && html`<img src="${logo.src}" width="70" height="70" alt="">`}${SITE.latinName}</a>
      <nav class="nav" aria-label="เมนูหลัก">${NAV.map(([href, label]) => html`<a href="${href}">${label}</a>`)}</nav>
      <details class="menu"><summary>เมนู</summary><div>${NAV.map(([href, label]) => html`<a href="${href}">${label}</a>`)}</div></details>
    </div>
  </header>
  <main id="main">${content}</main>
  <footer class="foot wrap">
    <p>© ${new Date().getFullYear()} ${SITE.latinName} CO., LTD. ALL RIGHTS RESERVED.</p>
    <p class="foot-note">เว็บตัวอย่าง บริษัท ผลงาน และข้อมูลติดต่อทั้งหมดเป็นเรื่องสมมุติ รูปภาพสร้างด้วย AI</p>
  </footer>
  <script src="${asset('site.js')}" defer></script>
</body>
</html>`
}

const SERVICE_CARDS = [
  ['service_design', 'ออกแบบสวน', 'แบบสามมิติ ผังต้นไม้ และรายการวัสดุ คุณนำแบบไปจ้างผู้รับเหมาเจ้าใดก็ได้'],
  ['service_build', 'ออกแบบและจัดสวน', 'เราทำตั้งแต่แบบจนถึงวันส่งมอบ รวมงานระบบน้ำ ไฟสวน พื้นทางเดิน และสวนแนวตั้ง'],
  ['service_care', 'ดูแลสวนรายเดือน', 'ตัดแต่ง ใส่ปุ๋ย และเปลี่ยนต้นที่โทรม จ้างเป็นรายเดือนหรือเรียกเป็นครั้งก็ได้'],
]

const SOCIALS = [['line', 'LINE'], ['facebook', 'Facebook'], ['tiktok', 'TikTok']]

function socialLinks() {
  const urls = Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, r.value]))
  return SOCIALS.filter(([key]) => urls[key]).map(([key, label], i) => html`<a class="social social-${key}" data-reveal style="--d:${i * 60}ms" href="${urls[key]}" target="_blank" rel="noopener" aria-label="${label}">${icon(key)}</a>`)
}

export function homePage() {
  const base = baseUrl()
  const pics = siteImages()
  const rows = publishedProjects()
  const albumOf = db.prepare('SELECT * FROM project_images WHERE project_id = ? ORDER BY sort, id')
  const photos = rows.flatMap((row) => {
    const url = `/projects/${row.slug}`
    return [{ url, pic: picture(row.cover, row.cover_alt) }, ...albumOf.all(row.id).map((r) => ({ url, pic: picture(r.image, r.alt) }))]
  })
  // Project covers fill the gallery first so every project is reachable from the one page.
  const covers = rows.map((row) => ({ url: `/projects/${row.slug}`, pic: picture(row.cover, row.cover_alt) }))
  const gallery = [...covers, ...photos.filter((p) => !covers.some((c) => c.pic.src === p.pic.src))].slice(0, 8)
  const latest = photos.filter((p) => !gallery.includes(p) && !gallery.some((g) => g.pic.src === p.pic.src)).slice(0, 4)
  const slides = [pics.hero, pics.hero_2, pics.hero_3]

  const content = html`
<section class="slider" id="top">
  ${slides.map((pic, i) => html`<div class="slide">${img(pic, '100vw', 1600, 900, i === 0 ? html`fetchpriority="high"` : html`loading="lazy"`)}</div>`)}
  <div class="slider-text">
    <h1>${SITE.latinName} <span>รับออกแบบจัดสวน</span></h1>
    <p>บริษัทออกแบบสวนและภูมิทัศน์ ขึ้นแบบสามมิติให้ตรงกับบ้านของคุณ</p>
  </div>
</section>

<section class="about wrap" id="about">
  <figure class="about-pic" data-reveal>${img(pics.about, '(max-width: 760px) 100vw, 456px', 960, 1280)}
    <figcaption>- projects from 2015-2025</figcaption></figure>
  <div class="about-text" data-reveal style="--d:120ms">
    <p class="label">Welcome to</p>
    <h2>${SITE.latinName}</h2>
    <h3>บริษัท เงาไม้ การ์เด้น จำกัด</h3>
    <p>เราเริ่มจากคนรักต้นไม้กลุ่มเล็ก ๆ ที่เชื่อว่าสวนที่ดีต้องให้ร่มก่อนให้ความสวย เราจึงเดินดูแดดบนที่ดินของคุณ แล้ววางต้นไม้ให้ร่มตกตรงที่คุณจะนั่งจริง ลูกค้าเก่าบอกต่อจนงานเติบโตมาถึงทุกวันนี้</p>
    <a class="more" href="#contact">READ MORE <span>➝</span></a>
  </div>
</section>

<section class="quote wrap" aria-label="แนวคิดของเรา">
  <blockquote data-reveal>เริ่มจาก<em>ร่มเงาที่ใช้ได้จริง</em>
    <strong>เติบโตเป็นสวนที่อยู่สบาย</strong>
    ในงบที่เหมาะกับบ้านของคุณ</blockquote>
  <div data-reveal style="--d:120ms">${img(pics.quote, '(max-width: 760px) 100vw, 285px', 960, 1280)}</div>
</section>

<section class="feature wrap" aria-label="ภาพผลงาน">
  <div data-reveal>${img(pics.feature, '(max-width: 760px) 100vw, 721px', 1600, 900)}</div>
</section>

<div class="band">
  <section class="mission wrap">
    <div data-reveal>
      <p class="label">MISSION</p>
      <h2>${SITE.latinName}</h2>
      <p>เราตั้งใจเป็นทีมภูมิทัศน์ที่ทำงานครบในที่เดียว ตั้งแต่งานออกแบบ งานโครงสร้างในสวน ไปจนถึงต้นไม้ที่แข็งแรง เพื่อให้บ้านแต่ละหลังมีบรรยากาศใหม่ที่อยู่ได้จริงทุกวัน</p>
    </div>
    <div data-reveal style="--d:120ms">${img(pics.mission_1, '(max-width: 760px) 100vw, 485px', 1600, 1200)}</div>
    <div data-reveal>${img(pics.mission_2, '(max-width: 760px) 100vw, 485px', 1600, 1200)}</div>
    <div data-reveal style="--d:120ms">
      <p>สำหรับงานพื้นที่ส่วนรวม เราอยากพาธรรมชาติมาใกล้ผู้คนให้มากที่สุด ทั้งร้านค้า รีสอร์ต และสำนักงาน โดยดูแลงานจนถึงวันส่งมอบ เพื่อให้สวนทั้งสวยและใช้งานสะดวก</p>
      <a class="more" href="#gallery">VIEW MORE <span>➝</span></a>
    </div>
  </section>

  <section class="services wrap" id="services">
    <h2 data-reveal>SERVICE</h2>
    <p data-reveal>บริษัท เงาไม้ การ์เด้น จำกัด ให้บริการดังนี้</p>
    <div class="cards">
      ${SERVICE_CARDS.map(([key, title, text], i) => html`<article data-reveal style="--d:${i * 100}ms">
        ${img(pics[key], '(max-width: 760px) 100vw, 331px', 960, 720)}
        <h3>${title}</h3><p>${text}</p>
        <a class="more" href="#contact" aria-label="ติดต่อเรื่อง${title}">READ MORE <span>➝</span></a>
      </article>`)}
    </div>
  </section>

  <section class="gallery wrap" id="gallery">
    <h2 data-reveal>NGAO MAI GALLERY</h2>
    <div class="grid">
      ${gallery.map((g) => html`<a href="${g.url}">${img(g.pic, '(max-width: 760px) 50vw, 265px', 960, 720)}</a>`)}
    </div>
  </section>
</div>

${latest.length > 0 && html`<section class="latest wrap">
  <h2 data-reveal>LATEST FROM OUR GARDENS</h2>
  <div class="latest-row">${latest.map((g) => html`<a href="${g.url}">${img(g.pic, '(max-width: 760px) 50vw, 285px', 960, 960)}</a>`)}</div>
</section>`}

<div class="meet wrap">
  <section class="team">
    <p class="label">NGAO MAI</p>
    <h2>OUR TEAM</h2>
    ${img(pics.team, '(max-width: 760px) 100vw, 740px', 1600, 1200)}
  </section>
  <section class="touch" id="contact">
    <p class="label">Contact us</p>
    <h2>GET IN TOUCH</h2>
    <p class="touch-line">${icon('lu-phone')}<a href="${SITE.phoneHref}">${SITE.phone}</a></p>
    <p class="touch-line">${icon('lu-mail')}<a href="${SITE.mailto}">${SITE.email}</a></p>
    <p>${SITE.street}<br>${SITE.city}</p>
    <p>จันทร์ถึงเสาร์ 09:00–17:30</p>
    <div class="socials">${socialLinks()}</div>
  </section>
</div>`

  return layout({
    title: `${SITE.name} | รับออกแบบจัดสวน เชียงใหม่ กรุงเทพฯ`,
    description: 'สตูดิโอออกแบบและจัดสวนที่เริ่มจากร่มเงา ดูผลงานสวนบ้าน คาเฟ่ รีสอร์ต และสำนักงาน พร้อมบริการดูแลสวนรายเดือน',
    canonical: `${base}/`,
    ogImage: base + pics.og.og,
    ld: jsonLd({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: SITE.name,
      url: `${base}/`,
      image: base + pics.og.og,
      telephone: SITE.phone,
      email: SITE.email,
      address: {
        '@type': 'PostalAddress',
        streetAddress: SITE.street,
        addressLocality: 'แม่ริม',
        addressRegion: 'เชียงใหม่',
        postalCode: '50180',
        addressCountry: 'TH',
      },
      makesOffer: SERVICES.map((name) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name } })),
    }),
    content,
  })
}

// Returns null for an unknown or unpublished slug.
export function projectPage(slug) {
  const all = publishedProjects()
  const index = all.findIndex((p) => p.slug === slug)
  if (index < 0) return null

  const base = baseUrl()
  const project = projectCard(all[index])
  const next = projectCard(all[(index + 1) % all.length])
  const album = db.prepare('SELECT * FROM project_images WHERE project_id = ? ORDER BY sort, id').all(project.id)
    .map((r) => picture(r.image, r.alt))
  const url = base + project.url

  const content = html`
<section class="project-hero">
  ${img(project.coverPic, '100vw', 1600, 900, html`fetchpriority="high"`)}
  <div><div class="wrap">
    <nav aria-label="เส้นทาง" class="crumbs"><a href="/">หน้าแรก</a> / <a href="/#gallery">ผลงาน</a></nav>
    <h1>${project.title}</h1>
    <p>${project.summary}</p>
  </div></div>
</section>

<section class="brief wrap">
  <div class="brief-text">
    <h2 data-reveal>เกี่ยวกับงานนี้</h2>
    ${project.body.split(/\n+/).filter(Boolean).map((text) => html`<p data-reveal style="--d:80ms">${text}</p>`)}
  </div>
  <dl data-reveal style="--d:120ms">
    <div><dt>ประเภท</dt><dd>${project.type}</dd></div>
    <div><dt>สถานที่</dt><dd>${project.location}</dd></div>
    <div><dt>ปีที่แล้วเสร็จ</dt><dd>${project.year}</dd></div>
    <div><dt>พื้นที่</dt><dd>${project.area}</dd></div>
    <div><dt>ร่มเงา</dt><dd>${project.shade}</dd></div>
  </dl>
</section>

${album.length > 0 && html`
<section class="album">
  <h2 data-reveal>ภาพจากงานนี้</h2>
  <div class="album-grid wrap">
    ${album.map((pic) => html`<a href="${pic.full}" data-lightbox data-reveal>${img(pic, '(max-width: 700px) 100vw, 50vw', 960, 720)}</a>`)}
  </div>
</section>`}

<a class="next wrap" href="${next.url}"><span>ผลงานถัดไป</span><strong>${next.title}</strong></a>

<dialog class="lightbox" aria-label="ภาพขยาย">
  <img alt="">
  <button type="button" data-prev aria-label="ภาพก่อนหน้า">ก่อนหน้า</button>
  <button type="button" data-next aria-label="ภาพถัดไป">ถัดไป</button>
  <button type="button" data-close aria-label="ปิดภาพขยาย">ปิด</button>
</dialog>`

  return layout({
    title: `${project.title} | ผลงาน ${SITE.name}`,
    description: project.summary,
    canonical: url,
    ogImage: base + project.coverPic.og,
    ogType: 'article',
    ld: jsonLd([
      {
        '@context': 'https://schema.org',
        '@type': 'CreativeWork',
        name: project.title,
        description: project.summary,
        url,
        dateCreated: String(project.year),
        locationCreated: { '@type': 'Place', name: project.location },
        creator: { '@type': 'LocalBusiness', name: SITE.name, url: `${base}/` },
        image: [project.coverPic, ...album].map((p) => base + p.full),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'หน้าแรก', item: `${base}/` },
          { '@type': 'ListItem', position: 2, name: 'ผลงาน', item: `${base}/#gallery` },
          { '@type': 'ListItem', position: 3, name: project.title, item: url },
        ],
      },
    ]),
    content,
  })
}

export function notFoundPage() {
  return layout({
    title: `ไม่พบหน้านี้ | ${SITE.name}`,
    description: 'ไม่พบหน้าที่คุณต้องการ',
    canonical: `${baseUrl()}/`,
    content: html`
<section class="missing">
  <h1>ไม่พบหน้านี้</h1>
  <p>ผลงานนี้อาจถูกย้ายหรือถูกนำออกแล้ว</p>
  <a class="button" href="/#gallery">ดูผลงานทั้งหมด</a>
</section>`,
  })
}

const xmlEscape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function sitemapXml() {
  const base = baseUrl()
  const albumOf = db.prepare('SELECT image FROM project_images WHERE project_id = ? ORDER BY sort, id')
  const urls = [`<url><loc>${xmlEscape(base)}/</loc></url>`]
  for (const p of publishedProjects()) {
    const pics = [p.cover, ...albumOf.all(p.id).map((r) => r.image)]
      .map((name) => `<image:image><image:loc>${xmlEscape(base + picture(name, '').full)}</image:loc></image:image>`)
      .join('')
    urls.push(`<url><loc>${xmlEscape(`${base}/projects/${p.slug}`)}</loc><lastmod>${p.updated_at}</lastmod>${pics}</url>`)
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>
`
}

// noindex needs crawling to be seen, so robots.txt never blocks public pages or image files.
export function robotsTxt() {
  return `User-agent: *\nDisallow: /admin\nSitemap: ${baseUrl()}/sitemap.xml\n`
}
