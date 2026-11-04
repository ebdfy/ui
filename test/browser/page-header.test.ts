import { expect, test } from 'vitest'

import '../../src/v1.ts'

async function render(html: string): Promise<void> {
  document.body.innerHTML = html
  for (const el of document.querySelectorAll('eb-page, eb-card, eb-button')) {
    await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete
  }
  await document.fonts.ready
}

const description = "Your store's orders, newest first."
const page = (heading: string) =>
  `<eb-page heading="${heading}" description="${description}"><eb-button slot="actions" variant="primary">Add order</eb-button><eb-card>Body</eb-card></eb-page>`

test.for([1280, 360])(
  'the page header holds the heading, description and actions in a %i px container',
  async (width) => {
    await render(`<div style="width: ${width}px">${page('Orders')}</div>`)
    const el = document.querySelector('eb-page')!
    const shadow = el.shadowRoot!
    const heading = shadow.querySelector('[part=heading]')!
    const desc = shadow.querySelector('[part=description]')!
    const header = shadow.querySelector('[part=header]')!.getBoundingClientRect()
    expect(heading.tagName).toBe('H1')
    expect(heading.textContent).toBe('Orders')
    expect(desc.textContent).toBe(description)

    const button = document.querySelector('eb-button')!
    expect(shadow.querySelector<HTMLSlotElement>('slot[name=actions]')!.assignedElements()).toEqual([button])

    const box = button.getBoundingClientRect()
    const line = heading.getBoundingClientRect()
    expect(Math.abs(box.top - line.top)).toBeLessThanOrEqual(4)
    expect(Math.abs(box.right - header.right)).toBeLessThanOrEqual(1)
    expect(desc.getBoundingClientRect().top).toBeGreaterThanOrEqual(line.bottom)

    const card = document.querySelector('eb-card')!.getBoundingClientRect()
    expect(card.top).toBeGreaterThanOrEqual(desc.getBoundingClientRect().bottom + 16)
  },
)

test('a page with no heading, description or actions renders no header', async () => {
  await render('<eb-page>Body</eb-page>')
  expect(document.querySelector('eb-page')!.shadowRoot!.querySelector('[part=header]')).toBeNull()
})

test('a long Bangla heading wraps without pushing the action out of the page', async () => {
  await render(`<div style="width: 360px">${page('অর্ডার '.repeat(12))}</div>`)
  const el = document.querySelector('eb-page')!
  const heading = el.shadowRoot!.querySelector('[part=heading]')!.getBoundingClientRect()
  expect(heading.height).toBeGreaterThan(32)
  expect(document.querySelector('eb-button')!.getBoundingClientRect().right).toBeLessThanOrEqual(
    el.getBoundingClientRect().right,
  )
})
