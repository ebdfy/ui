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
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === choice))
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
