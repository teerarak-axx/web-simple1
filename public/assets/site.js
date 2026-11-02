// Reveal once on entry; everything is shown anyway after load in case the observer never fires.
const targets = [...document.querySelectorAll('[data-reveal]')]
const io = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue
    entry.target.classList.add('is-in')
    io.unobserve(entry.target)
  }
}, { rootMargin: '0px 0px -8% 0px' })
targets.forEach((el) => io.observe(el))
addEventListener('load', () => setTimeout(() => targets.forEach((el) => el.classList.add('is-in')), 4000))

const bar = document.querySelector('.bar')
const setBar = () => bar.classList.toggle('solid', scrollY > 40)
addEventListener('scroll', setBar, { passive: true })
setBar()

const menu = document.querySelector('.menu')
menu.addEventListener('click', (event) => { if (event.target.closest('a')) menu.open = false })

// Crossfades the hero; without script, or with reduced motion, the first picture stays.
const slides = document.querySelectorAll('.slide')
slides[0]?.classList.add('on')
if (slides.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  let current = 0
  setInterval(() => {
    if (document.hidden) return
    slides[current].classList.remove('on')
    current = (current + 1) % slides.length
    slides[current].classList.add('on')
  }, 5000)
}

const box = document.querySelector('.lightbox')
if (box) {
  const links = [...document.querySelectorAll('[data-lightbox]')]
  const image = box.querySelector('img')
  let current = 0
  const show = (i) => {
    current = (i + links.length) % links.length
    image.src = links[current].href
    image.alt = links[current].querySelector('img').alt
  }
  links.forEach((link, i) => link.addEventListener('click', (event) => {
    event.preventDefault()
    show(i)
    box.showModal()
  }))
  box.querySelector('[data-prev]').addEventListener('click', () => show(current - 1))
  box.querySelector('[data-next]').addEventListener('click', () => show(current + 1))
  box.querySelector('[data-close]').addEventListener('click', () => box.close())
  box.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') show(current - 1)
    if (event.key === 'ArrowRight') show(current + 1)
  })
}
