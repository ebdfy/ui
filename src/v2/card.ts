// e-card. Builds the h2 in the cell the CSS heading was drawn in, so nothing moves. A new heading,
// as a page switching language sets, goes to the h2. With three or more actions it builds the More
// menu that a phone shows in place of the third and later ones.
/**
 * A card groups what belongs together on a surface. With a heading it has a header row, and its
 * actions sit at the right of it; on a phone the third and later fold into a More menu.
 * @tag e-card
 * @attr heading - The card's title, built as its h2.
 * @slot - What the card holds.
 * @slot actions - Buttons or links in the header, after the heading.
 */
export class ECard extends HTMLElement {
  static observedAttributes = ['heading']

  connectedCallback(): void {
    this.#heading()
    this.#more()
  }

  attributeChangedCallback(): void {
    const h2 = this.querySelector(':scope > h2[slot="heading"]')
    if (h2) h2.textContent = this.getAttribute('heading') ?? ''
  }

  #heading(): void {
    const heading = this.getAttribute('heading')
    if (heading === null || this.querySelector(':scope > h2[slot="heading"]')) return
    const h2 = document.createElement('h2')
    h2.slot = 'heading'
    h2.textContent = heading
    this.prepend(h2)
  }

  // The folded actions stay in the card, hidden on a phone, and an item clicks its action, so a
  // page's own listeners on the actions keep working. An item says what its action says, its
  // aria-label for an icon-only one, and follows a relabelled action; the trigger follows the language.
  #folded: [HTMLElement, HTMLElement][] = []
  #watch = new MutationObserver(() => this.#say())

  #more(): void {
    const folded = [...this.querySelectorAll<HTMLElement>(':scope > [slot="actions"]')].slice(2)
    if (folded.length === 0 || this.querySelector(':scope > [data-part="more"]')) return
    const menu = document.createElement('e-menu')
    menu.dataset.part = 'more'
    const trigger = document.createElement('e-button')
    trigger.setAttribute('slot', 'trigger')
    menu.append(trigger)
    for (const action of folded) {
      const item = document.createElement('e-menu-item')
      item.addEventListener('click', () => {
        const native = action.querySelector<HTMLElement>(':scope > button, :scope > a') ?? action
        native.click()
      })
      menu.append(item)
      this.#folded.push([item, action])
    }
    this.append(menu)
    this.#say()
    const watched = { subtree: true, childList: true, characterData: true, attributeFilter: ['aria-label'] }
    for (const action of folded) this.#watch.observe(action, watched)
    for (const tag of new Set([this.closest('[lang]'), document.documentElement])) {
      if (tag) this.#watch.observe(tag, { attributeFilter: ['lang'] })
    }
  }

  // Writes only a changed text, as the observer hears this card's own writes too. The trigger's label
  // sits in the button it built, once it has.
  #say(): void {
    const write = (tag: Element, text: string) => {
      if (tag.textContent !== text) tag.textContent = text
    }
    const trigger = this.querySelector(':scope > [data-part="more"] > [slot="trigger"]')
    if (trigger) {
      const bn = this.closest('[lang]')?.getAttribute('lang')?.startsWith('bn')
      write(trigger.querySelector(':scope > button') ?? trigger, bn ? 'আরও' : 'More')
    }
    for (const [item, action] of this.#folded)
      write(item, action.getAttribute('aria-label') ?? action.textContent?.trim() ?? '')
  }
}

export function defineCard(): void {
  if (!customElements.get('e-card')) customElements.define('e-card', ECard)
}
