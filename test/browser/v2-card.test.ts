import { expect, test } from 'vitest'
// A card has 12 px corners, 16/20/20 padding, a shadow and a 14/600 title. A flush card runs a table
// edge to edge while its heading still starts 20 px in.
import { page } from 'vitest/browser'

import '../../src/v2.css'
import { defineCard } from '../../src/v2/card.ts'
import { defineTable } from '../../src/v2/table.ts'

test('at 1440 a card has 12 px corners, 16/20/20 padding, a shadow and a 14/600 heading', async () => {
  defineCard()
  document.body.innerHTML = `<e-card id="plain" heading="Items"><p>Two items</p></e-card>`
  try {
    await page.viewport(1440, 900)
    const card = document.querySelector('#plain')!
    const style = getComputedStyle(card)
    expect(style.borderRadius).toBe('12px')
    expect(style.padding).toBe('16px 20px 20px')
    expect(style.boxShadow).not.toBe('none')
    const h2 = getComputedStyle(card.querySelector('h2')!)
    expect(h2.fontSize).toBe('14px')
    expect(h2.fontWeight).toBe('600')
  } finally {
    await page.viewport(360, 800)
  }
})

test('a flush card runs its table edge to edge and keeps the heading 20 px in', async () => {
  defineCard()
  defineTable()
  document.body.innerHTML = `<e-card id="flush" heading="Orders" flush><e-table label="Orders"><e-row head><span>Order</span><span>Total</span></e-row><e-row><span>#1042</span><span>৳1,250</span></e-row><e-row><span>#1041</span><span>৳980</span></e-row></e-table></e-card>`
  try {
    await page.viewport(1440, 900)
    const card = document.querySelector('#flush')!
    const outer = card.getBoundingClientRect()
    const table = card.querySelector('e-table')!.getBoundingClientRect()
    expect(table.left).toBe(outer.left + 1)
    expect(table.right).toBe(outer.right - 1)
    const range = document.createRange()
    range.selectNodeContents(card.querySelector('h2')!)
    expect(Math.abs(range.getBoundingClientRect().left - outer.left - 20)).toBeLessThanOrEqual(1)
  } finally {
    await page.viewport(360, 800)
  }
})
