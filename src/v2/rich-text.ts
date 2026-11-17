// e-rich-text: adopts the <textarea name> written inside the tag, which holds the body's HTML, so a
// form posts it before the script and with it off. The script draws one bordered box: a toolbar of
// icon buttons over an editable body that grows from 240 px. Every edit writes the body's cleaned
// HTML to the text area and fires input, so the save bar counts it; a body that cleans to what the
// page opened with writes the opening HTML back as it was, so an undo leaves nothing to save.
import { langOf } from '../lang.ts'
import { markError } from './field.ts'
import { onLangChange } from './speech.ts'

type Tool = 'bold' | 'italic' | 'underline' | 'heading' | 'list' | 'quote' | 'link' | 'image' | 'html'

const words = {
  en: {
    tools: 'Formatting',
    bold: 'Bold',
    italic: 'Italic',
    underline: 'Underline',
    heading: 'Heading',
    list: 'List',
    quote: 'Quote',
    link: 'Link',
    image: 'Image',
    html: 'Show HTML',
    address: 'Address',
    imageAddress: 'Image address',
    alt: 'Alt text',
    insert: 'Insert',
    remove: 'Remove link',
    cancel: 'Cancel',
    refused: 'Enter an address that starts with https:// or /',
  },
  bn: {
    tools: 'ফরম্যাটিং',
    bold: 'বোল্ড',
    italic: 'ইটালিক',
    underline: 'আন্ডারলাইন',
    heading: 'শিরোনাম',
    list: 'তালিকা',
    quote: 'উদ্ধৃতি',
    link: 'লিংক',
    image: 'ছবি',
    html: 'HTML দেখান',
    address: 'ঠিকানা',
    imageAddress: 'ছবির ঠিকানা',
    alt: 'বিকল্প লেখা',
    insert: 'যোগ করুন',
    remove: 'লিংক সরান',
    cancel: 'বাতিল',
    refused: 'https:// বা / দিয়ে শুরু একটি ঠিকানা লিখুন',
  },
}

const icons: Record<Tool, string> = {
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  heading: 'heading',
  list: 'list',
  quote: 'text-quote',
  link: 'link',
  image: 'image',
  html: 'code',
}

// The tags the body keeps, each as it is written; a tag not here keeps its content and loses
// itself, and the ones in dropped go with their content.
const kept: Record<string, string> = {
  P: 'p',
  DIV: 'p',
  BR: 'br',
  STRONG: 'strong',
  B: 'strong',
  EM: 'em',
  I: 'em',
  U: 'u',
  H1: 'h2',
  H2: 'h2',
  H3: 'h2',
  H4: 'h2',
  H5: 'h2',
  H6: 'h2',
  UL: 'ul',
  OL: 'ul',
  LI: 'li',
  BLOCKQUOTE: 'blockquote',
  A: 'a',
  IMG: 'img',
}
const dropped =
  /^(SCRIPT|STYLE|TEMPLATE|IFRAME|OBJECT|EMBED|NOSCRIPT|SVG|MATH|HEAD|TITLE|META|LINK|BUTTON|SELECT|TEXTAREA|INPUT)$/
const blocks = /^(p|h2|ul|blockquote)$/

// An address a link or image may name: http, https, mailto or tel, or a path on this site. A
// browser reads a backslash as a slash and drops tabs and line breaks, so /\host is another site.
export function safeAddress(address: string, image = false): boolean {
  const trimmed = address.trim()
  if (/^\//.test(trimmed)) return !/^\/[/\\]|[\\\t\n\r]/.test(trimmed)
  try {
    return (image ? ['http:', 'https:'] : ['http:', 'https:', 'mailto:', 'tel:']).includes(new URL(trimmed).protocol)
  } catch {
    return false
  }
}

// Whether an element holds a block, as a pasted <div> of paragraphs or Google Docs' <b> around them.
const holdsBlock = (node: Element) => !!node.querySelector('p, div, h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote')

// Copies node's children into to, keeping only the toolbar's own formatting. A tag that holds blocks
// passes them through rather than wrap them: a <div> of paragraphs keeps its paragraphs apart, and
// a bold, italic or link around paragraphs, as Google Docs writes its whole paste, is dropped.
function copy(from: Node, to: Node): void {
  for (const node of from.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      to.appendChild(document.createTextNode(node.textContent ?? ''))
      continue
    }
    if (!(node instanceof Element) || dropped.test(node.nodeName.toUpperCase())) continue
    const tag = kept[node.nodeName.toUpperCase()]
    const inline = tag && !blocks.test(tag) && tag !== 'li' && tag !== 'br' && tag !== 'img'
    const plain = /font-weight:\s*(normal|400)/.test(node.getAttribute('style') ?? '')
    if (!tag || ((inline || node.nodeName === 'DIV') && holdsBlock(node)) || (tag === 'strong' && plain)) {
      copy(node, to)
      continue
    }
    const made = document.createElement(tag)
    if (tag === 'a') {
      const href = node.getAttribute('href') ?? ''
      if (!safeAddress(href)) {
        copy(node, to)
        continue
      }
      made.setAttribute('href', href.trim())
    }
    if (tag === 'img') {
      const src = node.getAttribute('src') ?? ''
      if (!safeAddress(src, true)) continue
      made.setAttribute('src', src.trim())
      made.setAttribute('alt', node.getAttribute('alt') ?? '')
    }
    copy(node, made)
    // A block in a paragraph, heading or list item gives up its own tag; a list in an item nests.
    const within = to instanceof Element && /^(P|H2|LI)$/.test(to.nodeName)
    if (blocks.test(tag) && within && !(tag === 'ul' && to.nodeName === 'LI')) to.append(...made.childNodes)
    else to.appendChild(made)
  }
}

// HTML with only the toolbar's own formatting: the parse is a template's, which runs nothing and
// loads nothing, and loose text at the top goes into paragraphs.
export function cleanHtml(html: string): string {
  const parsed = document.createElement('template')
  parsed.innerHTML = html
  const clean = document.createElement('template').content
  copy(parsed.content, clean)
  const out = document.createElement('div')
  let paragraph: HTMLElement | null = null
  for (const node of [...clean.childNodes]) {
    if (node instanceof Element && blocks.test(node.localName)) {
      paragraph = null
      if (node.localName !== 'p' || node.innerHTML.trim()) out.append(node)
      continue
    }
    if (!paragraph && !(node.textContent ?? '').trim() && !(node instanceof HTMLImageElement)) continue
    if (!paragraph) out.append((paragraph = document.createElement('p')))
    paragraph.append(node)
  }
  return out.innerHTML
}

// The text area's own value property, which the tag's override reads and writes through.
const native = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!
const read = (field: HTMLTextAreaElement): string => native.get!.call(field)
const write = (field: HTMLTextAreaElement, value: string) => native.set!.call(field, value)

let count = 0

function made(tag: string, attributes: Record<string, string>, text = ''): HTMLElement {
  const element = document.createElement(tag)
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)
  element.textContent = text
  return element
}

type Modal = HTMLElement & { show?: () => void; hide?: () => void }

/**
 * A rich text editor writes a body of formatted text, such as a page's content: bold, italic,
 * underline, a heading, a list and a quote, and its HTML to read or change by hand. The body's HTML
 * is the value of the `<textarea>` written inside the tag, which joins the form; with JavaScript off
 * that text area shows and posts the HTML. Pasted text keeps only that formatting.
 * @tag e-rich-text
 * @attr label - The label above the box.
 * @attr name - The name the HTML has in its form, given to a written text area that has none.
 * @attr error - A message shown under the box, which then reads invalid. Typing in it clears it.
 * @fires e-rich-text-image - Image was pressed. Bubbles and can be cancelled; detail is `{ insert }`. A page that offers its own images, as the Admin offers the store's Files, calls `preventDefault()` and later `detail.insert({ src, alt })`; with no page answering, the editor asks for the image's address and alt text itself.
 * @slot - The field's own `<textarea>`, holding the body's HTML, written inside so the form posts it before the script.
 */
export class ERichText extends HTMLElement {
  static observedAttributes = ['label', 'error']

  #field: HTMLTextAreaElement | null = null
  #label = document.createElement('span')
  #body = document.createElement('div')
  #tools = document.createElement('div')
  #box = document.createElement('div')
  #buttons = new Map<Tool, HTMLButtonElement>()
  #opening = ''
  // The opening body as the editor first drew it, which a second cleaning may write differently.
  #drawn = ''
  #modal: Modal | null = null
  // The body's selection when a tool that asks first was pressed, put back as it acts.
  #range: Range | null = null
  #stop: (() => void) | undefined
  #follow = () => this.#pressed()

  connectedCallback(): void {
    this.#stop = onLangChange(() => this.#say())
    document.addEventListener('selectionchange', this.#follow)
    if (this.#field) return
    const field = this.querySelector('textarea') ?? document.createElement('textarea')
    const name = this.getAttribute('name')
    if (name && !field.name) field.name = name
    this.#field = field
    this.#opening = read(field)
    // A value written to the field, as the save bar's Discard writes, is drawn in the body.
    Object.defineProperty(field, 'value', {
      configurable: true,
      get: () => read(field),
      set: (value: string) => {
        write(field, value)
        this.#draw()
      },
    })
    const id = `e-rich-text-${++count}`
    this.#label.id = `${id}-label`
    this.#label.dataset.part = 'label'
    field.setAttribute('aria-labelledby', this.#label.id)
    const box = this.#box
    box.dataset.part = 'box'
    this.#tools.setAttribute('role', 'toolbar')
    this.#tools.dataset.part = 'tools'
    for (const tool of Object.keys(icons) as Tool[]) {
      const button = document.createElement('button')
      button.type = 'button'
      button.innerHTML = `<e-icon name="${icons[tool]}"></e-icon>`
      button.setAttribute('aria-pressed', 'false')
      // A press keeps the body's selection, so the tool acts on what was selected.
      button.addEventListener('mousedown', (event) => event.preventDefault())
      button.addEventListener('click', () => this.#use(tool))
      this.#buttons.set(tool, button)
      this.#tools.append(button)
    }
    this.#body.dataset.part = 'body'
    this.#body.contentEditable = 'true'
    this.#body.setAttribute('role', 'textbox')
    this.#body.setAttribute('aria-multiline', 'true')
    this.#body.setAttribute('aria-labelledby', this.#label.id)
    this.#body.addEventListener('input', () => {
      this.removeAttribute('error')
      this.#write(this.#cleanBody())
    })
    this.#body.addEventListener('paste', (event) => this.#paste(event))
    // A click in a link puts the caret there, to change or remove it, rather than follow it.
    this.#body.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('a')) event.preventDefault()
    })
    field.addEventListener('input', (event) => {
      if (event.isTrusted) this.removeAttribute('error')
    })
    box.append(this.#tools, this.#body, field)
    this.prepend(this.#label, box)
    this.#draw()
    this.#drawn = this.#cleanBody()
    this.#say()
    markError(this, this.#body)
  }

  disconnectedCallback(): void {
    this.#stop?.()
    document.removeEventListener('selectionchange', this.#follow)
  }

  attributeChangedCallback(name: string): void {
    if (!this.#field) return
    if (name === 'label') this.#say()
    else markError(this, this.#body)
  }

  #cleanBody(): string {
    return cleanHtml(this.#body.innerHTML)
  }

  // Writes html to the field and tells the form, unless the field holds it already. A body that is
  // the opening one, cleaned, writes the opening HTML as the page wrote it.
  #write(html: string): void {
    const field = this.#field!
    const value = html === this.#drawn || html === cleanHtml(this.#opening) ? this.#opening : html
    if (read(field) === value) return
    write(field, value)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  }

  #draw(): void {
    this.#body.innerHTML = cleanHtml(read(this.#field!))
  }

  #use(tool: Tool): void {
    if (tool === 'html') return this.#swap()
    if (tool === 'link') return this.#link()
    if (tool === 'image') return this.#image()
    this.#body.focus()
    document.execCommand('defaultParagraphSeparator', false, 'p')
    const at = this.#at()
    if (tool === 'heading') document.execCommand('formatBlock', false, at('h2') ? 'p' : 'h2')
    else if (tool === 'list') this.#keepingSelection(() => document.execCommand('insertUnorderedList'))
    else if (tool === 'quote') document.execCommand(at('blockquote') ? 'outdent' : 'formatBlock', false, 'blockquote')
    else document.execCommand(tool)
    this.#pressed()
  }

  // Chromium's list command moves the caret to the start of the line it lists, and draws the line's
  // text anew, so Enter after List split the line before its text. The command adds no text, so a
  // selection in text goes back to the same letters. One in an empty line Chromium keeps itself.
  #keepingSelection(command: () => void): void {
    const selection = getSelection()!
    const range = selection.rangeCount ? selection.getRangeAt(0) : null
    const inText = (node: Node) => node.nodeType === Node.TEXT_NODE && this.#body.contains(node)
    const ends =
      range && inText(range.startContainer) && inText(range.endContainer)
        ? [this.#letter(range.startContainer, range.startOffset), this.#letter(range.endContainer, range.endOffset)]
        : null
    command()
    if (!ends) return
    const [start, end] = ends.map((letter) => this.#place(letter))
    if (start && end) selection.setBaseAndExtent(start[0], start[1], end[0], end[1])
  }

  // Where a place sits in the body's text: the letters before it, and whether it opens its text node,
  // which tells the end of one line from the start of the next.
  #letter(node: Node, offset: number): { before: number; opens: boolean } {
    const range = document.createRange()
    range.setStart(this.#body, 0)
    range.setEnd(node, offset)
    return { before: range.toString().length, opens: offset === 0 }
  }

  #place({ before, opens }: { before: number; opens: boolean }): [Node, number] | null {
    const walker = document.createTreeWalker(this.#body, NodeFilter.SHOW_TEXT)
    let left = before
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const length = node.textContent!.length
      if (opens ? left < length : left <= length) return [node, left]
      left -= length
    }
    return null
  }

  // Show HTML puts the field in the body's place, and back draws what it holds.
  #swap(): void {
    const html = this.#box.dataset.mode !== 'html'
    if (html) this.#box.dataset.mode = 'html'
    else {
      delete this.#box.dataset.mode
      this.#draw()
      this.#write(this.#cleanBody())
    }
    for (const [tool, button] of this.#buttons) button.disabled = html && tool !== 'html'
    this.#buttons.get('html')!.setAttribute('aria-pressed', String(html))
    ;(html ? this.#field! : this.#body).focus()
  }

  #keep(): void {
    const selection = getSelection()
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null
    this.#range = range && this.#body.contains(range.commonAncestorContainer) ? range.cloneRange() : null
  }

  // Puts the kept selection back in the body, or the caret at its end.
  #restore(): void {
    this.#body.focus()
    const selection = getSelection()!
    if (!this.#range) {
      this.#range = document.createRange()
      this.#range.selectNodeContents(this.#body)
      this.#range.collapse(false)
    }
    selection.removeAllRanges()
    selection.addRange(this.#range)
  }

  // A modal of fields, each [label, value]. done gets their values and returns an error to show under
  // the first field, or what to do once the modal has closed, as the page is inert while it shows.
  #ask(
    heading: string,
    fields: [string, string][],
    done: (values: string[]) => string | (() => void),
    remove?: () => void,
  ) {
    const say = words[langOf(this)]
    // A new modal each time, as e-modal takes its footer from the children it starts with.
    this.#modal?.remove()
    const modal: Modal = made('e-modal', { width: '420', heading })
    this.#modal = modal
    const inputs = fields.map(([label, value]) => made('e-text-field', { label, value }))
    const insert = made('e-button', { type: 'button', tone: 'primary', slot: 'footer' }, say.insert)
    const cancel = made('e-button', { type: 'button', slot: 'footer' }, say.cancel)
    const apply = () => {
      const next = done(inputs.map((input) => input.querySelector('input')?.value.trim() ?? ''))
      if (typeof next === 'string') return inputs[0]!.setAttribute('error', next)
      modal.hide?.()
      next()
    }
    insert.addEventListener('click', apply)
    cancel.addEventListener('click', () => modal.hide?.())
    if (remove) {
      const unlink = made('e-button', { type: 'button', tone: 'danger', slot: 'footer' }, say.remove)
      unlink.addEventListener('click', () => {
        modal.hide?.()
        remove()
      })
      modal.append(unlink)
    }
    modal.append(...inputs, cancel, insert)
    // Enter in a field is the modal's Insert, not the form's Save.
    modal.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || !(event.target instanceof HTMLInputElement)) return
      event.preventDefault()
      apply()
    })
    this.append(modal)
    modal.show?.()
    inputs[0]?.querySelector('input')?.focus()
  }

  // Link wraps the selection in a link to the address asked for; on a link it changes or removes it.
  #link(): void {
    this.#keep()
    const node = this.#range?.startContainer
    const found = (node instanceof Element ? node : node?.parentElement)?.closest('a')
    const link = found && this.#body.contains(found) ? found : null
    const say = words[langOf(this)]
    const select = () => {
      this.#restore()
      if (link) getSelection()!.selectAllChildren(link)
    }
    this.#ask(
      say.link,
      [[say.address, link?.getAttribute('href') ?? '']],
      ([href = '']) => {
        if (!safeAddress(href)) return say.refused
        return () => {
          select()
          if (getSelection()!.isCollapsed) {
            const made = document.createElement('a')
            made.href = href
            made.textContent = href
            document.execCommand('insertHTML', false, made.outerHTML)
          } else document.execCommand('createLink', false, href)
        }
      },
      link
        ? () => {
            select()
            document.execCommand('unlink')
          }
        : undefined,
    )
  }

  // Image asks the page for one; with no page answering, the editor asks for its address and alt text.
  #image(): void {
    this.#keep()
    const insert = ({ src, alt = '' }: { src: string; alt?: string }) => {
      if (!safeAddress(src, true)) return
      const image = document.createElement('img')
      image.setAttribute('src', src)
      image.setAttribute('alt', alt)
      this.#restore()
      document.execCommand('insertHTML', false, image.outerHTML)
    }
    const asked = new CustomEvent('e-rich-text-image', { bubbles: true, cancelable: true, detail: { insert } })
    if (!this.dispatchEvent(asked)) return
    const say = words[langOf(this)]
    this.#ask(
      say.image,
      [
        [say.imageAddress, ''],
        [say.alt, ''],
      ],
      ([src = '', alt]) => (safeAddress(src, true) ? () => insert({ src, alt }) : say.refused),
    )
  }

  #paste(event: ClipboardEvent): void {
    const data = event.clipboardData
    if (!data) return
    event.preventDefault()
    const html = data.getData('text/html')
    const text = data.getData('text/plain')
    if (html) document.execCommand('insertHTML', false, cleanHtml(html))
    else document.execCommand('insertText', false, text)
  }

  // Whether the caret sits in a tag of this name inside the body.
  #at(): (tag: string) => boolean {
    const node = getSelection()?.anchorNode
    const element = node instanceof Element ? node : node?.parentElement
    return (tag) => {
      const found = element?.closest(tag)
      return !!found && this.#body.contains(found)
    }
  }

  #pressed(): void {
    const node = getSelection()?.anchorNode
    if (!node || !this.#body.contains(node)) return
    const at = this.#at()
    const state: Partial<Record<Tool, boolean>> = {
      bold: !!at('strong, b'),
      italic: !!at('em, i'),
      underline: !!at('u'),
      heading: at('h2'),
      list: at('ul'),
      quote: at('blockquote'),
    }
    for (const [tool, pressed] of Object.entries(state))
      this.#buttons.get(tool as Tool)!.setAttribute('aria-pressed', String(pressed))
  }

  #say(): void {
    const say = words[langOf(this)]
    this.#label.textContent = this.getAttribute('label') ?? ''
    this.#tools.setAttribute('aria-label', say.tools)
    for (const [tool, button] of this.#buttons) button.setAttribute('aria-label', say[tool])
  }
}

export function defineRichText(): void {
  if (!customElements.get('e-rich-text')) customElements.define('e-rich-text', ERichText)
}
