import { LitElement, css, html, nothing, type PropertyValues } from 'lit'
import { live } from 'lit/directives/live.js'

import { langOf } from '../lang.ts'
import { focusRing } from '../tokens.ts'
import type { EbCheckbox } from './checkbox.ts'

// A table on a screen 600 px wide or more, a list of cards below it. The app writes
// <eb-column card="title|end|meta"> headings and <eb-row> rows whose child elements are the cells,
// so the table reads as text before it upgrades. The cells stay where the app put them: manual
// slot assignment places them in the table's cells or the card's lines.

const wide = matchMedia('(min-width: 600px)')

type Place = 'title' | 'end' | 'meta' | 'status'

function placeOf(column: Element | undefined): Place {
  const card = column?.getAttribute('card')
  return card === 'title' || card === 'end' || card === 'status' ? card : 'meta'
}

// A column with align="end", such as a total, ends its heading and cells on the right edge.
const endOf = (column: Element | undefined) => (column?.getAttribute('align') === 'end' ? 'end' : '')

// A column shows at any width unless it has priority="2", which steps aside below a 720 px table,
// or priority="3", below 900 px; a narrow table keeps its Order, Customer, Status and Total.
function showsAt(column: Element, width: number): boolean {
  const priority = column.getAttribute('priority')
  if (priority === '3') return width >= 900
  if (priority === '2') return width >= 720
  return true
}

// A row's child with card="note", such as a risk banner, is not a cell: a card shows it under its
// lines, and a table leaves it out, since its columns carry the same signal.
const isNote = (child: Element) => child.getAttribute('card') === 'note'

const columnsOf = (table: Element | null): Element[] =>
  table ? [...table.children].filter((child) => child.localName === 'eb-column') : []

// A column's grow attribute is its share of the table's width, 1 unless it is a positive number.
function growOf(column: Element): number {
  const grow = Number(column.getAttribute('grow'))
  return grow > 0 ? grow : 1
}

// The header and each row get the same shares, so they line up without measuring. A selectable
// table leads with a 40 px column of checkboxes.
const grid = (shares: number[], selectable = false) =>
  `grid-template-columns: ${selectable ? '40px ' : ''}${shares.map((share) => `minmax(0, ${share}fr)`).join(' ')}`

const words = {
  bn: { all: 'সব নির্বাচন', row: (name: string) => `${name} নির্বাচন` },
  en: { all: 'Select all', row: (name: string) => `Select ${name}` },
}

// A change of selection that the person made, heard by the app on the table.
const selection = () => new CustomEvent('eb-selection', { bubbles: true, composed: true })

const slotsIn = (root: ShadowRoot | null) => [...(root?.querySelectorAll('slot') ?? [])]

// Redraws an element when the screen crosses 600 px or its children change.
abstract class Responsive extends LitElement {
  static override shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, slotAssignment: 'manual' }

  private children$ = new MutationObserver(() => this.requestUpdate())
  private resize = () => this.requestUpdate()

  override connectedCallback(): void {
    super.connectedCallback()
    wide.addEventListener('change', this.resize)
    this.children$.observe(this, { childList: true })
  }

  override disconnectedCallback(): void {
    wide.removeEventListener('change', this.resize)
    this.children$.disconnect()
    super.disconnectedCallback()
  }

  protected wide(): boolean {
    return wide.matches
  }
}

/**
 * Lays out orders as a table on a screen 600 px wide or more and as one list of cards below it.
 *
 * @slot - The eb-column headings, then the eb-row rows.
 * @csspart skeleton - A placeholder row drawn while the table is loading.
 * @fires eb-selection - A person ticked or cleared a row, or all rows. Read the selected rows from the eb-row elements.
 */
export class EbTable extends Responsive {
  static override properties = {
    label: { type: String },
    loading: { type: Boolean, reflect: true },
    density: { type: String, reflect: true },
    selectable: { type: Boolean, reflect: true },
  }

  static override styles = css`
    :host {
      /* The rows are in the table's light DOM, so they read their height from here. */
      --eb-table-row-height: 44px;
      display: block;
      color: var(--eb-color-text);
      font-family: var(--eb-font-family);
      font-size: var(--eb-font-size-body);
      line-height: var(--eb-line-height-body);
    }
    :host([density='compact']) {
      --eb-table-row-height: 40px;
    }
    [role='table'] {
      overflow: hidden;
      border-radius: var(--eb-radius-card);
      background: var(--eb-color-surface);
      box-shadow:
        0 0 0 1px var(--eb-color-divider),
        var(--eb-shadow-1);
    }
    .head {
      display: grid;
      align-items: center;
      min-height: 36px;
      background: var(--eb-color-surface-2);
    }
    [role='columnheader'] {
      min-width: 0;
      padding: 8px 12px;
      color: var(--eb-color-text-2);
      font-size: var(--eb-font-size-meta);
      line-height: var(--eb-line-height-meta);
      font-weight: var(--eb-font-weight-medium);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    [role='columnheader'].end {
      text-align: end;
    }
    [role='columnheader'].check {
      display: grid;
      place-items: center;
      padding: 0;
    }
    /* On a phone the rows are one surface split by dividers; the first row's divider tucks under
       the list's edge. */
    [role='list'] {
      overflow: hidden;
      border-radius: var(--eb-radius-card);
      background: var(--eb-color-surface);
      box-shadow:
        0 0 0 1px var(--eb-color-divider),
        var(--eb-shadow-1);
    }
    [role='list'] > .rows {
      margin-top: -1px;
    }
    [part='skeleton'] {
      display: grid;
      gap: 12px var(--eb-space-card);
      padding: 18px var(--eb-space-card);
      border-top: 1px solid var(--eb-color-divider);
    }
    .bar {
      height: 12px;
      border-radius: 6px;
      background: var(--eb-color-divider);
      animation: pulse 1.5s ease-in-out infinite;
    }
    .bar.short {
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

  /** Names the table for a screen reader. */
  declare label: string
  /** Draws placeholder rows in place of the rows while the orders load. */
  declare loading: boolean
  /** The height of a row: comfortable or compact. Comfortable when unset. */
  declare density: 'comfortable' | 'compact'
  /** Adds a checkbox to each row and to the heading to select them. */
  declare selectable: boolean

  // The table's own width, which decides the columns that show. Until it is measured, all do.
  private width = Infinity
  private size$ = new ResizeObserver(([entry]) => {
    const before = this.shown().join()
    this.width = entry!.contentRect.width
    if (this.shown().join() !== before) this.requestUpdate()
  })

  constructor() {
    super()
    this.label = ''
    this.loading = false
    this.density = 'comfortable'
    this.selectable = false
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.size$.observe(this)
  }

  override disconnectedCallback(): void {
    this.size$.disconnect()
    super.disconnectedCallback()
  }

  // The indexes of the columns that show at the table's width; its rows draw the same cells.
  shown(): number[] {
    return columnsOf(this).flatMap((column, i) => (showsAt(column, this.width) ? [i] : []))
  }

  /** The rows the person has selected, in their order. */
  get selected(): EbRow[] {
    return this.rows().filter((row) => row.selected)
  }

  private rows(): EbRow[] {
    return [...this.children].filter((child): child is EbRow => child instanceof EbRow)
  }

  // The header's checkbox selects every row unless all are already selected, then clears them.
  private selectAll = (event: Event): void => {
    // SAFETY: this listener sits only on the header's eb-checkbox.
    const select = (event.target as EbCheckbox).checked
    for (const row of this.rows()) row.selected = select
    this.dispatchEvent(selection())
  }

  private headerCheckbox() {
    const rows = this.rows()
    const count = rows.filter((row) => row.selected).length
    const all = rows.length > 0 && count === rows.length
    return html`<div role="columnheader" class="check">
      <eb-checkbox
        hide-label
        label=${words[langOf(this)].all}
        .checked=${live(all)}
        .indeterminate=${live(count > 0 && !all)}
        @change=${this.selectAll}
      ></eb-checkbox>
    </div>`
  }

  // Four rows stand in for the ones on their way, a bar for each column or two lines of a card.
  private skeletons(columns: Element[]) {
    const bars = this.wide()
      ? html`${this.shown().map(() => html`<div class="bar"></div>`)}`
      : html`<div class="bar"></div>
          <div class="bar short"></div>`
    const style = this.wide() ? grid(this.shown().map((i) => growOf(columns[i]!))) : ''
    return Array.from({ length: 4 }, () => html`<div part="skeleton" aria-hidden="true" style=${style}>${bars}</div>`)
  }

  override render() {
    const columns = columnsOf(this)
    const shown = this.shown().map((i) => columns[i]!)
    const rows = this.loading ? this.skeletons(columns) : html`<slot class="rows"></slot>`
    if (!this.wide()) return html`<div role="list" aria-label=${this.label}><div class="rows">${rows}</div></div>`
    return html`<div role="table" aria-label=${this.label}>
      <div class="head" role="row" style=${grid(shown.map(growOf), this.selectable)}>
        ${this.selectable ? this.headerCheckbox() : ''}
        ${shown.map((column) => html`<div role="columnheader" class=${endOf(column)}><slot></slot></div>`)}
      </div>
      ${rows}
    </div>`
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    const rows = [...this.children].filter((child) => child.localName === 'eb-row')
    if (this.loading) this.setAttribute('aria-busy', 'true')
    else this.removeAttribute('aria-busy')
    const slots = slotsIn(this.shadowRoot)
    if (!this.loading) slots.pop()?.assign(...rows)
    const columns = columnsOf(this)
    const shown = this.shown()
    for (const [i, slot] of slots.entries()) slot.assign(...columns.slice(shown[i]!, shown[i]! + 1))
    // A row draws from its table's columns, so a change here redraws the rows too.
    for (const row of rows) if (row instanceof EbRow) row.requestUpdate()
  }
}

/**
 * One order in an eb-table: a row on a wide screen, a card on a phone.
 *
 * @slot - A cell of the row, in the order of the table's columns.
 * @slot title - The cell shown as the title of the card on a phone.
 * @slot end - The cell shown at the end of the card's title line.
 * @slot meta - A cell shown in the card's line of details.
 * @slot status - The cell shown as the card's status.
 * @slot note - A child shown under the card on a phone.
 * @csspart row - The row on a wide screen.
 * @csspart card - The card on a phone.
 * @fires eb-selection - A person ticked or cleared this row.
 */
export class EbRow extends Responsive {
  static override properties = {
    open: { type: Boolean, reflect: true },
    selected: { type: Boolean, reflect: true },
    href: { type: String, reflect: true },
  }

  static override styles = [
    focusRing,
    css`
      :host {
        display: block;
        color: var(--eb-color-text);
        font-family: var(--eb-font-family);
        font-size: var(--eb-font-size-body);
        line-height: var(--eb-line-height-body);
      }
      [part='row'] {
        position: relative;
        box-sizing: border-box;
        display: grid;
        align-items: center;
        min-height: var(--eb-table-row-height, 44px);
        border-top: 1px solid var(--eb-color-divider);
      }
      /* The accent marks the open row and the selection, each its own way: a bar on the open row's
       leading edge, a tint on a selected one. */
      :host([open]) [part='row'],
      :host([href]:not([selected])) [part='row']:hover {
        background: var(--eb-color-surface-2);
      }
      /* A row that opens an order answers the pointer; its first cell is the link itself. */
      :host([href]) [part='row'],
      :host([open]) [part='row'],
      :host([href]) [part='card'] {
        cursor: pointer;
      }
      a {
        color: inherit;
        text-decoration: none;
      }
      /* A selected row keeps its tint when it is also the open one, which still has its bar. */
      :host([selected]) [part='row'] {
        background: var(--eb-color-accent-soft);
      }
      :host([open]) [part='row']::before {
        content: '';
        position: absolute;
        inset-block: 0;
        inset-inline-start: 0;
        width: 2px;
        background: var(--eb-color-accent);
      }
      [role='cell'] {
        min-width: 0;
        padding: 6px 12px;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      [role='cell'].end {
        text-align: end;
      }
      [role='cell'].check {
        display: grid;
        place-items: center;
        padding: 0;
        overflow: visible;
      }
      /* A row of a phone's list: the name and amount, then the facts and the status. Each line ends
         in an ellipsis rather than wrapping, so every row is the same two lines. */
      [part='card'] {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: var(--eb-space-card);
        border-top: 1px solid var(--eb-color-divider);
      }
      :host([selected]) [part='card'] {
        background: var(--eb-color-accent-soft);
      }
      [part='card'] > .check {
        flex: none;
      }
      .lines {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }
      .top,
      .meta {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: baseline;
        gap: 8px;
      }
      .title,
      .title a {
        display: flex;
        gap: 0 8px;
        min-width: 0;
        overflow: hidden;
      }
      .title {
        font-weight: 600;
      }
      .title ::slotted(*) {
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .end {
        flex: none;
        font-weight: var(--eb-font-weight-semibold);
        font-variant-numeric: tabular-nums;
      }
      /* As tall as a status pill, so a row with a pill, one with a dot and one whose facts mix Bangla
         and Latin type, which can raise their line a pixel, are all the same height. */
      .meta {
        height: 24px;
        align-items: center;
        color: var(--eb-color-text-2);
        font-size: var(--eb-font-size-meta);
        line-height: var(--eb-line-height-meta);
      }
      .facts {
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .dot {
        margin-inline: 4px;
      }
      ::slotted([card='note']) {
        margin-top: 8px;
      }
    `,
  ]

  /** Marks the row whose order is open beside the list. */
  declare open: boolean
  /** The row is ticked. */
  declare selected: boolean
  /** Where the row's order opens: its first cell links there, and a click on the row follows it. */
  declare href: string | undefined

  constructor() {
    super()
    this.open = false
    this.selected = false
  }

  // A click on the row outside anything of its own to press follows the row's link.
  private follow = (event: MouseEvent): void => {
    if (!this.href) return
    const path = event.composedPath()
    const own = path.slice(0, path.indexOf(this))
    const pressable = 'a, button, input, label, select, textarea, [tabindex], eb-checkbox, eb-button, eb-link, .check'
    if (own.some((el) => el instanceof Element && el.matches(pressable))) return
    // A drag that selected words was for copying them, not for opening the order.
    if (getSelection()?.toString()) return
    // Ctrl or Cmd asks for a new tab, as it would on the link itself.
    if (event.ctrlKey || event.metaKey) window.open(this.href, '_blank', 'noopener')
    else this.shadowRoot?.querySelector('a')?.click()
  }

  // A cell's slot, inside the row's link when it is the cell that carries it.
  private cell(linked: boolean) {
    return linked && this.href ? html`<a href=${this.href}><slot></slot></a>` : html`<slot></slot>`
  }

  private size$ = new ResizeObserver(() => this.entitle())

  override connectedCallback(): void {
    super.connectedCallback()
    this.size$.observe(this)
    // A web font that arrives late changes the words' width but not the row's.
    void document.fonts.ready.then(() => this.entitle())
  }

  override disconnectedCallback(): void {
    this.size$.disconnect()
    super.disconnectedCallback()
  }

  // A cell too narrow for its words ends in an ellipsis, and its title then carries them whole.
  private entitle(): void {
    for (const cell of this.shadowRoot?.querySelectorAll<HTMLElement>('[role="cell"]:not(.check)') ?? []) {
      const words = cell.querySelector('slot')?.assignedElements()[0]?.textContent?.trim() ?? ''
      if (words && cell.scrollWidth > cell.clientWidth) cell.title = words
      else cell.removeAttribute('title')
    }
  }

  private table(): EbTable | null {
    return this.parentElement instanceof EbTable ? this.parentElement : null
  }

  private toggle = (event: Event): void => {
    // SAFETY: this listener sits only on the row's own eb-checkbox.
    this.selected = (event.target as EbCheckbox).checked
    this.dispatchEvent(selection())
  }

  private cells(): Element[] {
    return [...this.children].filter((child) => !isNote(child))
  }

  // The checkbox is named for the row's first cell, which is the order number in an orders table.
  // A table's row holds it in a cell of its own; a phone's card leads with it.
  private checkbox(cell = true) {
    const name = this.cells()[0]?.textContent?.trim() ?? ''
    return html`<div role=${cell ? 'cell' : nothing} class="check">
      <eb-checkbox
        hide-label
        label=${words[langOf(this)].row(name)}
        .checked=${live(this.selected)}
        @change=${this.toggle}
      ></eb-checkbox>
    </div>`
  }

  override render() {
    if (this.wide()) {
      const selectable = this.table()?.selectable ?? false
      const columns = columnsOf(this.parentElement)
      const shown = this.shown()
      const shares = columns.length ? shown.map((i) => growOf(columns[i]!)) : shown.map(() => 1)
      return html`<div part="row" role="row" style=${grid(shares, selectable)} @click=${this.follow}>
        ${selectable ? this.checkbox() : ''}
        ${shown.map((i, k) => html`<div role="cell" class=${endOf(columns[i])}>${this.cell(k === 0)}</div>`)}
      </div>`
    }
    const title = html`<slot name="title"></slot>`
    const selectable = this.table()?.selectable ?? false
    return html`<div part="card" role="listitem" @click=${this.follow}>
      ${selectable ? this.checkbox(false) : ''}
      <div class="lines">
        <div class="top">
          <div class="title">${this.href ? html`<a href=${this.href}>${title}</a>` : title}</div>
          <div class="end"><slot name="end"></slot></div>
        </div>
        <div class="meta">
          <div class="facts">
            ${this.metaCells().map(
              (_, i) => html`${i ? html`<span class="dot" aria-hidden="true">·</span>` : ''}<slot name="meta"></slot>`,
            )}
          </div>
          <div class="status"><slot name="status"></slot></div>
        </div>
        <slot name="note"></slot>
      </div>
    </div>`
  }

  // The indexes of the cells that show as a table's: its shown columns, or every cell outside one.
  private shown(): number[] {
    const table = this.table()
    return table && columnsOf(table).length ? table.shown() : this.cells().map((_, i) => i)
  }

  // The cells a card shows on its meta line, each in a slot of its own so a dot can stand between.
  private metaCells(): Element[] {
    const columns = columnsOf(this.parentElement)
    return this.cells().filter((_, i) => placeOf(columns[i]) === 'meta')
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    // The header's checkbox tells all, some or none, so it follows every row's selection.
    if (changed.has('selected')) this.table()?.requestUpdate()
    const cells = this.cells()
    const slots = slotsIn(this.shadowRoot)
    if (this.wide()) {
      const shown = this.shown()
      for (const [i, slot] of slots.entries()) slot.assign(...cells.slice(shown[i]!, shown[i]! + 1))
      this.entitle()
      return
    }
    const columns = columnsOf(this.parentElement)
    const metas = this.metaCells()
    for (const slot of slots) {
      if (slot.name === 'meta') slot.assign(...metas.splice(0, 1))
      else if (slot.name === 'note') slot.assign(...[...this.children].filter(isNote))
      else slot.assign(...cells.filter((_, i) => placeOf(columns[i]) === slot.name))
    }
  }
}

/**
 * A column of cards, one for each child, on a screen of any width.
 *
 * @slot - The children, each drawn as a card.
 */
export class EbList extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--eb-space-gap);
      color: var(--eb-color-text);
      font-family: var(--eb-font-family);
      font-size: var(--eb-font-size-body);
      line-height: var(--eb-line-height-body);
    }
    ::slotted(*) {
      box-sizing: border-box;
      margin: 0;
      padding: var(--eb-space-card);
      border-radius: var(--eb-radius-card);
      background: var(--eb-color-surface);
      box-shadow:
        0 0 0 1px var(--eb-color-divider),
        var(--eb-shadow-1);
      overflow-wrap: anywhere;
    }
  `

  override render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-table': EbTable
    'eb-row': EbRow
    'eb-list': EbList
  }
}
