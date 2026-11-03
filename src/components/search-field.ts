import { EbTextField } from './text-field.ts'

// A search box. The save bar never counts it, even when it has a name.
export class EbSearchField extends EbTextField {
  protected override readonly inputType = 'search'
  protected override readonly keyboard = 'search'
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-search-field': EbSearchField
  }
}
