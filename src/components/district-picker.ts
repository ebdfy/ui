import { html, nothing, type PropertyValues } from 'lit'
import { live } from 'lit/directives/live.js'

import { DISTRICTS } from '../geo/districts.ts'
import { THANAS } from '../geo/thanas.ts'
import { UPAZILAS } from '../geo/upazilas.ts'
import { Field } from './field.ts'

const words = {
  bn: { district: 'জেলা', area: 'এলাকা', choose: 'জেলা বাছুন' },
  en: { district: 'District', area: 'Area', choose: 'Choose a district' },
}

// The district and the area of an address. The district is one of the 64, submitted by its English
// name; the area is free text, offered the district's upazilas and city thanas in the field's
// language. A name such as "address" prefixes both entries: address.district and address.area.
export class EbDistrictPicker extends Field {
  static override properties = {
    ...Field.properties,
    district: { type: String },
    area: { type: String },
    areaError: { type: String, attribute: 'area-error' },
  }

  declare district: string
  declare area: string
  declare areaError: string

  constructor() {
    super()
    this.district = ''
    this.area = ''
    this.areaError = ''
  }

  // The names the picker submits under.
  get districtName(): string {
    return this.name ? `${this.name}.district` : 'district'
  }

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
    data.append(this.areaName, this.area)
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

  // The district's upazilas and thanas, by their names in the field's language.
  private areas(): string[] {
    const bn = this.language() === 'bn'
    const upazilas = (UPAZILAS.get(this.district) ?? []).map(([en, inBangla]) => (bn ? inBangla : en))
    const thanas = THANAS.filter((t) => t.district === this.district).map((t) => (bn ? t.nameBn : t.name))
    return [...upazilas, ...thanas].sort((a, b) => a.localeCompare(b, this.language()))
  }

  protected renderControl() {
    const lang = this.language()
    const t = words[lang]
    const districts = DISTRICTS.map((d) => ({ value: d.name, text: lang === 'bn' ? d.nameBn : d.name })).sort((a, b) =>
      a.text.localeCompare(b.text, lang),
    )
    return html`<select
        id="control"
        class="control"
        ?disabled=${this.disabled}
        ?required=${this.required}
        aria-invalid=${this.error ? 'true' : 'false'}
        aria-describedby="error"
        @input=${(event: Event) => (this.district = this.textOf(event))}
        @change=${this.changed}
      >
        <option value="" ?selected=${live(this.district === '')}>${t.choose}</option>
        ${districts.map(
          (d) => html`<option value=${d.value} ?selected=${live(d.value === this.district)}>${d.text}</option>`,
        )}
      </select>
      ${this.error ? html`<p part="error" id="error">${this.error}</p>` : nothing}
      <label for="area">${t.area}</label>
      <input
        id="area"
        class="control"
        type="text"
        list="areas"
        autocomplete="off"
        .value=${live(this.area)}
        ?disabled=${this.disabled}
        aria-invalid=${this.areaError ? 'true' : 'false'}
        aria-describedby="area-error"
        @input=${(event: Event) => (this.area = this.textOf(event))}
        @change=${this.changed}
      />
      <datalist id="areas">${this.areas().map((area) => html`<option value=${area}></option>`)}</datalist>
      ${this.areaError ? html`<p part="error" id="area-error">${this.areaError}</p>` : nothing}`
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
