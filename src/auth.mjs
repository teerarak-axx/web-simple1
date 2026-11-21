import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { db } from './db.mjs'

const scryptAsync = promisify(scrypt)
const SESSION_MS = 7 * 24 * 60 * 60 * 1000
const MAX_FAILS = 5
const FAIL_WINDOW_MS = 15 * 60 * 1000
const fails = new Map()

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const key = await scryptAsync(password, salt, 64)
  return `${salt.toString('hex')}:${key.toString('hex')}`
}

async function verifyPassword(password, stored) {
  const [salt, key] = stored.split(':').map((part) => Buffer.from(part, 'hex'))
  return timingSafeEqual(await scryptAsync(password, salt, 64), key)
}

const DUMMY_HASH = await hashPassword(randomBytes(16).toString('hex'))
const tokenHash = (token) => createHash('sha256').update(token).digest('hex')

export function setAdminPassword(email, passwordHash) {
  db.prepare(`INSERT INTO admins (email, password_hash) VALUES (?, ?)
    ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash`).run(email, passwordHash)
  db.prepare('DELETE FROM sessions WHERE admin_id = (SELECT id FROM admins WHERE email = ?)').run(email)
}

// Render's proxy appends the real client to X-Forwarded-For, so only its last entry can be trusted;
// anywhere else the header is ignored because any client could set it.
export function clientIp(req) {
  const forwarded = process.env.RENDER && req.headers['x-forwarded-for']
  return forwarded ? forwarded.split(',').at(-1).trim() : req.socket.remoteAddress
}

// shortcut: counts in memory, so it resets on restart; behind a proxy other than Render it sees the
// proxy's address and limits all visitors together, so extend clientIp() when moving hosts.
export function loginBlocked(ip) {
  const entry = fails.get(ip)
  if (entry && entry.until < Date.now()) fails.delete(ip)
  return (fails.get(ip)?.count ?? 0) >= MAX_FAILS
}

// Returns a session token, or null when the credentials are wrong.
export async function login(email, password, ip) {
  const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email)
  // The dummy check keeps an unknown email as slow as a wrong password.
  const ok = await verifyPassword(password, admin?.password_hash ?? DUMMY_HASH)
  if (!admin || !ok) {
    const entry = fails.get(ip) ?? { count: 0, until: Date.now() + FAIL_WINDOW_MS }
    entry.count += 1
    fails.set(ip, entry)
    return null
  }
  fails.delete(ip)
  const token = randomBytes(32).toString('base64url')
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now())
  db.prepare('INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES (?, ?, ?)')
    .run(tokenHash(token), admin.id, Date.now() + SESSION_MS)
  return token
}

export function logout(token) {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token))
}

export function isLoggedIn(token) {
  if (!token) return false
  const row = db.prepare('SELECT expires_at FROM sessions WHERE token_hash = ?').get(tokenHash(token))
  return Boolean(row) && row.expires_at > Date.now()
}

export function sessionCookie(token, maxAgeSeconds = SESSION_MS / 1000) {
  const secure = (process.env.SITE_URL || '').startsWith('https:') ? '; Secure' : ''
  return `sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}${secure}`
}
