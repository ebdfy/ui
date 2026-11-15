// On a phone every tap target is at least 44 px. The small close buttons keep their drawn
// size, so nothing around them moves, and take a 44 px hit area around it.
import { expect, test, vi } from 'vitest'
import { page } from 'vitest/browser'

import '../../src/v2.css'
import { defineBanner } from '../../src/v2/banner.ts'
import { defineCheckbox } from '../../src/v2/checkbox.ts'
import { defineFields } from '../../src/v2/field.ts'
import { defineIcon } from '../../src/v2/icon.ts'
import { defineIndexTable } from '../../src/v2/index-table.ts'
import { defineModal, showModal } from '../../src/v2/modal.ts'
import { defineSetupGuide } from '../../src/v2/setup-guide.ts'
import { defineTable } from '../../src/v2/table.ts'

// Whether a tap 21 px above, below, left and right of the button's centre lands on it: a 44 px target.
function reach(button: Element): boolean[] {
  const { left, top, width, height } = button.getBoundingClientRect()
  const [x, y] = [left + width / 2, top + height / 2]
  return [
    [x, y - 21],
    [x, y + 21],
    [x - 21, y],
    [x + 21, y],
  ].map(([px, py]) => button.contains(document.elementFromPoint(px!, py!)))
}

test('at 360 px the banner close, the setup guide Dismiss and the modal close are 44 px targets', async () => {
  defineBanner()
  defineSetupGuide()
  defineModal()
  document.body.innerHTML = `<div style="padding: 40px 0">
    <e-banner dismissible heading="Saved">Your rates are live.</e-banner>
    <div style="height: 40px"></div>
    <e-setup-guide heading="Set up your store"><e-setup-step done>Add a product</e-setup-step><e-setup-step>Connect a courier</e-setup-step></e-setup-guide>
  </div>
  <e-modal id="sheet" heading="Edit customer"><p>Body</p></e-modal>`
  const banner = document.querySelector('e-banner > [slot="dismiss"]')!
  const dismiss = document.querySelector('e-setup-guide > [data-dismiss]')!
  expect(['banner', ...reach(banner)]).toEqual(['banner', true, true, true, true])
  expect(['dismiss', ...reach(dismiss)]).toEqual(['dismiss', true, true, true, true])
  showModal('sheet')
  const close = document.querySelector('e-modal > dialog > header > button')!
  expect(['close', ...reach(close)]).toEqual(['close', true, true, true, true])
})

test('at 360 px each setup step is a 44 px row that a tap anywhere on ticks', async () => {
  defineSetupGuide()
  document.body.innerHTML = `<e-setup-guide heading="Set up your store"><e-setup-step>Connect a courier</e-setup-step></e-setup-guide>`
  const step = document.querySelector('e-setup-step')!
  const { left, right, top, height } = step.getBoundingClientRect()
  expect(height).toBeGreaterThanOrEqual(44)
  // Near the row's far end, past the words, and near its bottom edge.
  ;(document.elementFromPoint(right - 4, top + height - 3) as HTMLElement).click()
  expect(step.hasAttribute('done')).toBe(true)
  // Above the box too: the whole row is the step's label.
  expect(document.elementFromPoint(left + 9, top + 2)).toBe(step.querySelector('label'))
})

test('at 360 px a tap 22 px above or below the filter chip remove button removes the chip', async () => {
  await page.viewport(360, 800)
  defineIcon()
  defineFields()
  defineIndexTable()
  for (const dy of [-22, 22]) {
    document.body.innerHTML = `<div style="padding: 16px"><e-index-table label="Orders">
      <e-search-field label="Search orders"></e-search-field>
      <span slot="filter" name="date"><span>Date: Last 30 days</span></span>
    </e-index-table></div>`
    const button = await vi.waitFor(() => document.querySelector('[slot="filter"] > button')!)
    const { left, top, width, height } = button.getBoundingClientRect()
    const hit = document.elementFromPoint(left + width / 2, top + height / 2 + dy)
    expect(button.contains(hit), `tap ${dy} px from centre`).toBe(true)
    ;(hit as HTMLElement).click()
    expect(document.querySelector('[slot="filter"]')).toBeNull()
  }
})

// On a phone the row checkboxes show in select mode, which Select or a long press starts.
test('at 360 px in select mode the row checkbox is a 44 px target and a tap on it does not open the order', async () => {
  await page.viewport(360, 800)
  defineCheckbox()
  defineTable()
  defineIndexTable()
  document.body.innerHTML = `<div style="padding: 16px"><e-index-table label="Orders" select-mode>
    <e-table label="Orders" style="--e-columns: 44px 80px 1fr auto">
      <e-row head><span><e-checkbox label="Select all" hide-label></e-checkbox></span><span>Order</span><span>Customer</span><span align="end">Total</span></e-row>
      <e-row><span><e-checkbox label="Select #1042" hide-label></e-checkbox></span><span card="title"><a href="#1042">#1042</a></span><span card="body">Rahima Akter</span><span align="end" card="end">৳1,930</span></e-row>
    </e-table>
  </e-index-table></div>`
  const input = await vi.waitFor(() => document.querySelector('e-row:not([head]) e-checkbox > input')!)
  const { left, top, width, height } = input.getBoundingClientRect()
  const [x, y] = [left + width / 2, top + height / 2]
  // All four directions: the card's padding and the title beside it leave 21 px each way.
  const taps = [
    [x, y - 21],
    [x, y + 21],
    [x - 21, y],
    [x + 21, y],
  ]
  let opened = 0
  document.addEventListener('click', (event) => (event.target as Element).closest('a') && opened++, true)
  for (const [px, py] of taps) {
    const hit = document.elementFromPoint(px!, py!)!
    expect(hit.closest('e-checkbox'), `tap at ${px},${py}`).toBe(input.parentElement)
    ;(hit as HTMLElement).click()
  }
  expect(opened).toBe(0)
  // Four taps flip the box four times.
  expect((input as HTMLInputElement).checked).toBe(false)
})
