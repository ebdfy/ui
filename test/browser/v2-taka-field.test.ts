import { afterEach, expect, test } from 'vitest'
// e-taka-field: CSS draws the label and a ৳ box before the script, which then builds a real label and
// input in the same places. The input shows the amount in the page's digits with lakh grouping, and
// the form submits, and the save bar keeps, the plain Latin number.
import { page, userEvent } from 'vitest/browser'

import { watchSaveBars } from '../../src/save-bar.ts'

import '../../src/v2.css'
import { defineTakaField } from '../../src/v2/taka-field.ts'

afterEach(async () => {
  document.body.replaceChildren()
  document.documentElement.removeAttribute('lang')
  await page.viewport(1280, 800)
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

const charge = '<e-taka-field label="Delivery charge" name="charge" value="80"></e-taka-field>'

function submits(form: HTMLFormElement): string[] {
  const sent: string[] = []
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    sent.push(new URLSearchParams(new FormData(form) as never).toString())
  })
  return sent
}

// What the field shows: the ৳ and the digits in its input.
const shown = (tag: Element) =>
  `${tag.querySelector('[data-e-prefix]')?.textContent}${tag.querySelector<HTMLInputElement>('input:not([type="hidden"])')!.value}`

// The tests until the one that defines e-taka-field see the CSS alone.
test('the script builds the label and input where the CSS drew them: 36 px at 1280, 44 px at 360', async () => {
  const holder = mount(charge + `<div lang="bn"><e-taka-field label="ডেলিভারি চার্জ" name="b"></e-taka-field></div>`)
  const tags = [...holder.querySelectorAll('e-taka-field')]
  await document.fonts.ready
  await page.viewport(1280, 800)
  const at1280 = tags.map(box)
  await page.viewport(360, 800)
  const at360 = tags.map(box)
  expect(getComputedStyle(tags[0]!, '::before').content).toBe('"Delivery charge"')
  expect(getComputedStyle(tags[0]!, '::after').content).toBe('"৳80"')
  defineTakaField()

  expect(tags.flatMap((tag, index) => near(at360[index]!, box(tag)))).toEqual([])
  expect(near({ ...at360[0]!, height: 18 }, box(tags[0]!.querySelector('label')!))).toEqual([])
  expect(near({ ...at360[0]!, y: at360[0]!.y + 24, height: 44 }, box(tags[0]!.querySelector('input')!))).toEqual([])
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(360)

  await page.viewport(1280, 800)
  expect(tags.flatMap((tag, index) => near(at1280[index]!, box(tag)))).toEqual([])
  expect(near({ ...at1280[0]!, y: at1280[0]!.y + 24, height: 36 }, box(tags[0]!.querySelector('input')!))).toEqual([])
  expect(near({ ...at1280[1]!, y: at1280[1]!.y + 26, height: 36 }, box(tags[1]!.querySelector('input')!))).toEqual([])
})

test('80 shows as ৳80 in English and ৳৮০ in Bangla, and submits charge=80 in both', () => {
  defineTakaField()
  const holder = mount(`<form>${charge}</form><form lang="bn">${charge}</form>`)
  const [english, bangla] = [...holder.querySelectorAll('form')]
  expect([shown(english!.firstElementChild!), shown(bangla!.firstElementChild!)]).toEqual(['৳80', '৳৮০'])
  const sent = submits(english!)
  const sentBangla = submits(bangla!)
  english!.requestSubmit()
  bangla!.requestSubmit()
  expect([sent, sentBangla]).toEqual([['charge=80'], ['charge=80']])
})

test('typing ১২০ in Bangla submits charge=120', async () => {
  defineTakaField()
  const form = mount(`<form lang="bn">${charge.replace('Delivery charge', 'ডেলিভারি চার্জ')}</form>`)
    .firstElementChild as HTMLFormElement
  const sent = submits(form)
  await userEvent.fill(page.getByRole('textbox', { name: 'ডেলিভারি চার্জ' }), '১২০')
  form.requestSubmit()
  expect(sent).toEqual(['charge=120'])
})

test.for([
  ['en', '৳1,50,000'],
  ['bn', '৳১,৫০,০০০'],
])('in %s 150000 shows as %s once the person leaves it, and submits charge=150000', async ([lang, grouped]) => {
  defineTakaField()
  const form = mount(`<form lang="${lang}">${charge}<button>Save</button></form>`).firstElementChild as HTMLFormElement
  const sent = submits(form)
  await userEvent.fill(page.getByRole('textbox', { name: 'Delivery charge' }), '150000')
  await userEvent.click(page.getByRole('button', { name: 'Save' }))
  expect(shown(form.firstElementChild!)).toBe(grouped)
  expect(sent).toEqual(['charge=150000'])
})

test('with the save bar, a new amount raises the bar, Discard puts ৳80 back, and a new page lang raises nothing', async () => {
  defineTakaField()
  const tag = mount(`<form data-save-bar>${charge}</form>`).querySelector('e-taka-field')!
  const shows: boolean[] = []
  const bar = watchSaveBars(document, (visible) => shows.push(visible))
  await userEvent.fill(page.getByRole('textbox', { name: 'Delivery charge' }), '120')
  expect(shows).toEqual([true])

  bar.act('discard')
  expect(shows).toEqual([true, false])
  expect(shown(tag)).toBe('৳80')

  document.documentElement.lang = 'bn'
  await expect.poll(() => shown(tag)).toBe('৳৮০')
  expect(shows).toEqual([true, false])

  await userEvent.fill(page.getByRole('textbox', { name: 'Delivery charge' }), '১২০')
  bar.act('discard')
  expect(shown(tag)).toBe('৳৮০')
})
