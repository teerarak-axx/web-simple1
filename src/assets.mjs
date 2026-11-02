import { statSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(import.meta.dirname, '..', 'public', 'assets')

// The file's edit time in the URL means browsers can never pair new HTML with an old cached file.
export const asset = (name) => `/assets/${name}?v=${Math.round(statSync(join(DIR, name)).mtimeMs)}`
