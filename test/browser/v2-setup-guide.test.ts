// e-setup-guide: CSS draws the heading, the steps and the count before the script, which then builds
// a tick for each step, a Dismiss button and the count without moving anything.
import { afterEach, expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '../../src/v2.css'
import { defineSetupGuide } from '../../src/v2/setup-guide.ts'

afterEach(async () => {
  document.body.replaceChildren()
  document.documentElement.lang = 'en'
  await page.viewport(360, 800)
})

const words = [
  'Add your first product',
  'Set delivery charges',
  'Connect a courier',
  'Add a payment method',
  'Invite your team',
]

function guideHtml(): string {
  const steps = words.map((text, index) => `<e-setup-step${index < 2 ? ' done' : ''}>${text}</e-setup-step>`)
  return `<e-setup-guide heading="Set up your store">${steps.join('')}</e-setup-guide>`
}

function mount(html: string, lang = 'en'): HTMLElement {
  const holder = document.createElement('div')
  holder.lang = lang
  holder.innerHTML = html
  document.body.append(holder)
  return holder
}

const count = (holder: HTMLElement) => holder.querySelector('e-setup-guide [data-count]')?.textContent
const ticks = (holder: HTMLElement) => [...holder.querySelectorAll<HTMLInputElement>('e-setup-step > input')]

const box = (element: Element) => {
  const { x, y, width, height } = element.getBoundingClientRect()
  return { x, y, width, height }
}

// The CSS alone, before any test defines the tags.
// The browser reports a counter as its expression, so the draw is checked by that.
test('before the script the count is drawn from the done and total counters', () => {
  const holder = mount(guideHtml())
  expect(getComputedStyle(holder.querySelector('e-setup-guide')!, '::after').content).toBe(
    'counter(done) " of " counter(steps)',
  )
})

test('before the script the Bangla count is drawn with Bangla digits', () => {
  const holder = mount(guideHtml(), 'bn')
  expect(getComputedStyle(holder.querySelector('e-setup-guide')!, '::after').content).toBe(
    'counter(steps, bengali) "টির মধ্যে " counter(done, bengali) "টি"',
  )
})

test('the script moves the guide, its steps and its count by no more than 1 px', () => {
  const holder = mount(guideHtml())
  const guide = holder.querySelector('e-setup-guide')!
  const before = [box(guide), ...[...guide.querySelectorAll('e-setup-step')].map(box)]
  defineSetupGuide()
  const after = [box(guide), ...[...guide.querySelectorAll('e-setup-step')].map(box)]
  before.forEach((was, index) => {
    for (const key of Object.keys(was) as (keyof typeof was)[]) {
      expect(Math.abs(was[key] - after[index]![key]), `${index} ${key}`).toBeLessThanOrEqual(1)
    }
  })
})

test('the heading text sits within 1 px of where CSS drew it', () => {
  const holder = mount(guideHtml())
  const guide = holder.querySelector('e-setup-guide')!
  const drawn = guide.getBoundingClientRect().height
  defineSetupGuide()
  expect(guide.querySelector('h2')?.textContent).toBe('Set up your store')
  expect(Math.abs(guide.getBoundingClientRect().height - drawn)).toBeLessThanOrEqual(1)
})

test('five steps with two done show 2 of 5 and two ticked boxes named by the steps', () => {
  const holder = mount(guideHtml())
  expect(count(holder)).toBe('2 of 5')
  expect(ticks(holder).map((tick) => tick.checked)).toEqual([true, true, false, false, false])
  expect(page.getByRole('checkbox', { name: 'Connect a courier' }).elements()).toHaveLength(1)
})

test('ticking the third step makes it 3 of 5 and unticking goes back', async () => {
  const holder = mount(guideHtml())
  await page.getByRole('checkbox', { name: 'Connect a courier' }).click()
  const third = holder.querySelectorAll('e-setup-step')[2]!
  expect(third.hasAttribute('done')).toBe(true)
  await expect.poll(() => count(holder)).toBe('3 of 5')
  await page.getByRole('checkbox', { name: 'Connect a courier' }).click()
  expect(third.hasAttribute('done')).toBe(false)
  await expect.poll(() => count(holder)).toBe('2 of 5')
})

test('the keyboard ticks a step', async () => {
  const holder = mount(guideHtml())
  ticks(holder)[3]!.focus()
  await userEvent.keyboard(' ')
  await expect.poll(() => count(holder)).toBe('3 of 5')
})

test('a page that sets done on a step moves the count and the box', async () => {
  const holder = mount(guideHtml())
  holder.querySelectorAll('e-setup-step')[4]!.setAttribute('done', '')
  expect(ticks(holder)[4]!.checked).toBe(true)
  await expect.poll(() => count(holder)).toBe('3 of 5')
})

test('Dismiss fires one dismiss event and the guide leaves the page', async () => {
  const holder = mount(guideHtml())
  let fired = 0
  document.addEventListener('dismiss', () => fired++)
  await page.getByRole('button', { name: 'Dismiss' }).click()
  expect(fired).toBe(1)
  expect(holder.querySelector('e-setup-guide')).toBeNull()
})

test('in Bangla the count reads ৫টির মধ্যে ২টি and the button বাদ দিন', async () => {
  const holder = mount(guideHtml(), 'bn')
  expect(count(holder)).toBe('৫টির মধ্যে ২টি')
  expect(holder.querySelector('button')?.textContent).toBe('বাদ দিন')
  await page.getByRole('checkbox', { name: 'Invite your team' }).click()
  await expect.poll(() => count(holder)).toBe('৫টির মধ্যে ৩টি')
})

test('a screen reader meets the heading first, then Dismiss and the count', () => {
  const holder = mount(guideHtml())
  const guide = holder.querySelector('e-setup-guide')!
  expect([...guide.children].slice(0, 3).map((child) => child.localName)).toEqual(['h2', 'button', 'span'])
})
