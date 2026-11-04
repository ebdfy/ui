import { LitElement, css, html } from 'lit'
import type { PropertyValues } from 'lit'

/**
 * Lays its children out in equal columns, in one column on a screen under 600 px wide.
 *
 * @slot - The children to lay out.
 */
export class EbGrid extends LitElement {
  static override properties = {
    columns: { type: Number },
  }

  // One column on a phone; the columns attribute applies from 600 px of viewport.
  static override styles = css`
    :host {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--eb-space-gap);
    }
    @media (min-width: 600px) {
      :host {
        grid-template-columns: repeat(var(--eb-grid-columns, 2), minmax(0, 1fr));
      }
    }
  `

  /** How many equal columns. 2 when unset; under 600 px wide it shows one whatever this says. */
  declare columns: number

  constructor() {
    super()
    this.columns = 2
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('columns')) this.style.setProperty('--eb-grid-columns', String(this.columns))
  }

  override render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-grid': EbGrid
  }
}
