// e-thumbnail. v2.css draws the square, and the image mark when there is nothing else, at first
// paint. The script adds only what CSS cannot: an img built from src and alt, and a letter attribute
// that thumbnail.css draws. It sets no box, so nothing moves when it runs. The letter comes from the
// alt, or, inside an e-line-item, from that line's title read once when the thumbnail connects.
/**
 * A fixed square for a product or item picture. It shows the image from `src`; with no image it
 * draws the first letter of `alt`, or of its line's title inside an `e-line-item`, or else an image
 * mark.
 * @tag e-thumbnail
 * @attr {string} src - The picture. The script builds an `img` from it unless one is already inside.
 * @attr {string} alt - The picture's text for assistive tech, and the source of the letter drawn when there is no picture.
 * @attr {'small' | 'large'} size - small is 32 px and large is 88 px. Without it the square is 40 px.
 * @attr letter - The letter drawn when there is no picture. The script writes it; set it only for a letter alt does not give.
 * @slot - An optional `img`, which replaces the letter and the mark.
 */
export class EThumbnail extends HTMLElement {
  static observedAttributes = ['src', 'alt']

  private made: HTMLImageElement | null = null

  connectedCallback(): void {
    this.fill()
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.fill()
  }

  private fill(): void {
    const src = this.getAttribute('src')
    const alt = this.getAttribute('alt') ?? ''
    if (src && (this.made || !this.querySelector('img'))) {
      this.made ??= this.appendChild(document.createElement('img'))
      this.made.setAttribute('src', src)
      this.made.setAttribute('alt', alt)
    } else if (this.made) {
      this.made.remove()
      this.made = null
    }
    const text = alt || this.closest('e-line-item')?.querySelector('[slot="title"]')?.textContent?.trim() || ''
    const first = text
      ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)[Symbol.iterator]().next().value
      : undefined
    if (first) this.setAttribute('letter', first.segment.toLocaleUpperCase())
    else this.removeAttribute('letter')
  }
}

export function defineThumbnail(): void {
  if (!customElements.get('e-thumbnail')) customElements.define('e-thumbnail', EThumbnail)
}
