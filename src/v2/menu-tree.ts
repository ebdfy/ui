// e-menu-tree and e-menu-tree-item: a menu's items as a tree of up to 3 levels, which the Admin's
// Menu page arranges. Each item draws one row: a drag handle, its label, and Edit and Delete. The
// handle moves the item with its children, by drag or by keyboard. The tree keeps one hidden field
// of the items as the API takes them, so the save bar counts every change, and a value written back
// to the field, as Discard writes, draws those items again.
import { langOf } from '../lang.ts'
import { onLangChange } from './speech.ts'

const deepest = 3

const words = {
  en: {
    move: (item: string) => `Move ${item}`,
    edit: (item: string) => `Edit ${item}`,
    remove: (item: string) => `Delete ${item}`,
    add: 'Add menu item',
    addTo: (item: string) => `Add menu item to ${item}`,
    deep: 'Menus go 3 levels deep',
  },
  bn: {
    move: (item: string) => `${item} সরান`,
    edit: (item: string) => `${item} সম্পাদনা করুন`,
    remove: (item: string) => `${item} মুছুন`,
    add: 'মেনু আইটেম যোগ করুন',
    addTo: (item: string) => `${item}-এ মেনু আইটেম যোগ করুন`,
    deep: 'মেনু ৩ স্তর পর্যন্ত যায়',
  },
}

// A menu item as the API takes it: a title, a resourceId or a url, and its items.
export interface MenuItem {
  title: string
  resourceId?: string
  url?: string
  items: MenuItem[]
}

type Target = Pick<MenuItem, 'title' | 'resourceId' | 'url'>

const isItem = (node: Node | null | undefined): node is Element =>
  node instanceof Element && node.localName === 'e-menu-tree-item'
const itemsOf = (parent: Element): Element[] => [...parent.children].filter(isItem)
const levelOf = (item: Element): number => {
  let level = 0
  for (let at: Element | null = item; isItem(at); at = at.parentElement) level++
  return level
}
const heightOf = (item: Element): number => 1 + Math.max(0, ...itemsOf(item).map(heightOf))

function itemOf(item: Element): MenuItem {
  const id = item.getAttribute('resource-id')
  const target = id === null ? { url: item.getAttribute('url') ?? '' } : { resourceId: id }
  return { title: item.getAttribute('label') ?? '', ...target, items: itemsOf(item).map(itemOf) }
}

function made(tag: string, attributes: Record<string, string>, html = ''): HTMLElement {
  const element = document.createElement(tag)
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)
  element.innerHTML = html
  return element
}

// An item element for a target, its children made too.
function build({ title, resourceId, url, items }: MenuItem): Element {
  const item = made('e-menu-tree-item', { label: title })
  if (resourceId !== undefined) item.setAttribute('resource-id', resourceId)
  else item.setAttribute('url', url ?? '')
  item.append(...(items ?? []).map(build))
  return item
}

// The input's own value property, which the tree's override reads and writes through.
const native = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!
const read = (field: HTMLInputElement): string => native.get!.call(field)
const write = (field: HTMLInputElement, value: string) => native.set!.call(field, value)

// An icon button, or with words, a button of the icon and its words.
const button = (part: string, icon: string, words = false) =>
  made(
    'button',
    { type: 'button', 'data-part': part },
    `<e-icon name="${icon}"></e-icon>${words ? '<span></span>' : ''}`,
  )

const relabel = (button: Element, text: string) => {
  button.querySelector('span')!.textContent = text
}

/**
 * A menu's items as a tree, up to 3 levels deep: each `e-menu-tree-item` a row with a drag handle, its
 * label, and Edit and Delete. Dragging a row, or Up, Down, Right and Left on its handle, moves it with
 * its children; a move that would make a fourth level is refused. Inside a form, the tree keeps a
 * hidden field named `name` holding its items as the API takes them:
 * `[{"title":"Home","url":"/","items":[]}, …]`. Add and Edit ask the page by an event, which opens
 * its own modal and hands the item back.
 * @tag e-menu-tree
 * @attr name - The name of the field the items are submitted under, as JSON.
 * @attr label - What the tree is, such as "Menu items", read by a screen reader.
 * @attr error - A message shown under the tree, as the Admin's refusal of a save sets it.
 * @slot - The top level's `e-menu-tree-item`s.
 * @fires e-menu-tree-add - Add menu item was pressed. Bubbles; detail is `{ parent, done }`: `parent` is the item to add under, or null for the top level, and `done({ title, resourceId })` or `done({ title, url })` adds the item last there.
 * @fires e-menu-tree-edit - Edit was pressed. Bubbles; detail is `{ item, done }`: `item` is `{ title, resourceId }` or `{ title, url }`, and `done` with a new one changes it.
 */
export class EMenuTree extends HTMLElement {
  static observedAttributes = ['error']

  #field: HTMLInputElement | null = null
  #addLast = button('add', 'plus', true)
  #note = made('p', { 'data-part': 'note', role: 'status' })
  #error = made('p', { 'data-e-error': '' })
  #stop: (() => void) | undefined
  #drag: { item: Element; row: HTMLElement | null; where: string } | null = null

  connectedCallback(): void {
    this.#stop = onLangChange(() => this.#draw())
    if (this.#field) return
    this.setAttribute('role', 'group')
    this.append(this.#addLast, this.#note)
    this.addEventListener('click', (event) => this.#click(event))
    this.addEventListener('keydown', (event) => this.#key(event))
    this.addEventListener('pointerdown', (event) => this.#grab(event))
    this.#draw()
    const name = this.getAttribute('name')
    if (!name || !this.closest('form')) return
    const field = made('input', { type: 'hidden', name }) as HTMLInputElement
    write(field, this.#json())
    Object.defineProperty(field, 'value', {
      configurable: true,
      get: () => read(field),
      set: (value: string) => {
        write(field, value)
        this.#follow(value)
      },
    })
    this.#field = field
    this.prepend(field)
    this.attributeChangedCallback()
  }

  disconnectedCallback(): void {
    this.#stop?.()
  }

  attributeChangedCallback(): void {
    const error = this.getAttribute('error')
    this.#error.textContent = error ?? ''
    if (error) this.append(this.#error)
    else this.#error.remove()
  }

  #json(): string {
    return JSON.stringify(itemsOf(this).map(itemOf))
  }

  // Draws each item's row, the add buttons and the words, in the page's language.
  #draw(): void {
    const say = words[langOf(this)]
    this.setAttribute('aria-label', this.getAttribute('label') ?? '')
    relabel(this.#addLast, say.add)
    for (const item of this.querySelectorAll('e-menu-tree-item')) {
      const label = item.getAttribute('label') ?? ''
      let row = item.querySelector<HTMLElement>(':scope > [data-part="row"]')
      if (!row) {
        row = made('div', { 'data-part': 'row' })
        row.append(
          button('handle', 'grip-vertical'),
          made('span', { 'data-part': 'label' }),
          button('edit', 'pencil'),
          button('delete', 'trash'),
        )
        item.prepend(row)
      }
      row.querySelector('[data-part="label"]')!.textContent = label
      row.querySelector('[data-part="handle"]')!.setAttribute('aria-label', say.move(label))
      row.querySelector('[data-part="edit"]')!.setAttribute('aria-label', say.edit(label))
      row.querySelector('[data-part="delete"]')!.setAttribute('aria-label', say.remove(label))
      // A group ends in its own add; a third-level item takes no children.
      let add = item.querySelector<HTMLElement>(':scope > [data-part="add"]')
      if (!itemsOf(item).length || levelOf(item) >= deepest) {
        add?.remove()
        continue
      }
      add ??= button('add', 'plus', true)
      relabel(add, say.addTo(label))
      item.append(add)
    }
  }

  // Writes the items to the field, and tells the save bar when they changed.
  #sync(): void {
    this.#draw()
    const field = this.#field
    if (!field || read(field) === this.#json()) return
    write(field, this.#json())
    field.dispatchEvent(new Event('input', { bubbles: true }))
  }

  // Draws the items a value written to the field names, as Discard writes the saved ones back.
  #follow(value: string): void {
    if (value === this.#json()) return
    let items: MenuItem[] = []
    try {
      items = JSON.parse(value) as MenuItem[]
    } catch {}
    for (const item of itemsOf(this)) item.remove()
    this.#addLast.before(...items.map(build))
    this.#draw()
  }

  #say(item: Element | null, note: string): void {
    this.#note.textContent = note
    const row = item?.querySelector(':scope > [data-part="row"]')
    if (row && note) row.append(this.#note)
    else this.append(this.#note)
  }

  // Moves item to sit where (before or after other, or last under it), unless that would put it in
  // its own children or make a fourth level. Returns whether it moved.
  #move(item: Element, other: Element | null, where: 'before' | 'after' | 'under'): boolean {
    this.#say(item, '')
    if (!other || other === item || item.contains(other)) return false
    const level = where === 'under' ? levelOf(other) + 1 : levelOf(other)
    if (level + heightOf(item) - 1 > deepest) {
      this.#say(item, words[langOf(this)].deep)
      return false
    }
    if (where === 'before') other.before(item)
    else if (where === 'after') other.after(item)
    else other.querySelector(':scope > [data-part="add"]')?.before(item) ?? other.append(item)
    this.#sync()
    return true
  }

  #click(event: Event): void {
    const part = event.target instanceof Element ? event.target.closest('button[data-part]') : null
    if (!part || !this.contains(part)) return
    const item = part.closest('e-menu-tree-item')
    const kind = part.getAttribute('data-part')
    if (kind === 'delete' && item) {
      const next = item.nextElementSibling ?? item.previousElementSibling
      item.remove()
      this.#sync()
      ;(next?.querySelector<HTMLElement>('[data-part="handle"]') ?? this.#addLast).focus()
    }
    if (kind === 'add') {
      const parent = part === this.#addLast ? null : item
      const done = (target: Target) => {
        const made = build({ ...target, items: [] })
        ;(parent?.querySelector(':scope > [data-part="add"]') ?? this.#addLast).before(made)
        this.#sync()
      }
      this.dispatchEvent(new CustomEvent('e-menu-tree-add', { bubbles: true, detail: { parent, done } }))
    }
    if (kind === 'edit' && item) {
      const { title, resourceId, url } = itemOf(item)
      const done = (target: Target) => {
        item.setAttribute('label', target.title)
        item.removeAttribute('resource-id')
        item.removeAttribute('url')
        if (target.resourceId !== undefined) item.setAttribute('resource-id', target.resourceId)
        else item.setAttribute('url', target.url ?? '')
        this.#sync()
      }
      const target = resourceId === undefined ? { title, url } : { title, resourceId }
      this.dispatchEvent(new CustomEvent('e-menu-tree-edit', { bubbles: true, detail: { item: target, done } }))
    }
  }

  // Up and Down move the item among its siblings, Right puts it under the item above, and Left lifts
  // it out of its parent, to sit after it.
  #key(event: KeyboardEvent): void {
    const handle = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-part="handle"]') : null
    const item = handle?.closest('e-menu-tree-item')
    if (!handle || !item) return
    const before = item.previousElementSibling
    const after = item.nextElementSibling
    const parent = item.parentElement
    const moves: Record<string, () => boolean> = {
      ArrowUp: () => this.#move(item, isItem(before) ? before : null, 'before'),
      ArrowDown: () => this.#move(item, isItem(after) ? after : null, 'after'),
      ArrowRight: () => this.#move(item, isItem(before) ? before : null, 'under'),
      ArrowLeft: () => this.#move(item, isItem(parent) ? parent : null, 'after'),
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    move()
    handle.focus()
  }

  // A drag on a handle: the row under the pointer takes the item before it in its top third, after
  // it in its bottom third, and under it in between.
  #grab(event: PointerEvent): void {
    const handle = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-part="handle"]') : null
    const item = handle?.closest('e-menu-tree-item')
    if (!handle || !item || event.button !== 0) return
    event.preventDefault()
    handle.setPointerCapture(event.pointerId)
    const own = item.querySelector(':scope > [data-part="row"]')!
    own.toggleAttribute('data-dragging', true)
    this.#drag = { item, row: null, where: '' }
    const move = (moved: PointerEvent) => {
      const drag = this.#drag!
      drag.row?.removeAttribute('data-drop')
      const row = document
        .elementsFromPoint(moved.clientX, moved.clientY)
        .find((element) => element.matches('e-menu-tree [data-part="row"]') && this.contains(element)) as
        | HTMLElement
        | undefined
      drag.row = row && !item.contains(row) ? row : null
      if (!drag.row) return
      const box = drag.row.getBoundingClientRect()
      const at = (moved.clientY - box.top) / box.height
      drag.where = at < 1 / 3 ? 'before' : at > 2 / 3 ? 'after' : 'under'
      drag.row.setAttribute('data-drop', drag.where)
    }
    const end = (ended: PointerEvent) => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', end)
      handle.removeEventListener('pointercancel', end)
      own.removeAttribute('data-dragging')
      const drag = this.#drag!
      this.#drag = null
      drag.row?.removeAttribute('data-drop')
      if (ended.type === 'pointerup' && drag.row) {
        this.#move(item, drag.row.parentElement, drag.where as 'before' | 'after' | 'under')
      }
      handle.focus()
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', end)
    handle.addEventListener('pointercancel', end)
  }
}

/**
 * One item of a menu tree, its children the `e-menu-tree-item`s inside it.
 * @tag e-menu-tree-item
 * @attr label - The item's title, as the menu shows it. (Not `title`, which is HTML's tooltip.)
 * @attr resource-id - The product, collection, page, blog or article it links to.
 * @attr url - Or the address it links to: a path on the store, or an http or https address.
 * @slot - The item's own `e-menu-tree-item`s, one level down.
 */
export class EMenuTreeItem extends HTMLElement {}

export function defineMenuTree(): void {
  if (!customElements.get('e-menu-tree')) customElements.define('e-menu-tree', EMenuTree)
  if (!customElements.get('e-menu-tree-item')) customElements.define('e-menu-tree-item', EMenuTreeItem)
}
