// e-meter: a meter named by its label, filled to its value out of 100.
/**
 * A thin bar for a share, such as a customer's delivered rate. Write the share in words beside it.
 * @tag e-meter
 * @attr {number} value - A number from 0 to 100; a number outside it is clamped.
 * @attr label - Names the meter for a screen reader.
 * @attr {'success' | 'warning' | 'critical'} tone - The fill's colour. Without it the fill is the accent.
 */
export class EMeter extends HTMLElement {
  static observedAttributes = ['value', 'label']

  connectedCallback(): void {
    this.setAttribute('role', 'meter')
    this.setAttribute('aria-valuemin', '0')
    this.setAttribute('aria-valuemax', '100')
    this.attributeChangedCallback()
  }

  attributeChangedCallback(): void {
    const label = this.getAttribute('label')
    if (label !== null) this.setAttribute('aria-label', label)
    const value = Number.parseFloat(this.getAttribute('value') ?? '')
    const now = Number.isNaN(value) ? 0 : Math.min(100, Math.max(0, value))
    this.setAttribute('aria-valuenow', String(now))
    this.style.setProperty('--e-meter', `${now}%`)
  }
}

export function defineMeter(): void {
  if (!customElements.get('e-meter')) customElements.define('e-meter', EMeter)
}
