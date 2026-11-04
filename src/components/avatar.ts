import { LitElement, css, html, type PropertyValues } from 'lit'

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

// The first letter of the first word and of the last word. A grapheme keeps a Bangla conjunct whole.
function firstLetter(word: string): string {
  return graphemes.segment(word)[Symbol.iterator]().next().value?.segment ?? ''
}

const honorifics = new Set(['মো.', 'মোঃ', 'মো:', 'মোহাম্মদ', 'মুহাম্মদ', 'মোছাঃ', 'মোছা.', 'মোসাম্মৎ', 'Md.', 'Mst.'])

function isBangla(word: string | undefined): boolean {
  return word !== undefined && /^[ঀ-৿]/.test(word)
}

// A Bangla letter with a vowel sign or hasanta after it is one grapheme, so the first code point is the bare letter.
function baseLetter(word: string): string {
  return [...firstLetter(word)][0] ?? ''
}

// A Bangla name shows one letter: the first word after any leading honorifics. A Latin name shows the first letter of the first and the last word.
export function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  const first = words[0]
  if (first === undefined) return ''
  // A name that is only honorifics keeps its first word.
  const named = words.find((word) => !honorifics.has(word)) ?? first
  if (isBangla(named)) return baseLetter(named)
  const last = words.length > 1 ? words[words.length - 1] : undefined
  return firstLetter(first) + (last === undefined ? '' : firstLetter(last))
}

/** Shows a person as a circle: their picture, or their initials when there is none or it fails to load. */
export class EbAvatar extends LitElement {
  static override properties = {
    name: { type: String },
    src: { type: String },
    failed: { state: true },
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
      background: var(--eb-color-surface-3);
      color: var(--eb-color-text-2);
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

  /** The person's name, which the initials come from and the screen reader reads. */
  declare name: string
  /** The address of the picture. Unset, the initials show. */
  declare src: string | undefined
  /** Set by the avatar when the picture fails to load; not for apps to set. */
  declare failed: boolean

  constructor() {
    super()
    this.name = ''
    this.failed = false
  }

  // A new src gets a fresh try after an earlier one failed.
  override willUpdate(changed: PropertyValues) {
    if (changed.has('src')) this.failed = false
  }

  override render() {
    const inner =
      this.src && !this.failed
        ? html`<img src=${this.src} alt="" @error=${() => (this.failed = true)} />`
        : initials(this.name)
    return html`<div class="circle" role="img" aria-label=${this.name}>${inner}</div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-avatar': EbAvatar
  }
}
