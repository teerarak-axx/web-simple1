class Safe {
  constructor(value) { this.value = value }
  toString() { return this.value }
}

export const raw = (value) => new Safe(value)

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function render(value) {
  if (value instanceof Safe) return value.value
  if (Array.isArray(value)) return value.map(render).join('')
  if (value === null || value === undefined || value === false) return ''
  return escapeHtml(value)
}

// Every interpolated value is escaped unless it came from html`` or raw().
export function html(strings, ...values) {
  return new Safe(strings.reduce((out, text, i) => out + text + (i < values.length ? render(values[i]) : ''), ''))
}
