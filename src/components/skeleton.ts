import { LitElement, css, html } from 'lit'

export class EbSkeleton extends LitElement {
  static override properties = {
    lines: { type: Number },
  }

  static override styles = css`
    :host {
      display: block;
    }
    .line {
      display: flex;
      align-items: center;
      height: var(--eb-line-height-body);
    }
    .bar {
      width: 100%;
      height: 12px;
      border-radius: 6px;
      background: var(--eb-color-line);
      animation: pulse 1.5s ease-in-out infinite;
    }
    .line.short .bar {
      width: 60%;
    }
    @keyframes pulse {
      50% {
        opacity: 0.5;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .bar {
        animation: none;
      }
    }
  `

  declare lines: number

  constructor() {
    super()
    this.lines = 1
  }

  override render() {
    const count = Math.max(1, Math.floor(this.lines) || 1)
    const lines = Array.from(
      { length: count },
      (_, i) => html`<div class=${count > 1 && i === count - 1 ? 'line short' : 'line'}><div class="bar"></div></div>`,
    )
    return html`<div aria-hidden="true">${lines}</div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-skeleton': EbSkeleton
  }
}
