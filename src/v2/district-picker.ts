// e-district-picker: the district and upazila of a Bangladesh address, as two native selects built
// inside the tag, once, so they join the form: district and upazila, or address.district and
// address.upazila with name="address". Each submits its English name in lower case and shows its name
// in the page's language. The 64 districts are here; each district's upazilas and city thanas come
// from areas.json beside this module, fetched once, on first use.
import { DISTRICTS } from '../geo/districts.ts'
import { langOf } from '../lang.ts'
import { markError } from './field.ts'
import { onLangChange } from './speech.ts'

type Areas = Record<string, [string, string][]>

const words = {
  en: {
    district: 'District',
    upazila: 'Upazila',
    chooseDistrict: 'Choose a district',
    chooseUpazila: 'Choose an upazila',
  },
  bn: { district: 'জেলা', upazila: 'উপজেলা', chooseDistrict: 'জেলা বাছুন', chooseUpazila: 'উপজেলা বাছুন' },
}

// The URL is read from a variable so the bundler leaves areas.json beside v2.js instead of inlining it.
const here = import.meta.url

let fetched: Promise<Areas | null> | undefined
let areas: Areas | null = null

async function fetchAreas(): Promise<Areas | null> {
  try {
    const response = await fetch(new URL('areas.json', here))
    if (response.ok) areas = (await response.json()) as Areas
  } catch {
    // Without the list the upazila keeps its opening value, and the next picker asks again.
  }
  if (!areas) fetched = undefined
  return areas
}

const native = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!

let count = 0

/**
 * A district picker chooses the district and upazila of a Bangladesh address, as two selects named
 * in the page's language. Each submits its English name in lower case.
 * @tag e-district-picker
 * @attr name - A prefix for the form names: `address` gives `address.district` and `address.upazila`; without it they are `district` and `upazila`.
 * @attr district - The district the picker opens with, as its lower-case English name such as `dhaka`.
 * @attr upazila - The upazila the picker opens with, as its lower-case English name such as `mirpur`.
 * @attr error - A message shown under the district select.
 * @attr upazila-error - A message shown under the upazila select.
 */
export class EDistrictPicker extends HTMLElement {
  static observedAttributes = ['error', 'upazila-error']

  #district: HTMLSelectElement | null = null
  #upazila: HTMLSelectElement | null = null
  #stop: (() => void) | undefined

  connectedCallback(): void {
    this.#stop = onLangChange(() => this.#say())
    if (this.#district) return
    const base = this.getAttribute('name')
    const district = this.#part('district', base)
    const upazila = this.#part('upazila', base)
    this.#district = district
    this.#upazila = upazila

    // The save bar's Discard sets the district's value with no event, then the upazila's, so setting
    // the district rebuilds the upazila list first.
    Object.defineProperty(district, 'value', {
      configurable: true,
      get: () => native.get!.call(district),
      set: (value: string) => {
        native.set!.call(district, value)
        this.#fill('')
      },
    })
    // A person choosing another district clears the upazila.
    district.addEventListener('input', () => this.#fill(''))

    this.#say()
    native.set!.call(district, this.getAttribute('district') ?? '')
    // Until the list arrives the upazila holds the opening value alone, so the save bar reads it.
    this.#fill(this.getAttribute('upazila') ?? '')
    if (!areas) void (fetched ??= fetchAreas()).then(() => this.#fill(native.get!.call(upazila)))
    this.#mark()
  }

  disconnectedCallback(): void {
    this.#stop?.()
  }

  attributeChangedCallback(): void {
    if (this.#district) this.#mark()
  }

  // A label and a select in a box of their own, which holds the select's error line too.
  #part(part: 'district' | 'upazila', base: string | null): HTMLSelectElement {
    const select = document.createElement('select')
    select.id = `e-district-picker-${++count}`
    select.name = base ? `${base}.${part}` : part
    const label = document.createElement('label')
    label.htmlFor = select.id
    const box = document.createElement('div')
    box.append(label, select)
    this.append(box)
    return select
  }

  // markError reads the error attribute of the box it is given, so each box carries its own.
  #mark(): void {
    for (const [select, attribute] of [
      [this.#district!, 'error'],
      [this.#upazila!, 'upazila-error'],
    ] as const) {
      const box = select.parentElement!
      const message = this.getAttribute(attribute)
      if (message) box.setAttribute('error', message)
      else box.removeAttribute('error')
      markError(box, select)
    }
  }

  // Names the labels and the districts in the page's language, keeping both values.
  #say(): void {
    const district = this.#district
    if (!district) return
    const lang = langOf(this)
    const say = words[lang]
    district.labels![0]!.textContent = say.district
    this.#upazila!.labels![0]!.textContent = say.upazila
    const value = native.get!.call(district)
    district.replaceChildren(
      ...options(
        say.chooseDistrict,
        DISTRICTS.map((one) => [one.name, one.nameBn]),
        lang,
      ),
    )
    native.set!.call(district, value)
    this.#fill(native.get!.call(this.#upazila!))
  }

  // Lists the district's upazilas and thanas, or, before the list arrives, the given value alone.
  #fill(value: string): void {
    const upazila = this.#upazila!
    const lang = langOf(this)
    const list = areas?.[native.get!.call(this.#district!)] ?? []
    const choices = options(words[lang].chooseUpazila, list, lang)
    if (!areas && value) choices.push(new Option('', value))
    upazila.replaceChildren(...choices)
    // Until the list arrives there is nothing to choose, but an opening value still submits.
    upazila.disabled = !areas && !value
    native.set!.call(upazila, value)
    if (upazila.selectedIndex < 0) upazila.selectedIndex = 0
  }
}

// An empty choice, then the names in the language, sorted in it; each submits its English name in
// lower case.
function options(choose: string, names: [string, string][], lang: 'en' | 'bn'): HTMLOptionElement[] {
  const named = names
    .map(([en, bn]) => new Option(lang === 'bn' ? bn : en, en.toLowerCase()))
    .sort((a, b) => a.text.localeCompare(b.text, lang))
  return [new Option(choose, ''), ...named]
}

export function defineDistrictPicker(): void {
  if (!customElements.get('e-district-picker')) customElements.define('e-district-picker', EDistrictPicker)
}
