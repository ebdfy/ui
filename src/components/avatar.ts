import { LitElement, css, html } from 'lit'

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

// The first letter of the first word and of the last word. A grapheme keeps a Bangla conjunct whole.
function firstLetter(word: string): string {
  return graphemes.segment(word)[Symbol.iterator]().next().value?.segment ?? ''
}

export function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  const first = words[0]
  if (first === undefined) return ''
  const last = words.length > 1 ? words[words.length - 1] : undefined
  return firstLetter(first) + (last === undefined ? '' : firstLetter(last))
}

export class EbAvatar extends LitElement {
  static override properties = {
    name: { type: String },
    src: { type: String },
  }

  static override styles = css`
    :host {
      display: inline-block;
      width: 40px;
      height: 40px;
      vertical-align: middle;
    }
    .circle {
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      overflow: hidden;
      border-radius: 50%;
      background: var(--eb-color-info-surface);
      color: var(--eb-color-info-text);
      font-family: var(--eb-font-family);
      font-size: var(--eb-font-size-body);
      font-weight: 600;
      line-height: var(--eb-line-height-body);
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `

  declare name: string
  declare src: string | undefined

  constructor() {
    super()
    this.name = ''
  }

  override render() {
    const inner = this.src ? html`<img src=${this.src} alt="" />` : initials(this.name)
    return html`<div class="circle" role="img" aria-label=${this.name}>${inner}</div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-avatar': EbAvatar
  }
}
