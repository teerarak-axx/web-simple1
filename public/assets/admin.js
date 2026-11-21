for (const form of document.querySelectorAll('form[data-confirm]')) {
  form.addEventListener('submit', (event) => {
    if (!confirm(form.dataset.confirm)) event.preventDefault()
  })
}

// Google-style ripple from where the button was pressed
document.addEventListener('pointerdown', (event) => {
  const target = event.target.closest('button:not(.switch), .button')
  if (!target || target.disabled || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const box = target.getBoundingClientRect()
  const ripple = document.createElement('span')
  ripple.className = 'ripple'
  ripple.style.setProperty('--x', `${event.clientX - box.left}px`)
  ripple.style.setProperty('--y', `${event.clientY - box.top}px`)
  ripple.addEventListener('animationend', () => ripple.remove())
  target.append(ripple)
})

// Dark mode toggle; theme.js already set data-theme before first paint
const themeToggle = document.querySelector('.theme-toggle')
if (themeToggle) {
  const root = document.documentElement
  themeToggle.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'))
  themeToggle.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'
    try { localStorage.setItem('theme', root.dataset.theme) } catch {}
    themeToggle.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'))
  })
}

for (const form of document.querySelectorAll('form[data-autosubmit]')) {
  form.addEventListener('change', () => {
    form.closest('section, article')?.classList.add('busy')
    form.submit()
  })
}

// Summary numbers count up from 0; the server already wrote the final value for no-JS and reduced motion
const counters = [...document.querySelectorAll('[data-count]')]
if (counters.length && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const start = performance.now()
  const tick = (now) => {
    const t = Math.min(1, (now - start) / 600)
    const eased = 1 - (1 - t) ** 3
    for (const el of counters) el.textContent = Math.round(Number(el.dataset.count) * eased)
    if (t < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

// On a narrow screen the bottom menu scrolls sideways: bring the current page's button into view
if (matchMedia('(max-width: 760px)').matches) {
  document.querySelector('.side a.on')?.scrollIntoView({ inline: 'center', block: 'nearest' })
}
