import { randomBytes } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { UPLOAD_DIR } from './db.mjs'

const WIDTHS = [480, 960, 1600]
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024

export class UserError extends Error {}

export function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'garden'
}

// The file type is decided by decoding the bytes, never by the name or header the browser sent.
export async function saveImage(file, baseName) {
  if (!file || typeof file === 'string' || file.size === 0) throw new UserError('กรุณาเลือกไฟล์รูป')
  if (file.size > MAX_IMAGE_BYTES) throw new UserError('ไฟล์รูปต้องไม่เกิน 8 MB')

  const bytes = Buffer.from(await file.arrayBuffer())
  const format = await sharp(bytes).metadata().then((m) => m.format, () => null)
  if (!['jpeg', 'png', 'webp'].includes(format)) throw new UserError('รองรับเฉพาะไฟล์ JPG, PNG และ WebP')

  const name = `${slugify(baseName)}-${randomBytes(4).toString('hex')}`
  for (const width of WIDTHS) {
    await sharp(bytes).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 80 })
      .toFile(join(UPLOAD_DIR, `${name}-${width}.webp`))
  }
  // JPEG because not every link preview bot reads WebP.
  await sharp(bytes).rotate().resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 82 })
    .toFile(join(UPLOAD_DIR, `${name}-og.jpg`))
  return name
}

export async function deleteImage(name) {
  const files = [...WIDTHS.map((w) => `${name}-${w}.webp`), `${name}-og.jpg`]
  await Promise.all(files.map((f) => rm(join(UPLOAD_DIR, f), { force: true })))
}

export function picture(name, alt) {
  const url = (w) => `/uploads/${name}-${w}.webp`
  return {
    src: url(960),
    full: url(1600),
    og: `/uploads/${name}-og.jpg`,
    srcset: WIDTHS.map((w) => `${url(w)} ${w}w`).join(', '),
    alt,
  }
}
