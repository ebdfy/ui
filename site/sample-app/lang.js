// The sample app's language, kept on its own origin so it holds from page to page and after a
// reload. A plain script in each page's head, so the page has its language before any element draws.
{
  const key = 'ebdfy-sample-lang'
  document.documentElement.lang = localStorage.getItem(key) ?? 'en'

  // The language buttons are a segmented group with the page's language pressed. A press keeps the
  // choice and fires sample-lang on the document, on which the page draws its words again.
  document.addEventListener('DOMContentLoaded', () => {
    const buttons = [...document.querySelectorAll('.languages [data-lang]')]
    const press = () => {
      for (const button of buttons) button.pressed = String(button.dataset.lang === document.documentElement.lang)
    }
    for (const button of buttons) {
      button.addEventListener('click', () => {
        localStorage.setItem(key, button.dataset.lang)
        document.documentElement.lang = button.dataset.lang
        press()
        document.dispatchEvent(new Event('sample-lang'))
      })
    }
    press()
  })
}
