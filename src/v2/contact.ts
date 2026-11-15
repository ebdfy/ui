// e-contact. The markup holds the link, so a phone number calls with or without the script; the
// script adds the copy button at the row's end, in the box the CSS keeps for it. Copy writes the
// link's number or address, not its spaced-out text; where the browser refuses the clipboard (a
// frame not allowed it), it selects the link's text instead, so the reader can copy by hand.
import { langOf } from '../lang.ts'

const words = {
  en: { copy: (what: string) => `Copy ${what}`, copied: 'Copied' },
  bn: { copy: (what: string) => `${what} কপি করুন`, copied: 'কপি হয়েছে' },
}

/**
 * A way to reach a person: a `tel:` or `mailto:` link with a copy button the script adds.
 * @tag e-contact
 * @slot - An optional `e-icon`, then the link.
 */
export class EContact extends HTMLElement {
  #button: HTMLButtonElement | null = null
  #reset: ReturnType<typeof setTimeout> | undefined

  connectedCallback(): void {
    const link = this.querySelector<HTMLAnchorElement>(':scope > a')
    if (!link || this.#button) return
    const button = document.createElement('button')
    button.type = 'button'
    const icon = document.createElement('e-icon')
    icon.setAttribute('name', 'copy')
    button.append(icon)
    const name = () => button.setAttribute('aria-label', words[langOf(this)].copy(this.#value(link)))
    name()
    // An edit that changes the number rewrites the link, so the button follows it.
    new MutationObserver(name).observe(link, { attributeFilter: ['href'] })
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(this.#value(link))
        button.setAttribute('aria-label', words[langOf(this)].copied)
        icon.setAttribute('name', 'check')
        clearTimeout(this.#reset)
        this.#reset = setTimeout(() => {
          name()
          icon.setAttribute('name', 'copy')
        }, 2000)
      } catch {
        getSelection()?.selectAllChildren(link)
      }
    })
    this.#button = button
    this.append(button)
  }

  // The number or address the link names, as a tel: or mailto: link carries it.
  #value(link: HTMLAnchorElement): string {
    const href = link.getAttribute('href') ?? ''
    const match = /^(?:tel|mailto):(.+)$/i.exec(href)
    return match ? decodeURIComponent(match[1]!) : (link.textContent ?? '').trim()
  }
}

export function defineContact(): void {
  if (!customElements.get('e-contact')) customElements.define('e-contact', EContact)
}
