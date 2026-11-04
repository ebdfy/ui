import { LitElement, type PropertyValues, css, html, nothing } from 'lit'

import { icons } from '../icons.ts'

/**
 * A Lucide icon from Ink's set, or an app's own slotted svg, drawn at 16 or 20 px in the colour
 * around it with a 1.5 px stroke. With a label it is an image of that name; without one it is
 * decoration and hidden from assistive tech.
 *
 * @slot - An svg of the app's own, drawn at the same size and stroke, when name is not set.
 */
export class EbIcon extends LitElement {
  static override properties = {
    name: { type: String, reflect: true },
    size: { type: String, reflect: true },
    label: { type: String },
  }

  static override styles = css`
    :host {
      display: inline-block;
      flex: none;
      width: 16px;
      height: 16px;
    }
    :host([size='20']) {
      width: 20px;
      height: 20px;
    }
    svg,
    ::slotted(svg) {
      display: block;
      width: 100%;
      height: 100%;
    }
  `

  // Written out, not as keyof typeof icons, so the manifest names the values. On one line, since the
  // manifest check reads a leading | as an empty value.
  /** Which icon to draw. Leave it unset to slot an svg of your own. */
  // prettier-ignore
  declare name: 'plus' | 'search' | 'x' | 'check' | 'chevron-left' | 'chevron-right' | 'chevron-down' | 'more-horizontal' | 'package' | 'shopping-bag' | 'truck' | 'users' | 'user' | 'phone' | 'message-circle' | 'printer' | 'copy' | 'bell' | 'home' | 'settings' | 'store' | 'tag' | 'credit-card' | 'banknote' | 'receipt' | 'image' | 'triangle-alert' | 'info' | 'circle-check' | 'lock' | 'external-link' | 'arrow-left' | 'filter' | 'calendar' | 'map-pin' | 'trash' | 'pencil' | 'eye' | 'upload' | 'download' | undefined
  /** The size in pixels: 16 or 20. 16 when unset. */
  declare size: '16' | '20'
  /** Names an icon that stands alone. Without it the icon is decoration, hidden from screen readers. */
  declare label: string | undefined

  constructor() {
    super()
    this.size = '16'
  }

  override willUpdate(changed: PropertyValues<this>) {
    if (changed.has('name') && this.name !== undefined && !Object.hasOwn(icons, this.name)) {
      console.warn(`eb-icon: no icon named "${this.name}"`)
    }
    if (this.label) {
      this.setAttribute('role', 'img')
      this.setAttribute('aria-label', this.label)
      this.removeAttribute('aria-hidden')
    } else {
      this.removeAttribute('role')
      this.removeAttribute('aria-label')
      this.setAttribute('aria-hidden', 'true')
    }
  }

  // An app's svg keeps its own fill and stroke colours; only its size and stroke are held to the
  // icon's box and Ink's 1.5 px. Inline style beats the svg's own attributes, and a class or style
  // that sizes it, which ::slotted() alone would lose to.
  #slotted(event: Event) {
    // SAFETY: this listener sits only on the icon's own slot.
    for (const el of (event.target as HTMLSlotElement).assignedElements()) {
      if (!(el instanceof SVGSVGElement)) continue
      el.style.width = '100%'
      el.style.height = '100%'
      for (const line of el.querySelectorAll<SVGElement>('path, rect, circle, ellipse, line, polyline, polygon')) {
        line.style.setProperty('vector-effect', 'non-scaling-stroke')
        line.style.strokeWidth = '1.5px'
      }
    }
  }

  override render() {
    const drawn = this.name !== undefined && Object.hasOwn(icons, this.name) ? icons[this.name] : nothing
    return html`${drawn}<slot @slotchange=${this.#slotted}></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-icon': EbIcon
  }
}
