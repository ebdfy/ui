// e-avatar. CSS cannot take letters from a name, so the script writes the initials attribute that
// avatar.css draws: the first letter of the first and the last word. It sets no box, so nothing
// moves. A new name, as a page switching language sets, gives new initials. Letters drawn by CSS are
// no name to assistive tech, so the avatar is an image named by its person.
/**
 * A 32 px circle for a person. It draws the first letter of the first and the last word of `name`; an
 * `img` inside covers the initials.
 * @tag e-avatar
 * @attr {'24'} size - A 24 px circle. Without it the circle is 32 px.
 * @attr {'lime'} tone - Lime, for the person signed in.
 * @attr name - The person's name. It sets the initials and names the avatar for assistive tech.
 * @attr initials - The letters drawn. The script writes them from `name`; set it only for letters a name does not give.
 * @slot - An optional `img` of the person.
 */
export class EAvatar extends HTMLElement {
  static observedAttributes = ['name']

  connectedCallback(): void {
    this.fill()
  }

  attributeChangedCallback(): void {
    this.fill()
  }

  private fill(): void {
    const name = this.getAttribute('name') ?? ''
    this.setAttribute('role', 'img')
    if (name) this.setAttribute('aria-label', name)
    else this.removeAttribute('aria-label')
    const words = name.split(/\s+/).filter(Boolean)
    const letters = [words[0], words.length > 1 ? words[words.length - 1] : undefined]
      .map((word) => (word ? (Array.from(word)[0] ?? '') : ''))
      .join('')
    if (letters) this.setAttribute('initials', letters.toLocaleUpperCase())
    else this.removeAttribute('initials')
  }
}

export function defineAvatar(): void {
  if (!customElements.get('e-avatar')) customElements.define('e-avatar', EAvatar)
}
