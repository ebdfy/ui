// e-arranged-cards: v2.css lays it out and draws its edit mode; v2-host.js, which only the Admin loads,
// builds the edit mode's controls. Every control it builds is taken out again when edit mode ends, and
// a card it removes stays in the page, hidden, so the page's own cards are never rebuilt.
import { langOf } from '../lang.ts'

const words = {
  en: {
    done: 'Done',
    reset: 'Reset to default',
    add: 'Add card',
    move: (card: string) => `Move ${card}`,
    up: (card: string) => `Move ${card} up`,
    down: (card: string) => `Move ${card} down`,
    remove: (card: string) => `Remove ${card}`,
    later: 'Shows once you press Done.',
  },
  bn: {
    done: 'সম্পন্ন',
    reset: 'আগের মতো করুন',
    add: 'কার্ড যোগ করুন',
    move: (card: string) => `${card} সরান`,
    up: (card: string) => `${card} উপরে নিন`,
    down: (card: string) => `${card} নিচে নিন`,
    remove: (card: string) => `${card} বাদ দিন`,
    later: 'সম্পন্ন চাপলে দেখা যাবে।',
  },
}

function withAttributes<T extends Element>(made: T, attributes: Record<string, string>): T {
  for (const [name, value] of Object.entries(attributes)) made.setAttribute(name, value)
  return made
}

const make = <K extends keyof HTMLElementTagNameMap>(tag: K, attributes: Record<string, string> = {}) =>
  withAttributes(document.createElement(tag), attributes)

// A kit tag, such as e-icon, which v2.js or this script defines.
const kitTag = (tag: string, attributes: Record<string, string> = {}) =>
  withAttributes(document.createElement(tag), attributes)

function iconButton(part: string, icon: string, label: string): HTMLButtonElement {
  const button = make('button', { type: 'button', 'data-part': part, 'aria-label': label })
  button.append(kitTag('e-icon', { name: icon }))
  return button
}

// An e-button around a native button, which it uses as written.
function kitButton(label: string, tone: 'primary' | 'plain'): [HTMLElement, HTMLButtonElement] {
  // e-button gives its native button the type it carries itself, so it carries button, not submit.
  const kit = kitTag('e-button', { tone, type: 'button' })
  const button = make('button', { type: 'button' })
  button.textContent = label
  kit.append(button)
  return [kit, button]
}

/**
 * A page's cards in the order the staff member chose, on four columns from 600 px of its own width.
 * Each child card carries `card` with its id, and `span` for how many of the four columns it takes.
 * A button with `aria-controls` naming the part, such as Customize, turns on edit mode: a strip above
 * each card holds a drag handle and Remove, or Move up and Move down below 600 px, and an Add card
 * tile ends the page, which opens the page's library. Done writes the card ids in order to the field
 * `name` names and submits the form around the part. It works in the Admin, where v2-host.js runs.
 * @tag e-arranged-cards
 * @attr name - The form field Done fills with the card ids in order, space-separated.
 * @attr default - The page's default card ids, in order, which Reset to default puts back.
 * @attr library - The id of the page's library `e-modal`, whose children with `card` and their heading name each card not on the page.
 * @attr {boolean} editing - Set while in edit mode.
 * @slot - The page's cards, each with a `card` id; `span="1"`, `"2"` or `"3"` takes that many columns from 600 px, and a one-column card half the row below it.
 */
export class EArrangedCards extends HTMLElement {
  #built: Element[] = []
  #dragging: HTMLElement | null = null

  connectedCallback(): void {
    document.addEventListener('click', this.#click)
    document.addEventListener('pointermove', this.#drag)
    document.addEventListener('pointerup', this.#drop)
  }

  disconnectedCallback(): void {
    document.removeEventListener('click', this.#click)
    document.removeEventListener('pointermove', this.#drag)
    document.removeEventListener('pointerup', this.#drop)
  }

  get #say() {
    return words[langOf(this)]
  }

  #cards(all = false): HTMLElement[] {
    return [...this.querySelectorAll<HTMLElement>(':scope > [card]')].filter((card) => all || !card.hidden)
  }

  #library(): (HTMLElement & { show?: () => void; hide?: () => void }) | null {
    const id = this.getAttribute('library')
    return id ? document.getElementById(id) : null
  }

  #nameOf(card: Element): string {
    return (
      card.getAttribute('heading') ??
      card.querySelector('h2, h3')?.textContent?.trim() ??
      card.getAttribute('card') ??
      ''
    )
  }

  #click = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target : null
    const control = target?.closest('[aria-controls]')
    if (this.id && control?.getAttribute('aria-controls') === this.id) return this.#edit()
    const library = this.#library()
    const entry = target?.closest('[card]')
    if (this.hasAttribute('editing') && library && entry && library.contains(entry)) {
      library.hide?.()
      this.#putBack(entry.getAttribute('card') ?? '', entry.textContent?.trim() ?? '')
    }
  }

  #edit(): void {
    if (this.hasAttribute('editing')) return
    this.toggleAttribute('editing', true)
    this.#expanded(true)
    const say = this.#say
    const bar = make('div', { 'data-part': 'bar' })
    const [reset, resetButton] = kitButton(say.reset, 'plain')
    const [done, doneButton] = kitButton(say.done, 'primary')
    resetButton.addEventListener('click', () => this.#reset())
    doneButton.addEventListener('click', () => this.#done())
    bar.append(reset, done)
    const add = make('button', { type: 'button', 'data-part': 'add' })
    add.append(kitTag('e-icon', { name: 'plus' }), say.add)
    add.addEventListener('click', () => this.#library()?.show?.())
    this.prepend(bar)
    this.append(add)
    this.#built = [bar, add]
    for (const card of this.#cards(true)) this.#strip(card)
    this.#arrows()
  }

  #expanded(open: boolean): void {
    for (const control of document.querySelectorAll(`[aria-controls="${CSS.escape(this.id)}"]`)) {
      control.setAttribute('aria-expanded', String(open))
    }
  }

  // The strip above a card: its handle, its arrows, its name and Remove.
  #strip(card: HTMLElement): void {
    const say = this.#say
    const name = this.#nameOf(card)
    const strip = make('div', { 'data-part': 'strip' })
    const handle = iconButton('handle', 'grip-vertical', say.move(name))
    const up = iconButton('up', 'chevron-down', say.up(name))
    const down = iconButton('down', 'chevron-down', say.down(name))
    const remove = iconButton('remove', 'trash', say.remove(name))
    const label = make('span')
    label.textContent = name
    handle.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      this.#dragging = card
      card.toggleAttribute('data-dragging', true)
    })
    handle.addEventListener('keydown', (event) => {
      const by = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[event.key]
      if (!by) return
      event.preventDefault()
      this.#move(card, by, handle)
    })
    up.addEventListener('click', () => this.#move(card, -1, up))
    down.addEventListener('click', () => this.#move(card, 1, down))
    remove.addEventListener('click', () => {
      card.hidden = true
      this.#arrows()
      this.querySelector<HTMLElement>(':scope > [data-part="add"]')?.focus()
    })
    strip.append(handle, up, down, label, remove)
    card.append(strip)
    this.#built.push(strip)
  }

  // Moves a card one place among the shown cards, and keeps focus on the control that moved it.
  #move(card: HTMLElement, by: number, focus: HTMLButtonElement): void {
    const shown = this.#cards()
    const next = shown[shown.indexOf(card) + by]
    if (!next) return
    if (by < 0) next.before(card)
    else next.after(card)
    this.#arrows()
    // An arrow that moved its card to the end is disabled now, so the other arrow takes the focus.
    const other = focus.dataset.part === 'up' ? 'down' : 'up'
    ;(focus.disabled ? focus.parentElement?.querySelector<HTMLElement>(`[data-part="${other}"]`) : focus)?.focus()
  }

  #arrows(): void {
    const shown = this.#cards()
    for (const [i, card] of shown.entries()) {
      const up = card.querySelector<HTMLButtonElement>(':scope > [data-part="strip"] > [data-part="up"]')
      const down = card.querySelector<HTMLButtonElement>(':scope > [data-part="strip"] > [data-part="down"]')
      if (up) up.disabled = i === 0
      if (down) down.disabled = i === shown.length - 1
    }
    // The library offers only the cards the page does not show, a removed one among them.
    const library = this.#library()
    if (!library) return
    // With no entry left to find the list by, an entry goes in the modal's body, after its header.
    const list =
      library.querySelector('[card]')?.parentElement ?? library.querySelector('dialog > header + *') ?? library
    for (const card of this.#cards(true).filter((one) => one.hidden)) {
      const id = card.getAttribute('card') ?? ''
      if (library.querySelector(`[card="${CSS.escape(id)}"]`)) continue
      const entry = make('button', { type: 'button', card: id })
      entry.textContent = this.#nameOf(card)
      list.append(entry)
    }
    for (const entry of library.querySelectorAll<HTMLElement>('[card]')) {
      entry.hidden = this.#cards().some((card) => card.getAttribute('card') === entry.getAttribute('card'))
    }
  }

  // Puts a card back at the end: the page's own card if it holds it, or else a placeholder in its
  // place, which the page draws as the card itself after Done.
  #putBack(id: string, name: string): void {
    const tile = this.querySelector(':scope > [data-part="add"]')
    let card = this.#cards(true).find((one) => one.getAttribute('card') === id)
    if (card) {
      card.hidden = false
    } else {
      card = kitTag('e-card', { card: id, heading: name, 'data-placeholder': '' })
      const later = kitTag('e-text', { tone: 'subdued' })
      later.textContent = this.#say.later
      card.append(later)
      this.#strip(card)
    }
    tile?.before(card)
    this.#arrows()
  }

  #reset(): void {
    const ids = (this.getAttribute('default') ?? '').split(/\s+/).filter(Boolean)
    const library = this.#library()
    for (const card of this.#cards(true)) {
      if (ids.includes(card.getAttribute('card') ?? '')) continue
      if (card.hasAttribute('data-placeholder')) card.remove()
      else card.hidden = true
    }
    for (const id of ids) {
      const name = library?.querySelector(`[card="${CSS.escape(id)}"]`)?.textContent?.trim() ?? id
      this.#putBack(id, name)
    }
  }

  #done(): void {
    const name = this.getAttribute('name')
    const form = this.closest('form')
    const ids = this.#cards().map((card) => card.getAttribute('card'))
    this.#leave()
    if (!name) return
    const found = form?.elements.namedItem(name) ?? this.querySelector(`:scope > input[name="${CSS.escape(name)}"]`)
    const field = found instanceof HTMLInputElement ? found : make('input', { type: 'hidden', name })
    if (!field.isConnected) this.append(field)
    field.value = ids.join(' ')
    form?.requestSubmit()
  }

  #leave(): void {
    for (const part of this.#built) part.remove()
    this.#built = []
    this.removeAttribute('editing')
    this.#expanded(false)
  }

  #drag = (event: PointerEvent): void => {
    const card = this.#dragging
    if (!card) return
    // The card under the pointer, its strip included. A touch keeps its events on the handle, so the
    // card is found by the point, not by the event's target.
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[card]')
    const over = this.#cards().find((one) => one === target && one !== card)
    if (!over) return
    // The far half of the card under the pointer, across and down, puts the card after it.
    const { left, top, width, height } = over.getBoundingClientRect()
    const later = (event.clientX - left) / width + (event.clientY - top) / height > 1
    const shown = this.#cards()
    const at = shown.indexOf(over) + (later ? 1 : 0)
    if (shown[at] === card || shown[at - 1] === card) return
    if (later) over.after(card)
    else over.before(card)
    this.#arrows()
  }

  #drop = (): void => {
    this.#dragging?.removeAttribute('data-dragging')
    this.#dragging = null
  }
}

export function defineArrangedCards(): void {
  if (!customElements.get('e-arranged-cards')) customElements.define('e-arranged-cards', EArrangedCards)
}
