import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { raw } from './html.mjs'

const cache = new Map()

// Brand marks are from simple-icons (CC0), admin interface icons from Phosphor Icons (MIT, regular weight), and the
// public site's phone and mail icons (lu-*) from lucide (ISC).
export function icon(name) {
  if (!cache.has(name)) {
    let svg = readFileSync(join(import.meta.dirname, 'icons', `${name}.svg`), 'utf8')
      .replace(/<!--.*?-->\s*/s, '').replace(/<title>.*?<\/title>/, '').replace(/ role="img"/, '')
      .replace('<svg', '<svg aria-hidden="true"')
    // A size in the markup keeps icons small even if a stale stylesheet is served.
    if (!/\swidth=/.test(svg)) svg = svg.replace('<svg', '<svg width="24" height="24"')
    cache.set(name, raw(svg))
  }
  return cache.get(name)
}
