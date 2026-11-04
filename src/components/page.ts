import { LitElement, css, html, nothing } from 'lit'

/**
 * The screen of an app: the page background, a heading and a column for its cards.
 *
 * @slot - The cards of the page.
 * @slot actions - Buttons beside the heading.
 * @csspart header - The bar that holds the heading, the description and the actions.
 * @csspart heading - The page's title.
 * @csspart description - The line under the title.
 * @csspart actions - The row of buttons beside the title.
 */
export class EbPage extends LitElement {
  static override properties = {
    heading: { type: String },
    description: { type: String },
  }

  static override styles = css`
    :host {
      display: block;
      box-sizing: border-box;
      min-height: 100dvh;
      padding: var(--eb-space-card);
      background: var(--eb-color-bg);
      color: var(--eb-color-text);
      font-family: var(--eb-font-family);
      font-size: var(--eb-font-size-body);
      line-height: var(--eb-line-height-body);
    }
    header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--eb-space-gap);
      margin: 0 0 var(--eb-space-card);
    }
    .titles {
      flex: 1 1 0;
      min-width: 0;
    }
    h1 {
      margin: 0;
      font-size: var(--eb-font-size-heading-2);
      font-weight: var(--eb-font-weight-bold);
      line-height: var(--eb-line-height-heading-2);
    }
    p {
      margin: 0;
      color: var(--eb-color-text-2);
    }
    .actions {
      display: flex;
      flex: none;
      align-items: flex-start;
      gap: calc(var(--eb-space-gap) * 2 / 3);
    }
    .content {
      display: flex;
      flex-direction: column;
      gap: var(--eb-space-gap);
    }
  `

  /** The title of the page. */
  declare heading: string
  /** A line under the title. */
  declare description: string

  // An actions child alone shows the header, and the shadow cannot see it until the slot exists,
  // so the page rerenders when its children change.
  #children = new MutationObserver(() => this.requestUpdate())

  constructor() {
    super()
    this.heading = ''
    this.description = ''
  }

  override connectedCallback() {
    super.connectedCallback()
    this.#children.observe(this, { childList: true })
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this.#children.disconnect()
  }

  override render() {
    const hasActions = this.querySelector(':scope > [slot="actions"]') !== null
    const header =
      this.heading || this.description || hasActions
        ? html`<header part="header">
            <div class="titles">
              ${this.heading ? html`<h1 part="heading">${this.heading}</h1>` : nothing}
              ${this.description ? html`<p part="description">${this.description}</p>` : nothing}
            </div>
            <div class="actions" part="actions"><slot name="actions"></slot></div>
          </header>`
        : nothing
    return html`${header}
      <div class="content"><slot></slot></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-page': EbPage
  }
}
