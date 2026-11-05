// e-progress-bar: a progressbar named by its label, filled to its value out of 100. Without a value
// it is indeterminate: no aria-valuenow, and the CSS slides a short fill along.
/**
 * Shows how far a task has gone. Without a value it is indeterminate and a short fill slides along it.
 * @tag e-progress-bar
 * @attr {number} value - A number from 0 to 100; a number outside it is clamped.
 * @attr label - Names the bar for a screen reader.
 */
export class EProgressBar extends HTMLElement {
  static observedAttributes = ['value', 'label']

  connectedCallback(): void {
    this.setAttribute('role', 'progressbar')
    this.setAttribute('aria-valuemin', '0')
    this.setAttribute('aria-valuemax', '100')
    this.attributeChangedCallback()
  }

  attributeChangedCallback(): void {
    const label = this.getAttribute('label')
    if (label !== null) this.setAttribute('aria-label', label)
    const value = Number.parseFloat(this.getAttribute('value') ?? '')
    if (Number.isNaN(value)) {
      this.removeAttribute('aria-valuenow')
      this.style.removeProperty('--e-progress')
      return
    }
    const now = Math.min(100, Math.max(0, value))
    this.setAttribute('aria-valuenow', String(now))
    this.style.setProperty('--e-progress', `${now}%`)
  }
}

export function defineProgressBar(): void {
  if (!customElements.get('e-progress-bar')) customElements.define('e-progress-bar', EProgressBar)
}
