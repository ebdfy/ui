// e-table and e-row. CSS draws both; these classes add table roles for assistive tech, once per
// element, and move nothing. They are custom elements so rows an app adds later get roles too.
/**
 * A table shows rows of data in columns. Its rows are `e-row`, and a row's children are its cells; a
 * link cell stays a link. A cell with `clip` holds one `span`, whose text the cell cuts with an ellipsis. Its rows and cells read the same before and without v2.js. For selection, search and
 * filters, put it in an `e-index-table`.
 * @tag e-table
 * @attr label - Names the table for assistive tech.
 * @attr columns - The column widths, as a grid's template, such as `2fr 1fr 1fr`, which v2.css draws in the first frame where the browser reads `attr()` as a typed value (Chromium 133+), and v2.js applies elsewhere. In other browsers, `style="--e-columns: 2fr 1fr 1fr"` draws them in the first frame.
 * @slot - Its `e-row`s, the head row first.
 */
export class ETable extends HTMLElement {
  static observedAttributes = ['label']

  connectedCallback(): void {
    this.setAttribute('role', 'table')
    const label = this.getAttribute('label')
    if (label && !this.hasAttribute('aria-label')) this.setAttribute('aria-label', label)
    const columns = this.getAttribute('columns')
    if (columns && !this.style.getPropertyValue('--e-columns')) this.style.setProperty('--e-columns', columns)
  }

  // A new label, as a page switching language sets, names the table afresh.
  attributeChangedCallback(_name: string, old: string | null, label: string | null): void {
    if (old !== null && label && this.getAttribute('aria-label') === old) this.setAttribute('aria-label', label)
  }
}

/**
 * One row of an `e-table`: each child is a cell.
 * @tag e-row
 * @attr {boolean} head - The head row, whose cells name the columns.
 * @attr {boolean} selected - Tints the row's cells lime, as a ticked row of an index table.
 * @attr {boolean} total - The table's totals row, its last: its cells at 600 weight under a 1 px rule, in the columns of the rows above.
 * @slot - Its cells. A cell may have `align="end"` for numbers, `tone="subdued"`, or `wrap` to let its text run onto several lines with 10 px above and below. A cell holding an `e-stack` starts at the top.
 */
export class ERow extends HTMLElement {
  private seen = new MutationObserver(() => this.build())

  connectedCallback(): void {
    this.setAttribute('role', 'row')
    this.build()
    this.seen.observe(this, { childList: true })
  }

  disconnectedCallback(): void {
    this.seen.disconnect()
  }

  private build(): void {
    const role = this.hasAttribute('head') ? 'columnheader' : 'cell'
    for (const cell of this.children) {
      // A cell role would replace a link's own role, so a link cell stays a link.
      if (cell.matches('a[href]') || cell.hasAttribute('role')) continue
      cell.setAttribute('role', role)
    }
  }
}

export function defineTable(): void {
  if (!customElements.get('e-table')) customElements.define('e-table', ETable)
  if (!customElements.get('e-row')) customElements.define('e-row', ERow)
}
