// The v2 loading parts: e-spinner turns and says Loading, e-skeleton holds the height of the text it
// stands in for, and e-progress-bar fills to its value and says it.
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'

import '../../src/v2.css'
import { defineCard } from '../../src/v2/card.ts'
import { defineProgressBar } from '../../src/v2/progress-bar.ts'
import { defineSpinner } from '../../src/v2/spinner.ts'
import { defineText } from '../../src/v2/text.ts'

const height = (el: Element) => el.getBoundingClientRect().height

test('e-spinner is a 20 px ring that turns, and a screen reader hears Loading in the page language', async () => {
  document.body.innerHTML = '<e-spinner></e-spinner><div lang="bn"><e-spinner></e-spinner></div>'
  const [en, bn] = document.querySelectorAll('e-spinner')
  const box = en!.getBoundingClientRect()
  expect([box.width, box.height]).toEqual([20, 20])
  expect(getComputedStyle(en!).animationName).not.toBe('none')
  defineSpinner()
  await expect.element(page.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  await expect.element(page.getByRole('status', { name: 'লোড হচ্ছে' })).toBeInTheDocument()
  expect(en!.getBoundingClientRect().toJSON()).toEqual(box.toJSON())
  expect(bn!.getAttribute('role')).toBe('status')
})

test('e-spinner keeps an aria-label the page gave it', () => {
  defineSpinner()
  document.body.innerHTML = '<e-spinner aria-label="Saving"></e-spinner>'
  expect(document.querySelector('e-spinner')!.getAttribute('aria-label')).toBe('Saving')
})

// A card's body of N lines of e-text 4 px apart, as the sample's cards lay them out.
const loaded = (lines: number) =>
  `<e-stack gap="1">${Array.from({ length: lines }, (_, i) => `<e-text>Line ${i + 1} রহিমা</e-text>`).join('')}</e-stack>`

test.for(['en', 'bn'])('in %s a card with e-skeleton lines="4" keeps its height when its four lines arrive', (lang) => {
  defineCard()
  defineText()
  document.body.innerHTML = `<div lang="${lang}"><e-card heading="Customer"><e-skeleton lines="4"></e-skeleton></e-card><e-card heading="Delivery">Dhaka</e-card></div>`
  const [customer, delivery] = document.querySelectorAll('e-card')
  const before = [height(customer!), delivery!.getBoundingClientRect().top]
  customer!.querySelector('e-skeleton')!.outerHTML = loaded(4)
  const after = [height(customer!), delivery!.getBoundingClientRect().top]
  expect(Math.abs(after[0]! - before[0]!)).toBeLessThanOrEqual(1)
  expect(Math.abs(after[1]! - before[1]!)).toBeLessThanOrEqual(1)
})

test('e-skeleton draws one line when it names none, and the last of several is shorter', () => {
  document.body.innerHTML = '<e-skeleton></e-skeleton><e-skeleton lines="3"></e-skeleton><e-text>One</e-text>'
  const [one, three] = document.querySelectorAll('e-skeleton')
  const line = height(document.querySelector('e-text')!)
  expect(height(one!)).toBe(line)
  expect(height(three!)).toBe(3 * line + 2 * 4)
  const last = getComputedStyle(three!, '::after')
  expect(Number.parseFloat(last.width)).toBeLessThan(three!.getBoundingClientRect().width)
})

test('with reduced motion asked for, e-skeleton does not pulse', () => {
  // The browser project runs with reduced motion (vitest.config.ts).
  document.body.innerHTML = '<e-skeleton lines="2"></e-skeleton>'
  const skeleton = document.querySelector('e-skeleton')!
  expect([
    getComputedStyle(skeleton, '::before').animationName,
    getComputedStyle(skeleton, '::after').animationName,
  ]).toEqual(['none', 'none'])
})

test('e-progress-bar fills to its value out of 100 and says it, named by its label', async () => {
  document.body.innerHTML = '<e-progress-bar label="Uploading photos" value="40"></e-progress-bar>'
  const bar = document.querySelector('e-progress-bar')!
  const before = height(bar)
  expect(before).toBe(4)
  defineProgressBar()
  const progress = page.getByRole('progressbar', { name: 'Uploading photos' })
  await expect.element(progress).toHaveAttribute('aria-valuenow', '40')
  expect([bar.getAttribute('aria-valuemin'), bar.getAttribute('aria-valuemax')]).toEqual(['0', '100'])
  const fill = getComputedStyle(bar, '::before')
  expect(Number.parseFloat(fill.width)).toBeCloseTo(bar.getBoundingClientRect().width * 0.4, 0)
  expect(height(bar)).toBe(before)
  bar.setAttribute('value', '75')
  await expect.element(progress).toHaveAttribute('aria-valuenow', '75')
  expect(Number.parseFloat(getComputedStyle(bar, '::before').width)).toBeCloseTo(
    bar.getBoundingClientRect().width * 0.75,
    0,
  )
  bar.setAttribute('value', '140')
  await expect.element(progress).toHaveAttribute('aria-valuenow', '100')
})

test('e-progress-bar without a value is indeterminate', () => {
  defineProgressBar()
  document.body.innerHTML = '<e-progress-bar label="Loading orders"></e-progress-bar>'
  const bar = document.querySelector('e-progress-bar')!
  expect(bar.getAttribute('role')).toBe('progressbar')
  expect(bar.hasAttribute('aria-valuenow')).toBe(false)
})

test('e-spinner says Loading in the new language when the page switches, bn-BD included', async () => {
  defineSpinner()
  document.body.innerHTML =
    '<div lang="en"><e-spinner></e-spinner></div><div lang="bn-BD"><e-spinner></e-spinner></div>'
  const [en, bd] = document.querySelectorAll('e-spinner')
  expect(bd!.getAttribute('aria-label')).toBe('লোড হচ্ছে')
  en!.parentElement!.lang = 'bn'
  await expect.poll(() => en!.getAttribute('aria-label')).toBe('লোড হচ্ছে')
})

test('with reduced motion asked for, an e-progress-bar without a value does not slide', () => {
  document.body.innerHTML = '<e-progress-bar label="Loading orders"></e-progress-bar>'
  expect(getComputedStyle(document.querySelector('e-progress-bar')!, '::before').animationName).toBe('none')
})
