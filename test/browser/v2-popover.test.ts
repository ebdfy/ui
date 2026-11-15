import { afterEach, expect, test } from 'vitest'
// e-popover: CSS draws the trigger before the script, which then moves the content into a panel that
// opens below the trigger, stays inside a short phone's screen, and closes on Escape or a press outside.
import { page, userEvent } from 'vitest/browser'

import '../../src/v2.css'
import { defineButton } from '../../src/v2/button.ts'
import { definePopover } from '../../src/v2/popover.ts'

afterEach(() => {
  document.body.replaceChildren()
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

const popover = `<e-popover label="Order actions"><e-button slot="trigger">More</e-button><e-text>Print the slip</e-text><input aria-label="Note"></e-popover>`

// This test runs before any test defines the tags, so it sees the CSS alone. The popover is defined
// before the button, so the native button it wires appears after it connects.
test('the script moves nothing, and wires the native button that appears later', async () => {
  const holder = mount(`<p>Before ${popover}</p>`)
  const parts = [...holder.querySelectorAll('e-popover, e-button')]
  const before = parts.map(box)
  expect(box(holder.querySelector('e-text')!).height).toBe(0)
  definePopover()
  defineButton()
  expect(parts.map((part, index) => near(before[index]!, box(part)))).toEqual(parts.map(() => []))
  const more = page.getByRole('button', { name: 'More' })
  await expect.element(more).toHaveAttribute('aria-expanded', 'false')
  expect(document.getElementById(more.element().getAttribute('aria-controls')!)?.textContent).toBe('Print the slip')
})

test('at 1440 px a trigger in the right half end-aligns its panel, and the panel wears the pop shadow', async () => {
  await page.viewport(1440, 900)
  mount(
    `<e-popover label="Order actions"><e-button slot="trigger" style="position: fixed; top: 100px; left: 1260px; width: 80px">More</e-button><e-text>Print the slip</e-text></e-popover><i data-probe style="box-shadow: var(--e-shadow-pop)"></i>`,
  )
  await userEvent.click(page.getByRole('button', { name: 'More' }))
  const panel = document.querySelector('[role="dialog"]')!
  expect(Math.abs(panel.getBoundingClientRect().right - 1340)).toBeLessThanOrEqual(1)
  const probe = getComputedStyle(document.querySelector('[data-probe]')!).boxShadow
  expect(probe).not.toBe('none')
  expect(getComputedStyle(panel).boxShadow).toBe(probe)
})

test('the panel opens below the trigger, start edges aligned, and Escape closes it with focus on the trigger', async () => {
  mount(`<div style="padding: 40px">${popover}</div>`)
  const more = page.getByRole('button', { name: 'More' })
  await userEvent.click(more)

  const dialog = page.getByRole('dialog', { name: 'Order actions' })
  await expect.element(dialog).toBeVisible()
  expect(more.element().getAttribute('aria-expanded')).toBe('true')
  const trigger = box(document.querySelector('e-button')!)
  const panel = box(dialog.element())
  expect(panel.y).toBeGreaterThanOrEqual(trigger.y + trigger.height)
  expect(panel.y).toBeLessThan(trigger.y + trigger.height + 12)
  expect(Math.abs(panel.x - trigger.x)).toBeLessThanOrEqual(1)

  // Focus leaves the trigger first, so Escape has to put it back.
  await userEvent.click(page.getByRole('textbox', { name: 'Note' }))
  await userEvent.keyboard('{Escape}')
  expect(page.getByRole('dialog').elements()).toHaveLength(0)
  expect(more.element().getAttribute('aria-expanded')).toBe('false')
  expect(document.activeElement).toBe(more.element())
})

test('at 360x600 a popover near the right and bottom edges opens wholly inside the screen', async () => {
  await page.viewport(360, 600)
  try {
    mount(
      `<div style="position: fixed; right: 8px; bottom: 8px"><e-popover label="Order actions"><e-button slot="trigger">More</e-button><e-text>Print the packing slip for this order</e-text><e-text>Duplicate the order</e-text><e-text>Copy the delivery address</e-text></e-popover></div>`,
    )
    await userEvent.click(page.getByRole('button', { name: 'More' }))
    const panel = page.getByRole('dialog', { name: 'Order actions' })
    await expect.element(panel).toBeVisible()
    const { x, y, width, height } = box(panel.element())
    expect({ left: x >= 0, right: x + width <= 360, top: y >= 0, bottom: y + height <= 600 }).toEqual({
      left: true,
      right: true,
      top: true,
      bottom: true,
    })
  } finally {
    await page.viewport(360, 800)
  }
})

test('a click outside closes the popover', async () => {
  mount(`${popover}<input aria-label="Search">`)
  await userEvent.click(page.getByRole('button', { name: 'More' }))
  await expect.element(page.getByRole('dialog')).toBeVisible()
  await userEvent.click(page.getByRole('textbox', { name: 'Search' }))
  expect(page.getByRole('dialog').elements()).toHaveLength(0)
  expect(document.activeElement).toBe(page.getByRole('textbox', { name: 'Search' }).element())
})

test('the panel takes a new label, as a page switching language sets, and has no empty name without one', async () => {
  definePopover()
  defineButton()
  mount(`${popover}<e-popover><e-button slot="trigger">Filter</e-button><e-text>Status</e-text></e-popover>`)
  const [named, unnamed] = document.querySelectorAll('e-popover')
  named!.setAttribute('label', 'অর্ডারের কাজ')
  await userEvent.click(page.getByRole('button', { name: 'More' }))
  await expect.element(page.getByRole('dialog', { name: 'অর্ডারের কাজ' })).toBeVisible()
  expect(unnamed!.querySelector('[role="dialog"]')!.hasAttribute('aria-label')).toBe(false)
})
