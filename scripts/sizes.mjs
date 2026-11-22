// Adds the missing -2000.webp for images uploaded before that size existed: npm run sizes
// Safe to run again: it only creates files that are absent and never deletes or overwrites.
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { db, UPLOAD_DIR } from '../src/db.mjs'

const names = new Set([
  ...db.prepare('SELECT image FROM site_images').all().map((r) => r.image),
  ...db.prepare('SELECT cover FROM projects').all().map((r) => r.cover),
  ...db.prepare('SELECT image FROM project_images').all().map((r) => r.image),
])

let made = 0
for (const name of names) {
  const from = join(UPLOAD_DIR, `${name}-1600.webp`)
  const to = join(UPLOAD_DIR, `${name}-2000.webp`)
  if (existsSync(to) || !existsSync(from)) continue
  await sharp(from).resize({ width: 2000, withoutEnlargement: true }).webp({ quality: 90 }).toFile(to)
  made++
}
console.log(`created ${made} file(s), checked ${names.size} image(s)`)
