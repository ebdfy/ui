import { afterEach, expect, test } from 'vitest'
// e-district-picker: CSS draws the district's label and box before the script, which builds two
// native selects, the district and its upazila, in the same place. The upazila list comes from
// areas.json, fetched once on first use.
import { page, userEvent } from 'vitest/browser'

import '../../src/v2.css'
import { watchSaveBars } from '../../src/save-bar.ts'
import { defineDistrictPicker } from '../../src/v2/district-picker.ts'

afterEach(async () => {
  document.body.replaceChildren()
  document.documentElement.removeAttribute('lang')
  await page.viewport(360, 800)
})

function mount(html: string): HTMLElement {
  const holder = document.createElement('div')
  holder.innerHTML = html
  document.body.append(holder)
  return holder
}

const box = (element: Element) => {
  const { x, y, width, height } = element.getBoundingClientRect()
  return { x, y, width, height }
}

function near(before: ReturnType<typeof box>, after: ReturnType<typeof box>): string[] {
  return (Object.keys(before) as (keyof typeof before)[])
    .filter((key) => Math.abs(before[key] - after[key]) > 1)
    .map((key) => `${key} ${before[key]} -> ${after[key]}`)
}

const submitted = (form: HTMLFormElement) => new URLSearchParams(new FormData(form) as never).toString()

// The upazila's list comes from areas.json. Until it arrives an empty upazila is disabled, and one
// with an opening value holds that value alone beside the empty choice.
async function arrived(name = 'Upazila'): Promise<HTMLSelectElement> {
  const upazila = page.getByRole('combobox', { name }).element() as HTMLSelectElement
  await expect.poll(() => !upazila.disabled && (upazila.value === '' || upazila.options.length > 2)).toBe(true)
  return upazila
}

const shown = (select: HTMLSelectElement) => select.selectedOptions[0]?.textContent

// The tests until the one that defines e-district-picker see the CSS alone.
test('before the script the tag shows the district label and box, in the page language', () => {
  const holder = mount(
    '<e-district-picker></e-district-picker><div lang="bn"><e-district-picker></e-district-picker></div>',
  )
  const [en, bn] = [...holder.querySelectorAll('e-district-picker')]
  expect(getComputedStyle(en!, '::before').content).toBe('"District"')
  expect(getComputedStyle(en!, '::after').content).toBe('"Choose a district"')
  expect(getComputedStyle(bn!, '::before').content).toBe('"জেলা"')
  expect(getComputedStyle(bn!, '::after').content).toBe('"জেলা বাছুন"')
})

// The first define fetches areas.json, so this test sees the upazila select before its list arrives.
test('the upazila reads the opening upazila before its list arrives, and its arrival is no edit', async () => {
  defineDistrictPicker()
  const seen: boolean[] = []
  watchSaveBars(document, (visible) => seen.push(visible))
  mount('<form data-save-bar><e-district-picker district="dhaka" upazila="mirpur"></e-district-picker></form>')
  const upazila = page.getByRole('combobox', { name: 'Upazila' }).element() as HTMLSelectElement
  // Enabled, so a form sent before the list arrives still carries the upazila.
  expect([upazila.disabled, upazila.value]).toEqual([false, 'mirpur'])
  await arrived()
  expect([upazila.value, shown(upazila)]).toEqual(['mirpur', 'Mirpur'])
  expect(seen).toEqual([])
})

test('the script builds the two selects without moving the tag, 36 px at 1280 and 44 px on a phone', async () => {
  const holder = mount(
    [
      '<e-district-picker></e-district-picker>',
      '<e-district-picker district="dhaka" upazila="mirpur" name="address"></e-district-picker>',
      '<div lang="bn"><e-district-picker></e-district-picker></div>',
      '<div lang="bn"><e-district-picker district="chattogram"></e-district-picker></div>',
    ].join(''),
  )
  const tags = [...holder.querySelectorAll('e-district-picker')]
  await document.fonts.ready
  const at360 = tags.map(box)
  await page.viewport(1280, 800)
  const at1280 = tags.map(box)
  defineDistrictPicker()

  expect(tags.map((tag) => tag.querySelectorAll('select').length)).toEqual([2, 2, 2, 2])
  expect(tags.flatMap((tag, index) => near(at1280[index]!, box(tag)))).toEqual([])
  expect([...tags[0]!.querySelectorAll('select')].map((select) => select.getBoundingClientRect().height)).toEqual([
    36, 36,
  ])
  await page.viewport(360, 800)
  expect(tags.flatMap((tag, index) => near(at360[index]!, box(tag)))).toEqual([])
  expect([...tags[0]!.querySelectorAll('select')].map((select) => select.getBoundingClientRect().height)).toEqual([
    44, 44,
  ])
  // Nothing is wider than the 360 px page.
  expect(document.documentElement.scrollWidth).toBe(360)
})

test('the district list is the 64 districts after one empty choice, named in the page language', () => {
  defineDistrictPicker()
  mount(
    '<form><e-district-picker></e-district-picker></form><div lang="bn"><e-district-picker></e-district-picker></div>',
  )
  const en = page.getByRole('combobox', { name: 'District' }).element() as HTMLSelectElement
  const bn = page.getByRole('combobox', { name: 'জেলা', exact: true }).element() as HTMLSelectElement
  expect(en.options).toHaveLength(65)
  expect([en.options[0]!.value, en.options[0]!.textContent]).toEqual(['', 'Choose a district'])
  expect([bn.options[0]!.value, bn.options[0]!.textContent]).toEqual(['', 'জেলা বাছুন'])
  expect([...en.options].map((option) => option.textContent)).toContain("Cox's Bazar")
  expect([...bn.options].find((option) => option.value === 'dhaka')?.textContent).toBe('ঢাকা')
  expect(en.value).toBe('')
})

test('choosing ঢাকা then মিরপুর submits district=dhaka&upazila=mirpur', async () => {
  defineDistrictPicker()
  const form = mount('<form lang="bn"><e-district-picker></e-district-picker></form>').querySelector('form')!
  const upazila = await arrived('উপজেলা')
  await userEvent.selectOptions(page.getByRole('combobox', { name: 'জেলা', exact: true }), 'ঢাকা')
  expect(upazila.options[0]!.textContent).toBe('উপজেলা বাছুন')
  await userEvent.selectOptions(page.getByRole('combobox', { name: 'উপজেলা' }), 'মিরপুর')
  expect(submitted(form)).toBe('district=dhaka&upazila=mirpur')
})

test('in English, choosing Dhaka then Mirpur submits the same', async () => {
  defineDistrictPicker()
  const form = mount('<form><e-district-picker></e-district-picker></form>').querySelector('form')!
  await arrived()
  await userEvent.selectOptions(page.getByRole('combobox', { name: 'District' }), 'Dhaka')
  await userEvent.selectOptions(page.getByRole('combobox', { name: 'Upazila' }), 'Mirpur')
  expect(submitted(form)).toBe('district=dhaka&upazila=mirpur')
  // A new district clears the upazila.
  await userEvent.selectOptions(page.getByRole('combobox', { name: 'District' }), 'Feni')
  expect(submitted(form)).toBe('district=feni&upazila=')
})

test('with name="address" the picker submits address.district and address.upazila', async () => {
  defineDistrictPicker()
  const form = mount('<form><e-district-picker name="address"></e-district-picker></form>').querySelector('form')!
  await arrived()
  await userEvent.selectOptions(page.getByRole('combobox', { name: 'District' }), "Cox's Bazar")
  await userEvent.selectOptions(page.getByRole('combobox', { name: 'Upazila' }), 'Teknaf')
  expect(submitted(form)).toBe(
    new URLSearchParams({ 'address.district': "cox's bazar", 'address.upazila': 'teknaf' }).toString(),
  )
})

test('Discard puts back Dhaka and Mirpur, with the upazila list Dhaka’s again', async () => {
  defineDistrictPicker()
  const seen: boolean[] = []
  const bar = watchSaveBars(document, (visible) => seen.push(visible))
  mount('<form data-save-bar><e-district-picker district="dhaka" upazila="mirpur"></e-district-picker></form>')
  const district = page.getByRole('combobox', { name: 'District' }).element() as HTMLSelectElement
  const upazila = await arrived()
  expect([district.value, upazila.value]).toEqual(['dhaka', 'mirpur'])

  await userEvent.selectOptions(page.getByRole('combobox', { name: 'District' }), 'Chattogram')
  await userEvent.selectOptions(page.getByRole('combobox', { name: 'Upazila' }), 'Sitakunda')
  expect(seen).toEqual([true])
  bar.act('discard')
  expect([district.value, upazila.value]).toEqual(['dhaka', 'mirpur'])
  expect(shown(upazila)).toBe('Mirpur')
  const names = [...upazila.options].map((option) => option.textContent)
  expect(names).toContain('Savar')
  expect(names).not.toContain('Sitakunda')
  expect(seen).toEqual([true, false])
})

test('a page switching to Bangla renames the labels and options and keeps both values, with no event', async () => {
  defineDistrictPicker()
  const form = mount('<form><e-district-picker district="dhaka" upazila="mirpur"></e-district-picker></form>')
    .firstElementChild as HTMLFormElement
  const district = page.getByRole('combobox', { name: 'District' }).element() as HTMLSelectElement
  const upazila = await arrived()
  const events: string[] = []
  form.addEventListener('input', () => events.push('input'))
  form.addEventListener('change', () => events.push('change'))

  document.documentElement.lang = 'bn'
  await expect.poll(() => shown(district)).toBe('ঢাকা')
  expect(shown(upazila)).toBe('মিরপুর')
  expect([district.value, upazila.value]).toEqual(['dhaka', 'mirpur'])
  expect(page.getByRole('combobox', { name: 'জেলা', exact: true }).elements()).toHaveLength(1)
  expect(page.getByRole('combobox', { name: 'উপজেলা' }).elements()).toHaveLength(1)
  expect(events).toEqual([])
})

test('error shows under the district select, and upazila-error under the upazila select', async () => {
  defineDistrictPicker()
  const tag = mount('<e-district-picker error="Choose a district"></e-district-picker>').firstElementChild!
  const district = page.getByRole('combobox', { name: 'District' }).element()
  const upazila = page.getByRole('combobox', { name: 'Upazila' }).element()
  expect(district.getAttribute('aria-invalid')).toBe('true')
  expect(district).toHaveAccessibleDescription('Choose a district')
  const line = district.parentElement!.querySelector('[data-e-error]')!
  expect(line.getBoundingClientRect().top).toBeGreaterThanOrEqual(district.getBoundingClientRect().bottom)
  expect(line.getBoundingClientRect().bottom).toBeLessThanOrEqual(upazila.getBoundingClientRect().top)

  tag.setAttribute('upazila-error', 'Choose an upazila in Dhaka')
  expect(upazila).toHaveAccessibleDescription('Choose an upazila in Dhaka')
  expect(page.getByText('Choose an upazila in Dhaka').element().getBoundingClientRect().top).toBeGreaterThanOrEqual(
    upazila.getBoundingClientRect().bottom,
  )
  tag.removeAttribute('error')
  expect(district.hasAttribute('aria-invalid')).toBe(false)
  expect(upazila.getAttribute('aria-invalid')).toBe('true')
})

test('once built, the picker draws no label or box of its own, in Bangla as in English', () => {
  defineDistrictPicker()
  const holder = mount(
    '<e-district-picker></e-district-picker><div lang="bn"><e-district-picker></e-district-picker></div>',
  )
  const drawn = [...holder.querySelectorAll('e-district-picker')].flatMap((tag) =>
    ['::before', '::after'].map((pseudo) => getComputedStyle(tag, pseudo).content),
  )
  expect(drawn).toEqual(['none', 'none', 'none', 'none'])
})
