// e-heading and e-text. CSS draws both; an e-heading also becomes a heading for assistive tech.
/**
 * A heading for a section of a page. Assistive tech reads it as a heading of its level.
 * @tag e-heading
 * @attr {'1' | '2' | '3'} level - The heading level, also its size; 2 when absent.
 * @slot - The heading's words.
 */
export class EHeading extends HTMLElement {
  connectedCallback(): void {
    this.setAttribute('role', 'heading')
    this.setAttribute('aria-level', this.getAttribute('level') ?? '2')
  }
}

/**
 * A block of body text. CSS draws it whole, so the class only types the tag and defines no behaviour.
 * @tag e-text
 * @attr {'subdued' | 'faint'} tone - A quieter colour; none for the default.
 * @attr {'meta'} size - Small print, such as a date or a count; none for body size.
 * @slot - The text.
 */
export declare class EText extends HTMLElement {}

export function defineText(): void {
  if (!customElements.get('e-heading')) customElements.define('e-heading', EHeading)
}
