// The docs theme switch. System follows the device, Light and Dark set data-theme on <html>, which
// the design tokens read. The choice is kept per viewer; a page without storage still switches.
const key = 'ebdfy-docs-theme'
const root = document.documentElement

function stored() {
  try {
    const value = localStorage.getItem(key)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

function choose(choice, save) {
  if (choice === 'system') delete root.dataset.theme
  else root.dataset.theme = choice
  if (save) {
    try {
      if (choice === 'system') localStorage.removeItem(key)
      else localStorage.setItem(key, choice)
    } catch {
      // Without storage the choice lasts until the page closes.
    }
  }
  for (const button of document.querySelectorAll('[data-theme-choice]')) {
    // An attribute, since this runs before eb-button is defined.
    button.setAttribute('pressed', String(button.dataset.themeChoice === choice))
  }
}

// Runs in <head>, so the stored theme is on <html> before the first paint.
choose(stored(), false)
document.addEventListener('DOMContentLoaded', () => {
  choose(stored(), false)
  for (const button of document.querySelectorAll('[data-theme-choice]')) {
    button.addEventListener('click', () => choose(button.dataset.themeChoice, true))
  }
})

// Copy puts an example's code on the clipboard. Where the browser refuses, it selects the code
// instead, so the reader can copy it with the keyboard.
document.addEventListener('click', async (event) => {
  const button = event.target instanceof Element ? event.target.closest('button.copy') : null
  if (!button) return
  const code = button.parentElement.querySelector('code')
  try {
    await navigator.clipboard.writeText(code.textContent)
    button.textContent = 'Copied'
  } catch {
    getSelection().selectAllChildren(code)
    button.textContent = 'Selected'
  }
  clearTimeout(button.reset)
  button.reset = setTimeout(() => (button.textContent = 'Copy'), 2000)
})

// Below 1024 px the Pages button opens every page in a drawer; closing it gives the button the focus.
// Search, or ⌘K on an Apple device and Ctrl+K elsewhere, opens a search over the pages' titles, and
// Enter opens the first that matches.
document.addEventListener('DOMContentLoaded', () => {
  const menu = document.querySelector('.bar .menu')
  const drawer = document.getElementById('drawer')
  if (menu && drawer) {
    menu.addEventListener('click', () => {
      drawer.showModal()
      menu.setAttribute('aria-expanded', 'true')
    })
    drawer.querySelector('.close').addEventListener('click', () => drawer.close())
    // A press on the backdrop lands on the dialog itself.
    drawer.addEventListener('click', (event) => event.target === drawer && drawer.close())
    drawer.addEventListener('close', () => {
      menu.setAttribute('aria-expanded', 'false')
      // Widened past 1024 px while open, the button is gone, so the focus goes to the page.
      if (menu.checkVisibility()) menu.focus()
      else document.getElementById('content').focus()
    })
    // A tablet turned to landscape shows the sidebar, so the drawer has no more to do.
    matchMedia('(min-width: 1024px)').addEventListener('change', (event) => event.matches && drawer.close())
  }

  const search = document.querySelector('.bar .search')
  const finder = document.getElementById('finder')
  if (!search || !finder) return
  const box = finder.querySelector('input')
  const options = [...finder.querySelectorAll('[role="option"]')]
  const none = finder.querySelector('.none')
  const filter = () => {
    const words = box.value.trim().toLowerCase()
    for (const option of options) option.hidden = !option.textContent.toLowerCase().includes(words)
    // The option Enter opens is marked.
    const first = options.find((option) => !option.hidden)
    for (const option of options) option.setAttribute('aria-selected', String(option === first))
    none.hidden = options.some((option) => !option.hidden)
  }
  const open = () => {
    if (finder.open) return
    box.value = ''
    filter()
    finder.showModal()
    box.focus()
  }
  search.addEventListener('click', open)
  box.addEventListener('input', filter)
  box.addEventListener('keydown', (event) => {
    const first = options.find((option) => !option.hidden)
    if (event.key === 'Enter' && first) location.href = first.querySelector('a').href
  })
  finder.addEventListener('click', (event) => event.target === finder && finder.close())
  finder.addEventListener('close', () => search.focus())
  const apple = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
  document.addEventListener('keydown', (event) => {
    // The K key wherever it sits, so a Bangla keyboard layout opens the search too.
    if (event.code !== 'KeyK' || event.altKey || event.shiftKey) return
    if (apple ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey) {
      event.preventDefault()
      open()
    }
  })
})
