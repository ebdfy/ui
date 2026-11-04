// The language switch the component pages share. #language is a segmented group of one eb-button per
// language, the shown one pressed; the examples carry their strings as data-en and data-bn.
const examples = document.getElementById('examples')
const language = document.getElementById('language')

// Shows the examples in one language. Prices follow its digits, a phone number stays Latin.
function show(lang) {
  examples.lang = lang
  for (const el of examples.querySelectorAll('[data-en]')) el.textContent = el.dataset[lang]
  // An element's own properties, such as a card's heading or a field's label, error and value:
  // data-label-en and data-label-bn set label. The order number in a heading stays Latin.
  for (const el of examples.querySelectorAll('*')) {
    for (const [key, text] of Object.entries(el.dataset)) {
      const [, property, of] = key.match(/^(\w+?)(En|Bn)$/) ?? []
      if (property && of.toLowerCase() === lang) el[property] = text
    }
    // A select draws its options when it renders, so their new words need one.
    el.requestUpdate?.()
  }
  const { format } = window.ebdfy
  for (const el of examples.querySelectorAll('[data-taka]')) el.textContent = format.taka(125000, lang)
  for (const el of examples.querySelectorAll('[data-phone]')) el.textContent = format.phone('01707071591')
  for (const button of language.children) {
    button.pressed = String(button.dataset.lang === lang)
  }
}

language.addEventListener('click', (event) => {
  const button = event.target.closest('[data-lang]')
  if (button) show(button.dataset.lang)
})
show('en')

// The Focused example holds the focus once the page has drawn it, and takes it back after each
// switch of language, so it always shows its ring. Until the reader moves the focus, their first Tab
// goes to the skip link, as on every other page, not on from the example.
const focused = examples.querySelector('[data-state="focus"]')
let held = false

function holdFocus() {
  focused.focus({ preventScroll: true, focusVisible: true })
}

if (focused) {
  customElements
    .whenDefined(focused.localName)
    .then(() => focused.updateComplete)
    .then(() => {
      holdFocus()
      held = true
    })
  // Only after a press with a pointer: a keyboard reader stays on the switch they used. A click from
  // the keyboard carries no click count.
  for (const control of [language, document.querySelector('.theme-switch')]) {
    control?.addEventListener('click', (event) => {
      if (event.detail > 0 && event.target.closest('eb-button')) focused.updateComplete.then(holdFocus)
    })
  }
  document.addEventListener('pointerdown', () => (held = false))
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || !held) return
    held = false
    if (!focused.matches(':focus-within')) return
    event.preventDefault()
    document.querySelector('a.skip').focus()
  })
}
