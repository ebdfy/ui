import { css, html, type PropertyValues } from 'lit'
import { ifDefined } from 'lit/directives/if-defined.js'
import { live } from 'lit/directives/live.js'

import { DISTRICTS } from '../geo/districts.ts'
import { THANAS } from '../geo/thanas.ts'
import { UPAZILAS } from '../geo/upazilas.ts'
import { Field } from './field.ts'
import { chevron, selectStyles } from './select.ts'

const words = {
  bn: { district: 'জেলা', area: 'এলাকা', choose: 'জেলা বাছুন' },
  en: { district: 'District', area: 'Area', choose: 'Choose a district' },
}

/**
 * The district and the area of an address. The district is one of the 64, submitted by its English
 * name; the area is free text, offered the district's upazilas and city thanas in the field's
 * language. A name such as "address" prefixes both entries: address.district and address.area.
 *
 * @csspart chevron - The arrow at the end of the district control.
 */
export class EbDistrictPicker extends Field {
  static override styles = [
    Field.styles,
    selectStyles,
    css`
      /* The area is a field of its own, so it sits as far from the district as fields do apart. */
      label[for='area'] {
        margin-top: 16px;
      }
    `,
  ]

  static override properties = {
    ...Field.properties,
    district: { type: String },
    area: { type: String },
    areaError: { type: String, attribute: 'area-error' },
    typing: { state: true, attribute: false },
  }

  /** The district, one of the 64, by its English name. */
  declare district: string
  /** The area: free text, offered the district's upazilas and city thanas. */
  declare area: string
  /** The error shown for the area, as error is for the district. */
  declare areaError: string
  // While the area has focus it shows exactly what was typed, so a name is never swapped into the
  // other script under the person's fingers or an input method still composing.
  declare private typing: boolean

  constructor() {
    super()
    this.district = ''
    this.area = ''
    this.areaError = ''
    this.typing = false
  }

  /** The name the picker submits the district under: name.district, or district without a name. */
  get districtName(): string {
    return this.name ? `${this.name}.district` : 'district'
  }

  /** The name the picker submits the area under: name.area, or area without a name. */
  get areaName(): string {
    return this.name ? `${this.name}.area` : 'area'
  }

  override formResetCallback(): void {
    this.district = this.getAttribute('district') ?? ''
    this.area = this.getAttribute('area') ?? ''
  }

  protected override formValue(): FormData {
    const data = new FormData()
    data.append(this.districtName, this.district)
    data.append(this.areaName, this.knownArea()?.en ?? this.area)
    return data
  }

  protected override invalidMessage(): string {
    return this.required && !this.district ? 'Choose a district.' : ''
  }

  // Once a person has picked an option, an option's selected attribute no longer moves the
  // selection, so the select is set to the district after each render, when its options exist.
  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    const select = this.control()
    if (select && select.value !== this.district) select.value = this.district
  }

  protected control(): HTMLSelectElement | null {
    return this.renderRoot.querySelector('select')
  }

  // The district's upazilas and thanas, each by its English and Bangla name.
  private districtAreas(): { en: string; bn: string }[] {
    const upazilas = (UPAZILAS.get(this.district) ?? []).map(([en, bn]) => ({ en, bn }))
    const thanas = THANAS.filter((t) => t.district === this.district).map((t) => ({ en: t.name, bn: t.nameBn }))
    return [...upazilas, ...thanas]
  }

  // The district's area the person named, in either language. It shows in the field's language and
  // submits its English name, as the district does; any other text is kept as typed.
  private knownArea(): { en: string; bn: string } | undefined {
    return this.districtAreas().find((a) => a.en === this.area || a.bn === this.area)
  }

  // The district's areas by their names in the field's language.
  private areas(): string[] {
    const lang = this.language()
    return this.districtAreas()
      .map((a) => a[lang])
      .sort((a, b) => a.localeCompare(b, lang))
  }

  protected renderControl() {
    const lang = this.language()
    const t = words[lang]
    const districts = DISTRICTS.map((d) => ({ value: d.name, text: lang === 'bn' ? d.nameBn : d.name })).sort((a, b) =>
      a.text.localeCompare(b.text, lang),
    )
    const known = this.knownArea()
    return html`<div class="select">
        <select
          id="control"
          class="control"
          ?disabled=${this.disabled}
          ?required=${this.required}
          aria-invalid=${this.error ? 'true' : 'false'}
          aria-describedby=${ifDefined(this.describedBy())}
          @input=${(event: Event) => (this.district = this.textOf(event))}
          @change=${this.changed}
        >
          <option value="" ?selected=${live(this.district === '')}>${t.choose}</option>
          ${districts.map(
            (d) => html`<option value=${d.value} ?selected=${live(d.value === this.district)}>${d.text}</option>`,
          )}
        </select>
        ${chevron}
      </div>
      ${this.helpLine()}${this.errorLine('error', this.error)}
      <label for="area">${t.area}</label>
      <input
        id="area"
        class="control"
        type="text"
        list="areas"
        autocomplete="off"
        .value=${live(known && !this.typing ? known[lang] : this.area)}
        @focus=${() => {
          // The person edits the name they see, so it is the one kept.
          if (known) this.area = known[lang]
          this.typing = true
        }}
        @blur=${() => (this.typing = false)}
        ?disabled=${this.disabled}
        aria-invalid=${this.areaError ? 'true' : 'false'}
        aria-describedby=${ifDefined(this.areaError ? 'area-error' : undefined)}
        @input=${(event: Event) => (this.area = this.textOf(event))}
        @change=${this.changed}
      />
      <datalist id="areas">${this.areas().map((area) => html`<option value=${area}></option>`)}</datalist>
      ${this.errorLine('area-error', this.areaError)}`
  }

  override render() {
    const t = words[this.language()]
    return html`<label for="control">${this.label || t.district}</label>${this.renderControl()}`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-district-picker': EbDistrictPicker
  }
}
