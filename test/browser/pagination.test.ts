import { afterEach, expect, test } from 'vitest'
import { page } from 'vitest/browser'

import '../../src/v1.ts'
import { inDark } from './colour.ts'

afterEach(() => page.viewport(360, 800))

async function render(html: string): Promise<EbPaginationHost> {
  document.body.innerHTML = html
  await document.fonts.ready
  const host = document.querySelector('eb-pagination')!
  await host.updateComplete
  return host
}

type EbPaginationHost = HTMLElementTagNameMap['eb-pagination']

function buttons(host: Element): HTMLButtonElement[] {
  return [...host.shadowRoot!.querySelectorAll('button')]
}

// The colour --eb-color-text-2 resolves to right now, read through a probe so the test holds no literal.
function textTwo(): string {
  const probe = document.createElement('span')
  probe.style.color = 'var(--eb-color-text-2)'
  document.body.append(probe)
  const colour = getComputedStyle(probe).color
  probe.remove()
  return colour
}

test('on desktop the buttons are 36 px, joined by 4 px and placed at the end', async () => {
  await page.viewport(1280, 800)
  const host = await render('<eb-pagination has-previous has-next></eb-pagination>')
  const [previous, next] = buttons(host) as [HTMLButtonElement, HTMLButtonElement]
  for (const button of [previous, next]) {
    const box = button.getBoundingClientRect()
    expect([box.width, box.height]).toEqual([36, 36])
    const icon = button.querySelector('svg')!.getBoundingClientRect()
    expect([icon.width, icon.height]).toEqual([16, 16])
  }
  expect(next.getBoundingClientRect().left - previous.getBoundingClientRect().right).toBe(4)
  expect(next.getBoundingClientRect().right).toBe(host.getBoundingClientRect().right)
})

test('on a phone the buttons are 44 px', async () => {
  await page.viewport(360, 800)
  const host = await render('<eb-pagination has-previous has-next></eb-pagination>')
  for (const button of buttons(host)) {
    const box = button.getBoundingClientRect()
    expect([box.width, box.height]).toEqual([44, 44])
  }
})

function label(host: Element): HTMLElement | null {
  return host.shadowRoot!.querySelector('nav > :not(button)')
}

test('a label shows before the buttons in the secondary text colour', async () => {
  const host = await render('<eb-pagination label="1–5 of 6" has-next></eb-pagination>')
  const text = label(host)!
  expect(text.textContent).toBe('1–5 of 6')
  expect(text.getBoundingClientRect().right).toBeLessThanOrEqual(buttons(host)[0]!.getBoundingClientRect().left)
  expect(getComputedStyle(text).color).toBe(textTwo())
  const dark = await inDark(async () => ({ shown: getComputedStyle(text).color, token: textTwo() }))
  expect(dark.shown).toBe(dark.token)
})

test('without a label nothing is drawn before the buttons', async () => {
  const host = await render('<eb-pagination has-previous has-next></eb-pagination>')
  expect(label(host)).toBeNull()
})

test('the buttons keep their names in English and Bangla', async () => {
  const host = await render('<eb-pagination has-previous has-next></eb-pagination>')
  expect(buttons(host).map((b) => b.getAttribute('aria-label'))).toEqual(['Previous page', 'Next page'])
  document.documentElement.lang = 'bn'
  try {
    const bn = await render('<eb-pagination has-previous has-next></eb-pagination>')
    expect(buttons(bn).map((b) => b.getAttribute('aria-label'))).toEqual(['আগের পাতা', 'পরের পাতা'])
  } finally {
    document.documentElement.lang = 'en'
  }
})
