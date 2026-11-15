// e-page. Builds the h1 in the cell the CSS heading was drawn in, so nothing moves. A new heading,
// as a page switching language sets, goes to the h1.
/**
 * A page: a heading with its actions beside it, then the content. A child marked `aside` forms a 320 px
 * column 20 px beside the content from 600 px, and stacks below it on a phone. A record page adds a
 * back link, its status and previous/next to the header row, and a facts line under the heading.
 * @tag e-page
 * @attr heading - The page's title, built as its h1.
 * @attr {'details' | 'form'} width - Sets the content to 1040 px for a record, 960 px for a form, centred; narrower screens fill.
 * @slot - The page's content.
 * @slot back - A link back to the list, holding an `e-icon`, before the heading; name it with aria-label.
 * @slot status - Up to three badges on the heading's line; on a phone each child takes its own line under it, so badges meant side by side go in one row `e-stack`.
 * @slot facts - A short line under the heading, such as the time, channel and item count.
 * @slot pagination - Previous and next links, joined as one control, before the actions.
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
