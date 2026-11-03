// The language switch the component pages share. #language holds one eb-button per language; the
// examples carry their strings as data-en and data-bn.
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
    button.variant = button.dataset.lang === lang ? 'primary' : 'secondary'
  }
}

language.addEventListener('click', (event) => {
  const button = event.target.closest('[data-lang]')
  if (button) show(button.dataset.lang)
})
show('en')

// The example of a focused field holds the focus once the page has drawn it.
const focused = examples.querySelector('[data-state="focus"]')
if (focused)
  customElements
    .whenDefined(focused.localName)
    .then(() => focused.updateComplete)
    .then(() => focused.focus())
