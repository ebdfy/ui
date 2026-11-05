// e-page. Builds the h1 in the cell the CSS heading was drawn in, so nothing moves. A new heading,
// as a page switching language sets, goes to the h1.
/**
 * A page: a heading with its actions beside it, then the content. A child marked `aside` forms a 344 px
 * column beside the content from 600 px, and stacks below it on a phone.
 * @tag e-page
 * @attr heading - The page's title, built as its h1.
 * @slot - The page's content.
 * @slot actions - Buttons beside the heading.
 * @slot aside - The side column; best one child, such as an `e-stack` of cards.
 */
export class EPage extends HTMLElement {
  static observedAttributes = ['heading']

  connectedCallback(): void {
    const heading = this.getAttribute('heading')
    if (heading === null || this.querySelector(':scope > h1[slot="heading"]')) return
    const h1 = document.createElement('h1')
    h1.slot = 'heading'
    h1.textContent = heading
    this.prepend(h1)
  }

  attributeChangedCallback(): void {
    const h1 = this.querySelector(':scope > h1[slot="heading"]')
    if (h1) h1.textContent = this.getAttribute('heading') ?? ''
  }
}

export function definePage(): void {
  if (!customElements.get('e-page')) customElements.define('e-page', EPage)
}
