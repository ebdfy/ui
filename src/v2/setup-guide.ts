// e-setup-guide and e-setup-step: steps with a done state, a count such as "2 of 5", and a dismiss
// event. CSS draws the heading, the ticks and the count first (the count with counters); the script
// builds the same things as native elements in the same places. A step's `done` attribute is the
// state: the tick sets and clears it, a page may set it, and the count follows it. Dismiss fires one
// `dismiss` event, which bubbles, and removes the guide; the page keeps the choice.
let count = 0

const bengaliDigits = '০১২৩৪৫৬৭৮৯'

/**
 * One step of a setup guide, with a tick. The tick sets and clears `done`, and a page may set it too.
 * @tag e-setup-step
 * @attr {boolean} done - The step is finished.
 * @slot - The step's words.
 */
export class ESetupStep extends HTMLElement {
  static observedAttributes = ['done']

  #input: HTMLInputElement | null = null

  connectedCallback(): void {
    if (this.#input) return
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.id = `e-setup-step-${++count}`
    input.checked = this.hasAttribute('done')
    input.addEventListener('change', () => this.toggleAttribute('done', input.checked))
    const label = document.createElement('label')
    label.htmlFor = input.id
    label.append(...this.childNodes)
    this.#input = input
    this.append(input, label)
  }

  attributeChangedCallback(): void {
    if (this.#input) this.#input.checked = this.hasAttribute('done')
  }
}

/**
 * The steps to set up a store, with a count such as "2 of 5" and a Dismiss button.
 * @tag e-setup-guide
 * @attr heading - The guide's title, built as its h2.
 * @fires dismiss - When Dismiss is pressed, as the guide is removed. Bubbles; detail is empty. The page keeps the choice.
 * @slot - The `e-setup-step` tags.
 */
export class ESetupGuide extends HTMLElement {
  static observedAttributes = ['heading']

  #watch = new MutationObserver(() => this.#refresh())

  connectedCallback(): void {
    if (!this.querySelector(':scope > [data-count]')) {
      const heading = this.getAttribute('heading')
      if (heading !== null) {
        const h2 = document.createElement('h2')
        h2.slot = 'heading'
        h2.textContent = heading
        this.prepend(h2)
      }
      const dismiss = document.createElement('button')
      dismiss.type = 'button'
      dismiss.dataset.dismiss = ''
      dismiss.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('dismiss', { bubbles: true }))
        this.remove()
      })
      const total = document.createElement('span')
      total.dataset.count = ''
      const h2 = this.querySelector(':scope > h2[slot="heading"]')
      if (h2) h2.after(dismiss, total)
      else this.prepend(dismiss, total)
    }
    this.#refresh()
    this.#watch.observe(this, { subtree: true, childList: true, attributes: true, attributeFilter: ['done'] })
    this.#watch.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
  }

  disconnectedCallback(): void {
    this.#watch.disconnect()
  }

  attributeChangedCallback(): void {
    const h2 = this.querySelector(':scope > h2[slot="heading"]')
    if (h2) h2.textContent = this.getAttribute('heading') ?? ''
  }

  // The words and the digits follow the closest [lang].
  #refresh(): void {
    const steps = this.querySelectorAll('e-setup-step')
    const done = this.querySelectorAll('e-setup-step[done]').length
    const bn = this.closest('[lang]')?.getAttribute('lang')?.startsWith('bn')
    const digits = (n: number) => (bn ? String(n).replace(/\d/g, (digit) => bengaliDigits[Number(digit)]!) : String(n))
    const say = (selector: string, text: string) => {
      const tag = this.querySelector(`:scope > ${selector}`)!
      // The observer watches this subtree, so only a changed text may be written.
      if (tag.textContent !== text) tag.textContent = text
    }
    say('[data-count]', bn ? `${digits(steps.length)}টির মধ্যে ${digits(done)}টি` : `${done} of ${steps.length}`)
    say('[data-dismiss]', bn ? 'বাদ দিন' : 'Dismiss')
  }
}

export function defineSetupGuide(): void {
  if (!customElements.get('e-setup-guide')) customElements.define('e-setup-guide', ESetupGuide)
  if (!customElements.get('e-setup-step')) customElements.define('e-setup-step', ESetupStep)
}
