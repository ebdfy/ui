import { LitElement, css, html, type PropertyValues } from 'lit'
import { live } from 'lit/directives/live.js'

import { langOf } from '../lang.ts'
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
      box-shadow: var(--eb-shadow-card);
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
      overflow-wrap: anywhere;
    }
    [role='columnheader'].check {
      display: grid;
      place-items: center;
      padding: 0;
    }
    [role='list'] {
      display: flex;
      flex-direction: column;
      gap: var(--eb-space-gap);
    }
    [part='skeleton'] {
      display: grid;
      gap: 12px var(--eb-space-card);
      padding: 18px var(--eb-space-card);
      border-top: 1px solid var(--eb-color-line);
    }
    [role='list'] [part='skeleton'] {
      border-top: 0;
      border-radius: var(--eb-radius-card);
      background: var(--eb-color-surface);
      box-shadow: var(--eb-shadow-card);
    }
    .bar {
      height: 12px;
      border-radius: 6px;
      background: var(--eb-color-line);
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

  declare label: string
  declare loading: boolean
  declare density: 'comfortable' | 'compact'
  declare selectable: boolean

  constructor() {
    super()
    this.label = ''
    this.loading = false
    this.density = 'comfortable'
    this.selectable = false
  }

  // The rows the person has selected, in their order.
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
      ? html`${columns.map(() => html`<div class="bar"></div>`)}`
      : html`<div class="bar"></div>
          <div class="bar short"></div>`
    const style = this.wide() ? grid(columns.map(growOf)) : ''
    return Array.from({ length: 4 }, () => html`<div part="skeleton" aria-hidden="true" style=${style}>${bars}</div>`)
  }

  override render() {
    const columns = columnsOf(this)
    const rows = this.loading ? this.skeletons(columns) : html`<slot class="rows"></slot>`
    if (!this.wide()) return html`<div role="list" aria-label=${this.label}>${rows}</div>`
    return html`<div role="table" aria-label=${this.label}>
      <div class="head" role="row" style=${grid(columns.map(growOf), this.selectable)}>
        ${this.selectable ? this.headerCheckbox() : ''}
        ${columns.map(() => html`<div role="columnheader"><slot></slot></div>`)}
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
    for (const [i, slot] of slots.entries()) slot.assign(...columns.slice(i, i + 1))
    // A row draws from its table's columns, so a change here redraws the rows too.
    for (const row of rows) if (row instanceof EbRow) row.requestUpdate()
  }
}

export class EbRow extends Responsive {
  static override properties = {
    open: { type: Boolean, reflect: true },
    selected: { type: Boolean, reflect: true },
  }

  static override styles = css`
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
    :host([open]) [part='row'] {
      background: var(--eb-color-surface-2);
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
      overflow-wrap: anywhere;
    }
    [role='cell'].check {
      display: grid;
      place-items: center;
      padding: 0;
    }
    [part='card'] {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: var(--eb-space-card);
      border-radius: var(--eb-radius-card);
      background: var(--eb-color-surface);
      box-shadow: var(--eb-shadow-card);
      overflow-wrap: anywhere;
    }
    .top,
    .meta {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 4px 8px;
    }
    .title {
      display: flex;
      flex-wrap: wrap;
      gap: 0 8px;
      min-width: 0;
      font-weight: 600;
    }
    .end {
      flex: none;
      font-weight: var(--eb-font-weight-semibold);
      font-variant-numeric: tabular-nums;
    }
    .meta {
      flex-wrap: wrap;
      align-items: center;
      color: var(--eb-color-text-muted);
      font-size: var(--eb-font-size-meta);
      line-height: var(--eb-line-height-meta);
    }
    .facts {
      display: flex;
      flex-wrap: wrap;
      gap: 0 4px;
      min-width: 0;
    }
    .status {
      flex: none;
    }
    ::slotted([card='note']) {
      margin-top: 8px;
    }
  `

  declare open: boolean
  declare selected: boolean

  constructor() {
    super()
    this.open = false
    this.selected = false
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
  private checkbox() {
    const name = this.cells()[0]?.textContent?.trim() ?? ''
    return html`<div role="cell" class="check">
      <eb-checkbox
        hide-label
        label=${words[langOf(this)].row(name)}
        .checked=${live(this.selected)}
        @change=${this.toggle}
      ></eb-checkbox>
    </div>`
  }

  override render() {
    const cells = this.cells().length
    if (this.wide()) {
      const selectable = this.table()?.selectable ?? false
      const columns = columnsOf(this.parentElement)
      const shares = columns.length ? columns.map(growOf) : Array.from({ length: cells }, () => 1)
      return html`<div part="row" role="row" style=${grid(shares, selectable)}>
        ${selectable ? this.checkbox() : ''}
        ${Array.from({ length: cells }, () => html`<div role="cell"><slot></slot></div>`)}
      </div>`
    }
    return html`<div part="card" role="listitem">
      <div class="top">
        <div class="title"><slot name="title"></slot></div>
        <div class="end"><slot name="end"></slot></div>
      </div>
      <div class="meta">
        <div class="facts">
          ${this.metaCells().map(
            (_, i) => html`${i ? html`<span aria-hidden="true">·</span>` : ''}<slot name="meta"></slot>`,
          )}
        </div>
        <div class="status"><slot name="status"></slot></div>
      </div>
      <slot name="note"></slot>
    </div>`
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
      for (const [i, slot] of slots.entries()) slot.assign(...cells.slice(i, i + 1))
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

// A column of cards, one for each child, on a screen of any width.
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
      box-shadow: var(--eb-shadow-card);
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
