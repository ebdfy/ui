// e-banner: a message across the page in a tone, its heading drawn by v2.css and built by the script.
// A critical banner is an alert; a dismissible one goes when its close button is pressed.
import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '../../src/v2.css'
import { defineBanner } from '../../src/v2/banner.ts'

const critical = `<e-banner tone="critical" heading="Payment failed">Check the bKash number and try again.</e-banner>`

// First in the file: once defined, a tag upgrades as it is inserted.
test('the script builds the heading where v2.css drew it, and nothing moves', () => {
  document.body.innerHTML = `${critical}<div id="after">After</div>`
  const banner = document.querySelector('e-banner')!
  expect(getComputedStyle(banner, '::before').content).toBe('"Payment failed"')
  const before = [banner.getBoundingClientRect().height, document.querySelector('#after')!.getBoundingClientRect().top]
  defineBanner()
  expect(banner.querySelector(':scope > [slot="heading"]')!.textContent).toBe('Payment failed')
  expect(getComputedStyle(banner, '::before').content).toBe('none')
  const after = [banner.getBoundingClientRect().height, document.querySelector('#after')!.getBoundingClientRect().top]
  expect(after.map((n, i) => Math.abs(n - before[i]!)).filter((moved) => moved > 1)).toEqual([])
})

test('a critical banner reads as an alert; an info banner is part of the page, not an announcement', async () => {
  defineBanner()
  document.body.innerHTML = `${critical}<e-banner heading="New courier rates">From 1 December.</e-banner>`
  await expect.element(page.getByRole('alert')).toHaveTextContent('Payment failed')
  const [, info] = document.querySelectorAll('e-banner')
  expect(info!.hasAttribute('role')).toBe(false)
})

test('each tone has its own fill', () => {
  document.body.innerHTML = ['info', 'success', 'warning', 'critical']
    .map((tone) => `<e-banner tone="${tone}">Words</e-banner>`)
    .join('')
  const fills = [...document.querySelectorAll('e-banner')].map((b) => getComputedStyle(b).backgroundColor)
  expect(new Set(fills).size).toBe(4)
})

test('a new heading, as a page switching language sets, goes to the built heading', () => {
  defineBanner()
  document.body.innerHTML = critical
  const banner = document.querySelector('e-banner')!
  banner.setAttribute('heading', 'পেমেন্ট হয়নি')
  expect(banner.querySelector(':scope > [slot="heading"]')!.textContent).toBe('পেমেন্ট হয়নি')
  expect(banner.querySelectorAll(':scope > [slot="heading"]')).toHaveLength(1)
})

test('a dismissible banner fires dismiss, goes, and hands the focus to the next control', async () => {
  defineBanner()
  document.body.innerHTML = `<e-banner dismissible heading="Saved">Your rates are live.</e-banner><button>Next</button>`
  const banner = document.querySelector('e-banner')!
  let fired = 0
  banner.addEventListener('dismiss', () => fired++)
  await userEvent.click(page.getByRole('button', { name: 'Dismiss' }))
  expect(fired).toBe(1)
  expect(banner.getBoundingClientRect().height).toBe(0)
  expect(document.activeElement!.textContent).toBe('Next')
})

test('a page that cancels dismiss keeps the banner, and a Bangla close button says so in Bangla', async () => {
  defineBanner()
  document.body.innerHTML = `<div lang="bn"><e-banner dismissible>আজ রাতে ডেলিভারি বন্ধ।</e-banner></div>`
  const banner = document.querySelector('e-banner')!
  banner.addEventListener('dismiss', (event) => event.preventDefault())
  await userEvent.click(page.getByRole('button', { name: 'বন্ধ করুন' }))
  expect(banner.getBoundingClientRect().height).toBeGreaterThan(0)
})

test("a dismissible banner's close follows the page's language", async () => {
  defineBanner()
  document.body.innerHTML = `<div lang="en"><e-banner dismissible>Rates change tonight.</e-banner></div>`
  document.querySelector('div')!.lang = 'bn'
  await expect.element(page.getByRole('button', { name: 'বন্ধ করুন' })).toBeInTheDocument()
})
