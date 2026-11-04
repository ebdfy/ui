import { LitElement, css, html } from 'lit'
import { ifDefined } from 'lit/directives/if-defined.js'
import { styleMap } from 'lit/directives/style-map.js'

/** A thin bar that fills the width of its row, filled to a value or sliding while the work goes on. */
export class EbProgressBar extends LitElement {
  static override properties = {
    value: { type: Number },
    label: { type: String },
  }

  static override styles = css`
    :host {
      display: block;
    }
    .track {
      height: 4px;
      overflow: hidden;
      border-radius: 2px;
      background: var(--eb-color-divider);
    }
    .fill {
      height: 100%;
      background: var(--eb-color-accent);
    }
    .indeterminate .fill {
      width: 40%;
      animation: slide 1.2s ease-in-out infinite;
    }
    @keyframes slide {
      from {
        transform: translateX(-100%);
      }
      to {
        transform: translateX(250%);
      }
    }
  `

  /** How much of the bar is filled, 0 to 100. Unset, the bar is indeterminate. */
  declare value: number | undefined
  /** Names the bar for a screen reader. */
  declare label: string | undefined

  override render() {
    const known = this.value !== undefined && !Number.isNaN(this.value)
    const now = known ? Math.min(100, Math.max(0, this.value ?? 0)) : undefined
    return html`<div
      class=${known ? 'track' : 'track indeterminate'}
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow=${ifDefined(now)}
      aria-label=${ifDefined(this.label)}
    >
      <div class="fill" style=${styleMap(now === undefined ? {} : { width: `${now}%` })}></div>
    </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-progress-bar': EbProgressBar
  }
}
