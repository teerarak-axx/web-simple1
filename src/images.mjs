import { randomBytes } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { UPLOAD_DIR } from './db.mjs'

const WIDTHS = [480, 960, 1600, 2000]
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
// About 150 MB once decoded, which the 512 MB host can afford; a 48 MP phone photo still fits.
const MAX_PIXELS = 50_000_000
const decode = (bytes) => sharp(bytes, { limitInputPixels: MAX_PIXELS })

export class UserError extends Error {}

export function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'garden'
}

// The file type is decided by decoding the bytes, never by the name or header the browser sent.
export async function saveImage(file, baseName) {
  if (!file || typeof file === 'string' || file.size === 0) throw new UserError('กรุณาเลือกไฟล์รูป')
  if (file.size > MAX_IMAGE_BYTES) throw new UserError('ไฟล์รูปต้องไม่เกิน 8 MB')

  const bytes = Buffer.from(await file.arrayBuffer())
  // Header only, so no pixel limit here; a limit would turn a too-large image into a wrong-format message.
  const meta = await sharp(bytes, { limitInputPixels: false }).metadata().catch(() => null)
  if (!['jpeg', 'png', 'webp'].includes(meta?.format)) throw new UserError('รองรับเฉพาะไฟล์ JPG, PNG และ WebP')
  if (meta.width * meta.height > MAX_PIXELS) throw new UserError('รูปมีขนาดพิกเซลใหญ่เกินไป กรุณาย่อรูปให้ไม่เกิน 50 ล้านพิกเซล')

  const name = `${slugify(baseName)}-${randomBytes(4).toString('hex')}`
  try {
    for (const width of WIDTHS) {
      await decode(bytes).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 90 })
        .toFile(join(UPLOAD_DIR, `${name}-${width}.webp`))
    }
    // JPEG because not every link preview bot reads WebP.
    await decode(bytes).rotate().resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 82 })
      .toFile(join(UPLOAD_DIR, `${name}-og.jpg`))
  } catch {
    // The header was readable but the pixels were not: remove whatever sizes were already written.
    await deleteImage(name)
    throw new UserError('ไฟล์รูปเสียหรือไม่สมบูรณ์ กรุณาลองไฟล์อื่น')
  }
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
