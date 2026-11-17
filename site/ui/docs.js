// The docs' one script. The Copy buttons wait hidden until it runs. Copy puts an example's code on the clipboard; where the browser refuses, it
// selects the code instead, so the reader can copy it with the keyboard. The pages need none of this
// to read or to link.
for (const button of document.querySelectorAll('button.copy')) button.hidden = false
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

// An example's Print prints that example alone: docs.css hides every other example in print while the
// one pressed is marked, until the print dialog closes.
for (const button of document.querySelectorAll('button.print')) button.hidden = false
document.addEventListener('click', (event) => {
  const example = event.target instanceof Element ? event.target.closest('button.print')?.closest('.example') : null
  if (!example) return
  example.toggleAttribute('data-printing', true)
  addEventListener('afterprint', () => example.removeAttribute('data-printing'), { once: true })
  print()
})

// The search: Search, or ⌘K on an Apple device and Ctrl K elsewhere, opens it over the pages' titles.
// A title that starts with the words comes before one that only holds them, and Enter opens the
// first. The K key counts wherever it sits, so a Bangla keyboard layout opens it too.
const tools = document.querySelector('.bar .tools')
const search = document.querySelector('.bar .search')
const finder = document.getElementById('finder')
if (tools && search && finder) {
  tools.hidden = false
  const box = finder.querySelector('input')
  const list = finder.querySelector('[role="listbox"]')
  const options = [...list.querySelectorAll('[role="option"]')]
  const none = finder.querySelector('.none')
  const filter = () => {
    const words = box.value.trim().toLowerCase()
    const title = (option) => option.textContent.toLowerCase()
    const starts = options.filter((option) => title(option).startsWith(words))
    const holds = options.filter((option) => !title(option).startsWith(words) && title(option).includes(words))
    for (const option of options) option.hidden = true
    for (const option of [...starts, ...holds]) {
      option.hidden = false
      list.append(option)
    }
    const first = starts[0] ?? holds[0]
    for (const option of options) option.setAttribute('aria-selected', String(option === first))
    none.hidden = Boolean(first)
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
    const first = list.querySelector('[aria-selected="true"] a')
    if (event.key === 'Enter' && first) location.href = first.href
  })
  // A press on the backdrop lands on the dialog itself.
  finder.addEventListener('click', (event) => event.target === finder && finder.close())
  finder.addEventListener('close', () => search.focus())
  const apple = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
  document.addEventListener('keydown', (event) => {
    if (event.code !== 'KeyK' || event.altKey || event.shiftKey) return
    if (apple ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey) {
      event.preventDefault()
      open()
    }
  })
}

// বাংলা and English set the page's language, which the kit's own words and type follow, and swap
// the words a page gives in both (data-en and data-bn). The choice is kept for the next page, which
// takes it before its first paint; without storage it lasts until the page closes.
const languages = document.querySelector('.bar e-button-group')
const say = (lang) => {
  document.documentElement.lang = lang
  for (const button of languages.querySelectorAll('e-button'))
    button.toggleAttribute('pressed', button.getAttribute('value') === lang)
  for (const element of document.querySelectorAll(`[data-${lang}]`)) element.textContent = element.dataset[lang]
  // An amount in taka (data-taka) takes the kit's own lakh grouping and digits, once v2.js has set
  // ebdfy; without it the amount stays as written.
  const format = globalThis.ebdfy?.format
  if (format)
    for (const element of document.querySelectorAll('[data-taka]'))
      element.textContent = format.taka(Number(element.dataset.taka), lang)
}
if (languages) {
  const chosen = document.documentElement.lang === 'bn' ? 'bn' : 'en'
  if (chosen === 'bn') say('bn')
  languages.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('e-button[value]') : null
    if (!button) return
    const lang = button.getAttribute('value')
    say(lang)
    try {
      localStorage.setItem('ebdfy-docs-v2-lang', lang)
    } catch {
      // The choice lasts until the page closes.
    }
  })
}

// An example's form with no action of its own posts nowhere: its submit shows what the form would post
// in the example's output.
document.addEventListener('submit', (event) => {
  const form = event.target instanceof HTMLFormElement && event.target.closest('.example') ? event.target : null
  if (!form || form.hasAttribute('action')) return
  event.preventDefault()
  const output = form.querySelector('output')
  if (output) output.value = [...new FormData(form)].map(([name, value]) => `${name}: ${value}`).join('\n')
})
