import { LitElement, css, html } from 'lit'
import { ifDefined } from 'lit/directives/if-defined.js'
import { styleMap } from 'lit/directives/style-map.js'

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
      background: var(--eb-color-line);
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

  declare value: number | undefined
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
