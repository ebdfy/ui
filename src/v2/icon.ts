// e-icon: fills its box from the Lucide sprite. The sprite is icons.svg beside this module, in the
// source and next to the built v2.js. The URL is read from a variable so the bundler leaves the file
// on the CDN instead of inlining it.
const here = import.meta.url

const svgns = 'http://www.w3.org/2000/svg'

let sprite: Promise<SVGSVGElement | null> | undefined

// Fetches the sprite once and keeps its symbols in this document, because a <use href> to an SVG on
// another origin does not render. The holder is zero-size, not display:none, so the symbols resolve.
async function fetchSprite(): Promise<SVGSVGElement | null> {
  try {
    const response = await fetch(new URL('icons.svg', here))
    if (!response.ok) return null
    const holder = document.createElementNS(svgns, 'svg')
    holder.id = 'e-icon-sprite'
    holder.setAttribute('aria-hidden', 'true')
    holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'
    const symbols = new DOMParser().parseFromString(await response.text(), 'image/svg+xml').querySelectorAll('symbol')
    holder.append(...[...symbols].map((symbol) => document.importNode(symbol, true)))
    return holder
  } catch {
    // Without the sprite the icons stay empty boxes.
    return null
  }
}

/**
 * A small icon from the kit's sprite. It is decorative: name the button or link it sits in.
 * @tag e-icon
 * @attr {'truck' | 'search' | 'plus' | 'x' | 'check' | 'chevron-left' | 'chevron-right' | 'chevron-down' | 'more-horizontal' | 'home' | 'shopping-bag' | 'package' | 'users' | 'settings' | 'bell' | 'help'} name - Which icon to draw.
 * @attr {'20'} size - 20 px; 16 px when absent.
 */
export class EIcon extends HTMLElement {
  async connectedCallback(): Promise<void> {
    const holder = await (sprite ??= fetchSprite())
    const name = this.getAttribute('name')
    if (!holder || !name || !this.isConnected || this.querySelector('svg')) return
    if (!holder.querySelector(`symbol[id="e-icon-${CSS.escape(name)}"]`)) return
    // A page that replaced its body took the holder with it, so it goes back first.
    if (!holder.isConnected) document.body.prepend(holder)
    const svg = document.createElementNS(svgns, 'svg')
    svg.setAttribute('aria-hidden', 'true')
    const use = document.createElementNS(svgns, 'use')
    use.setAttribute('href', `#e-icon-${name}`)
    svg.append(use)
    this.append(svg)
  }
}

export function defineIcon(): void {
  if (!customElements.get('e-icon')) customElements.define('e-icon', EIcon)
}
