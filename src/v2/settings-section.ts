// e-settings-section: builds an h2 and a p from its heading and help attributes, in the cells the
// CSS drew them in, so nothing moves. A new heading or help, as a page switching language sets, goes
// to the built h2 or p.
/**
 * A group of settings: a heading and help text at the left, and the cards that hold the settings at the
 * right. The heading column is a third of the width from 600 px and 260 px from 900 px; below 600 px
 * they stack. Sections that follow each other sit 24 px apart.
 * @tag e-settings-section
 * @attr heading - The section's title, built as its h2.
 * @attr help - A line that says what the section is for, built as a paragraph.
 * @slot - The cards, usually one `e-card`.
 */
export class ESettingsSection extends HTMLElement {
  static observedAttributes = ['heading', 'help']

  connectedCallback(): void {
    if (this.querySelector(':scope > [slot="heading"], :scope > [slot="help"]')) return
    const heading = document.createElement('h2')
    heading.slot = 'heading'
    const help = document.createElement('p')
    help.slot = 'help'
    this.prepend(heading, help)
    this.attributeChangedCallback()
  }

  attributeChangedCallback(): void {
    const heading = this.querySelector(':scope > h2[slot="heading"]')
    const help = this.querySelector(':scope > p[slot="help"]')
    if (heading) heading.textContent = this.getAttribute('heading') ?? ''
    if (help) help.textContent = this.getAttribute('help') ?? ''
  }
}

export function defineSettingsSection(): void {
  if (!customElements.get('e-settings-section')) customElements.define('e-settings-section', ESettingsSection)
}
