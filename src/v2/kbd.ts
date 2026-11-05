// e-kbd: writes a shortcut's keys into a <kbd> inside the tag, once. `mod+k` reads Ctrl K, or ⌘ K on
// Apple. The platform comes from a user agent string the caller passes, never from a stubbed navigator.

// Whether a user agent names an Apple platform, where the shortcut key is ⌘ and not Ctrl.
export function apple(userAgent: string): boolean {
  return /Mac|iPhone|iPad|iPod/.test(userAgent)
}

const names = new Map([
  ['mod', { other: 'Ctrl', apple: '⌘' }],
  ['alt', { other: 'Alt', apple: '⌥' }],
  ['shift', { other: 'Shift', apple: '⇧' }],
])

export function shortcutText(shortcut: string, userAgent: string): string {
  const isApple = apple(userAgent)
  return shortcut
    .split('+')
    .map((key) => {
      const named = names.get(key.toLowerCase())
      return named ? (isApple ? named.apple : named.other) : key.toUpperCase()
    })
    .join(' ')
}

let agent = ''

/**
 * A key chip that shows a keyboard shortcut.
 * @tag e-kbd
 * @attr shortcut - Keys joined by `+`, such as `mod+k`. `mod` reads Ctrl, or ⌘ on Apple; `alt` and `shift` also change on Apple.
 */
export class EKbd extends HTMLElement {
  static observedAttributes = ['shortcut']

  #kbd: HTMLElement | null = null

  connectedCallback(): void {
    if (!this.#kbd) {
      this.#kbd = document.createElement('kbd')
      this.replaceChildren(this.#kbd)
    }
    this.attributeChangedCallback()
  }

  attributeChangedCallback(): void {
    if (this.#kbd) this.#kbd.textContent = shortcutText(this.getAttribute('shortcut') ?? '', agent)
  }
}

export function defineKbd(userAgent: string = navigator.userAgent): void {
  agent = userAgent
  if (!customElements.get('e-kbd')) customElements.define('e-kbd', EKbd)
}
