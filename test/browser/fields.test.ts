import { expect, test } from 'vitest'
import { userEvent } from 'vitest/browser'

import '../../src/v1.ts'

type Upgraded = HTMLElement & { updateComplete: Promise<unknown>; shadowRoot: ShadowRoot }

// Each field as a form holds it: its markup with a default value, how a person changes it, and
// the entries the form then submits.
interface Case {
  markup: string
  initial: [string, string][]
  edit: (field: Upgraded) => Promise<void>
  edited: [string, string][]
}

const inner = (field: Upgraded, selector = 'input') => field.shadowRoot.querySelector<HTMLElement>(selector)!

export const cases: Record<string, Case> = {
  'eb-text-field': {
    markup: '<eb-text-field name="note" label="Note" value="Call first"></eb-text-field>',
    initial: [['note', 'Call first']],
    edit: (field) => userEvent.fill(inner(field), 'Leave at the gate'),
    edited: [['note', 'Leave at the gate']],
  },
  'eb-text-area': {
    markup: '<eb-text-area name="note" label="Note" value="Call first"></eb-text-area>',
    initial: [['note', 'Call first']],
    edit: (field) => userEvent.fill(inner(field, 'textarea'), 'Leave at the gate\nRing twice'),
    edited: [['note', 'Leave at the gate\nRing twice']],
  },
  'eb-select': {
    markup: `<eb-select name="status" label="Status">
      <option value="open">Open</option><option value="shipped">Shipped</option>
    </eb-select>`,
    initial: [['status', 'open']],
    edit: (field) => userEvent.selectOptions(inner(field, 'select'), 'shipped'),
    edited: [['status', 'shipped']],
  },
  'eb-search-field': {
    markup: '<eb-search-field name="q" label="Search orders" value="rahim"></eb-search-field>',
    initial: [['q', 'rahim']],
    edit: (field) => userEvent.fill(inner(field), 'karim'),
    edited: [['q', 'karim']],
  },
  'eb-date-field': {
    markup: '<eb-date-field name="due" label="Due" value="2026-11-02"></eb-date-field>',
    initial: [['due', '2026-11-02']],
    edit: (field) => userEvent.fill(inner(field), '2026-12-16'),
    edited: [['due', '2026-12-16']],
  },
  'eb-checkbox': {
    markup: '<eb-checkbox name="gift" label="Gift wrap" checked></eb-checkbox>',
    initial: [['gift', 'on']],
    edit: (field) => userEvent.click(inner(field)),
    edited: [],
  },
  'eb-switch': {
    markup: '<eb-switch name="cod" value="yes" label="Cash on delivery" checked></eb-switch>',
    initial: [['cod', 'yes']],
    edit: (field) => userEvent.click(inner(field)),
    edited: [],
  },
  'eb-choice-list': {
    markup: `<eb-choice-list name="courier" label="Courier" value="pathao">
      <option value="pathao">Pathao</option><option value="steadfast">Steadfast</option>
    </eb-choice-list>`,
    initial: [['courier', 'pathao']],
    edit: (field) => userEvent.click(inner(field, 'input[value="steadfast"]')),
    edited: [['courier', 'steadfast']],
  },
  'eb-phone-field': {
    markup: '<eb-phone-field name="phone" label="Phone" value="01707071591"></eb-phone-field>',
    initial: [['phone', '01707071591']],
    edit: (field) => userEvent.fill(inner(field), '01811223344'),
    edited: [['phone', '01811223344']],
  },
  'eb-taka-field': {
    markup: '<eb-taka-field name="price" label="Price" value="125000"></eb-taka-field>',
    initial: [['price', '125000']],
    edit: (field) => userEvent.fill(inner(field), '90000'),
    edited: [['price', '90000']],
  },
  'eb-district-picker': {
    markup: '<eb-district-picker name="address" district="Dhaka" area="Mirpur"></eb-district-picker>',
    initial: [
      ['address.district', 'Dhaka'],
      ['address.area', 'Mirpur'],
    ],
    edit: async (field) => {
      await userEvent.selectOptions(inner(field, 'select'), 'Sylhet')
      await userEvent.fill(inner(field, 'input'), 'Zindabazar')
    },
    edited: [
      ['address.district', 'Sylhet'],
      ['address.area', 'Zindabazar'],
    ],
  },
}

async function mount(markup: string, lang = 'en'): Promise<{ form: HTMLFormElement; field: Upgraded }> {
  document.documentElement.lang = lang
  document.body.innerHTML = `<form>${markup}</form>`
  const form = document.querySelector('form')!
  const field = form.firstElementChild as Upgraded
  await field.updateComplete
  await document.fonts.ready
  return { form, field }
}

const entries = (form: HTMLFormElement) => [...new FormData(form)].map(([k, v]) => [k, String(v)])

for (const [tag, c] of Object.entries(cases)) {
  test(`${tag} submits its value with the form, before and after a person edits it`, async () => {
    const { form, field } = await mount(c.markup)
    expect(entries(form)).toEqual(c.initial)
    await c.edit(field)
    await field.updateComplete
    expect(entries(form)).toEqual(c.edited)
  })

  test(`${tag} goes back to its first value when the form resets`, async () => {
    const { form, field } = await mount(c.markup)
    await c.edit(field)
    form.reset()
    await field.updateComplete
    expect(entries(form)).toEqual(c.initial)
  })

  test(`${tag} is left out of the form while disabled`, async () => {
    const { form, field } = await mount(c.markup)
    field.toggleAttribute('disabled', true)
    await field.updateComplete
    expect(entries(form)).toEqual([])
  })

  for (const lang of ['bn', 'en']) {
    test(`${tag} is at least 44 px tall and fits 360 px in ${lang}`, async () => {
      const { field } = await mount(c.markup, lang)
      expect(field.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
      for (const control of field.shadowRoot.querySelectorAll('.control')) {
        expect(control.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
      }
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(360)
    })
  }
}

test('a field shows its error under the control and marks the control invalid', async () => {
  const { field } = await mount('<eb-text-field name="note" label="Note"></eb-text-field>')
  ;(field as Upgraded & { error: string }).error = 'Too long.'
  await field.updateComplete
  const error = field.shadowRoot.querySelector('[part="error"]')!
  expect(error.textContent).toBe('Too long.')
  expect(error.getBoundingClientRect().top).toBeGreaterThanOrEqual(inner(field).getBoundingClientRect().bottom)
  expect(inner(field).getAttribute('aria-invalid')).toBe('true')
})

test('a required field that is empty stops the form from submitting', async () => {
  const { form } = await mount('<eb-text-field name="note" label="Note" required></eb-text-field>')
  expect(form.checkValidity()).toBe(false)
})

test('one form holding all eleven fields submits, resets and drops a disabled field together', async () => {
  const all = Object.values(cases)
  expect(Object.keys(cases)).toHaveLength(11)
  document.documentElement.lang = 'en'
  document.body.innerHTML = `<form>${all.map((c) => c.markup).join('')}</form>`
  const form = document.querySelector('form')!
  const fields = [...form.children] as Upgraded[]
  await Promise.all(fields.map((field) => field.updateComplete))
  const initial = all.flatMap((c) => c.initial)
  expect(entries(form)).toEqual(initial)

  for (const [i, c] of all.entries()) await c.edit(fields[i]!)
  await Promise.all(fields.map((field) => field.updateComplete))
  expect(entries(form)).toEqual(all.flatMap((c) => c.edited))

  form.reset()
  await Promise.all(fields.map((field) => field.updateComplete))
  expect(entries(form)).toEqual(initial)

  fields[0]!.toggleAttribute('disabled', true)
  expect(entries(form)).toEqual(all.slice(1).flatMap((c) => c.initial))
})

for (const lang of ['bn', 'en']) {
  test(`all eleven fields in one form are at least 44 px tall and fit 360 px in ${lang}`, async () => {
    document.documentElement.lang = lang
    document.body.innerHTML = `<form>${Object.values(cases)
      .map((c) => c.markup)
      .join('')}</form>`
    const fields = [...document.querySelector('form')!.children] as Upgraded[]
    await Promise.all(fields.map((field) => field.updateComplete))
    await document.fonts.ready
    for (const field of fields) {
      expect(field.getBoundingClientRect().height, field.localName).toBeGreaterThanOrEqual(44)
      for (const control of field.shadowRoot.querySelectorAll('.control, .row')) {
        expect(control.getBoundingClientRect().height, field.localName).toBeGreaterThanOrEqual(44)
      }
    }
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(360)
  })
}

test('a name set from a script is the name the field submits under, and no name writes no attribute', async () => {
  const { form, field } = await mount('<eb-text-field value="Call first"></eb-text-field>')
  expect(field.hasAttribute('name')).toBe(false)
  ;(field as Upgraded & { name: string }).name = 'note'
  await field.updateComplete
  expect(entries(form)).toEqual([['note', 'Call first']])
})

test('a select shows the option it submits after a person picks one and the form resets', async () => {
  const { form, field } = await mount(cases['eb-select']!.markup)
  const select = inner(field, 'select') as HTMLSelectElement
  await userEvent.selectOptions(select, 'shipped')
  await userEvent.selectOptions(select, 'open')
  await userEvent.selectOptions(select, 'shipped')
  form.reset()
  await field.updateComplete
  expect(select.value).toBe('open')
})

test('the district picker shows the district it submits after a person picks one and the form resets', async () => {
  const { form, field } = await mount(cases['eb-district-picker']!.markup)
  const select = inner(field, 'select') as HTMLSelectElement
  for (const district of ['Sylhet', 'Dhaka', 'Sylhet']) await userEvent.selectOptions(select, district)
  form.reset()
  await field.updateComplete
  expect(select.value).toBe('Dhaka')
  expect(entries(form)[0]).toEqual(['address.district', 'Dhaka'])
})

test("an empty required field says so in its page's language", async () => {
  document.body.innerHTML = `<form lang="bn"><eb-text-field name="email" required></eb-text-field></form>
    <form lang="en"><eb-text-field name="email" required></eb-text-field></form>`
  const [bangla, english] = [...document.querySelectorAll('eb-text-field')]
  await Promise.all([bangla!.updateComplete, english!.updateComplete])
  expect(bangla!.validationMessage).toBe('এটি পূরণ করুন।')
  expect(english!.validationMessage).toBe('Fill this in.')
})
