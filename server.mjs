import { createReadStream } from 'node:fs'
import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { handleAdmin, SECURITY_HEADERS } from './src/admin.mjs'
import { DATA_DIR, db, UPLOAD_DIR } from './src/db.mjs'
import { escapeHtml } from './src/html.mjs'
import { homePage, notFoundPage, projectPage, robotsTxt, sitemapXml } from './src/site.mjs'

const PUBLIC_DIR = join(import.meta.dirname, 'public', 'assets')
const MIME = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.jpg': 'image/jpeg' }
const COMMON_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' }

function sendPage(req, res, status, body, type = 'text/html; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type })
  res.end(req.method === 'HEAD' ? undefined : String(body))
}

async function sendFile(req, res, file, cacheControl) {
  const info = await stat(file).catch(() => null)
  if (!info?.isFile()) return false
  const etag = `"${info.size}-${info.mtimeMs}"`
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag, 'Cache-Control': cacheControl })
    return res.end(), true
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)], 'Content-Length': info.size, 'Cache-Control': cacheControl, ETag: etag })
  if (req.method === 'HEAD') res.end()
  else createReadStream(file).pipe(res)
  return true
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost')
  const path = url.pathname

  if (path === '/admin' || path.startsWith('/admin/')) {
    if (await handleAdmin(req, res, url)) return
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value)
    return sendPage(req, res, 404, notFoundPage())
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' })
    return res.end()
  }

  if (path === '/') return sendPage(req, res, 200, homePage())
  if (path === '/sitemap.xml') return sendPage(req, res, 200, sitemapXml(), 'application/xml; charset=utf-8')
  if (path === '/robots.txt') return sendPage(req, res, 200, robotsTxt(), 'text/plain; charset=utf-8')

  const slug = path.match(/^\/projects\/([a-z0-9-]+)$/)?.[1]
  const page = slug && projectPage(slug)
  if (page) return sendPage(req, res, 200, page)

  // These patterns allow no slash or dots in the name, so a request cannot leave its folder.
  const asset = path.match(/^\/assets\/([a-z]+\.(?:css|js))$/)?.[1]
  if (asset && await sendFile(req, res, join(PUBLIC_DIR, asset), 'no-cache')) return
  const upload = path.match(/^\/uploads\/([a-z0-9-]+\.(?:webp|jpg))$/)?.[1]
  if (upload && await sendFile(req, res, join(UPLOAD_DIR, upload), 'public, max-age=31536000, immutable')) return

  sendPage(req, res, 404, notFoundPage())
}

export const server = createServer((req, res) => {
  for (const [name, value] of Object.entries(COMMON_HEADERS)) res.setHeader(name, value)
  handle(req, res).catch((error) => {
    console.error(error)
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(`<!doctype html><html lang="th"><meta charset="utf-8"><title>${escapeHtml('เกิดข้อผิดพลาด')}</title><p>เกิดข้อผิดพลาด กรุณาลองใหม่</p></html>`)
  })
})

const BACKUP_KEEP = 7

async function backup() {
  const dir = join(DATA_DIR, 'backups')
  await mkdir(dir, { recursive: true })
  const file = join(dir, `site-${new Date().toISOString().slice(0, 10)}.db`)
  await rm(file, { force: true })
  db.prepare('VACUUM INTO ?').run(file)
  // shortcut: this copy only grows and keeps deleted pictures; prune it by hand if the disk fills.
  await cp(UPLOAD_DIR, join(dir, 'uploads'), { recursive: true, force: false })
  const old = (await readdir(dir)).filter((f) => f.endsWith('.db')).sort().slice(0, -BACKUP_KEEP)
  await Promise.all(old.map((f) => rm(join(dir, f))))
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 8090
  server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`http://127.0.0.1:${port}`))
  const runBackup = () => backup().catch((error) => console.error('backup failed', error))
  runBackup()
  setInterval(runBackup, 24 * 60 * 60 * 1000)
}
