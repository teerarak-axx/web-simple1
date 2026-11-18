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

for (const form of document.querySelectorAll('form[data-autosubmit]')) {
  form.addEventListener('change', () => {
    form.closest('section, article')?.classList.add('busy')
    form.submit()
  })
}

// On a narrow screen the bottom menu scrolls sideways: bring the current page's button into view
if (matchMedia('(max-width: 760px)').matches) {
  document.querySelector('.side a.on')?.scrollIntoView({ inline: 'center', block: 'nearest' })
}
