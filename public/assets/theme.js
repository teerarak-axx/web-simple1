// Runs before first paint (no defer) so the page never flashes the wrong theme.
(() => {
  let theme
  try { theme = localStorage.getItem('theme') } catch {}
  if (theme !== 'light' && theme !== 'dark') theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  document.documentElement.dataset.theme = theme
})()
