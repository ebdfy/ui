import { expect, test } from 'vitest'

import '../../src/v1.ts'

async function render(html: string): Promise<HTMLElement> {
  document.body.innerHTML = html
  const el = document.querySelector<HTMLElement & { updateComplete: Promise<unknown> }>('eb-empty-state')!
  await el.updateComplete
  return el
}

test('an icon sits centred above the heading, 20 px square, with 12 px between', async () => {
  const el = await render(
    '<eb-empty-state heading="No drafts yet"><eb-icon slot="icon" name="package" size="20"></eb-icon><p>Nothing here.</p></eb-empty-state>',
  )
  const icon = el.querySelector<HTMLElement & { updateComplete: Promise<unknown> }>('eb-icon')!
  await icon.updateComplete
  const iconBox = icon.getBoundingClientRect()
  const heading = el.shadowRoot!.querySelector('h2')!.getBoundingClientRect()
  const host = el.getBoundingClientRect()
  expect([iconBox.width, iconBox.height]).toEqual([20, 20])
  expect(iconBox.left + iconBox.width / 2).toBeCloseTo(host.left + host.width / 2)
  expect(heading.top - iconBox.bottom).toBe(12)
})

test('without an icon the heading starts at the 32 px top padding', async () => {
  const el = await render('<eb-empty-state heading="No drafts yet"><p>Nothing here.</p></eb-empty-state>')
  const heading = el.shadowRoot!.querySelector('h2')!.getBoundingClientRect()
  expect(heading.top - el.getBoundingClientRect().top).toBe(32)
})
