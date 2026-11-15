import { afterEach, expect, test } from 'vitest'
// e-menu and e-menu-item: CSS draws the trigger before the script, which then hides the items in a
// panel that opens below it, with the WAI-ARIA menu keyboard, without moving the trigger.
import { page, userEvent } from 'vitest/browser'

import '../../src/v2.css'
import { defineButton } from '../../src/v2/button.ts'
import { defineMenu } from '../../src/v2/menu.ts'

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

const menu = `<e-menu><e-button slot="trigger">More</e-button><e-menu-item>Print</e-menu-item><e-menu-item>Duplicate</e-menu-item><e-menu-item tone="danger">Cancel order</e-menu-item></e-menu>`

// The tests above the first define call run before any test defines the tags, so they see the CSS alone.
test('before the script the menu is its trigger, and the items take no room', async () => {
  await page.viewport(800, 600)
  const tag = mount(`<p>Before ${menu}</p>`).querySelector('e-menu')!
  expect(box(tag).height).toBe(32)
  for (const item of tag.querySelectorAll('e-menu-item')) expect(box(item).height).toBe(0)
})

test('the script moves nothing in English or Bangla', async () => {
  await page.viewport(800, 600)
  const holder = mount(
    `<p>Before ${menu}</p><p lang="bn"><e-menu><e-button slot="trigger">আরও</e-button><e-menu-item>প্রিন্ট</e-menu-item></e-menu></p>`,
  )
  const parts = [...holder.querySelectorAll('e-menu, e-button')]
  const before = parts.map(box)
  defineButton()
  defineMenu()
  expect(parts.map((part, index) => near(before[index]!, box(part)))).toEqual(parts.map(() => []))
  expect(holder.querySelectorAll('[role="menu"]')).toHaveLength(2)
})

test('Enter on the trigger opens the menu and focus lands on the first item, words visible', async () => {
  mount(menu)
  expect(page.getByRole('menu').elements()).toHaveLength(0)
  const more = page.getByRole('button', { name: 'More' })
  await userEvent.keyboard('{Tab}')
  expect(document.activeElement).toBe(more.element())
  await userEvent.keyboard('{Enter}')

  await expect.element(page.getByRole('menu')).toBeVisible()
  expect(more.element().getAttribute('aria-expanded')).toBe('true')
  expect(more.element().getAttribute('aria-haspopup')).toBe('menu')
  const print = page.getByRole('menuitem', { name: 'Print' })
  expect(document.activeElement).toBe(print.element())
  await expect.element(print).toBeVisible()
  expect(box(print.element()).height).toBeGreaterThan(0)
  expect(getComputedStyle(print.element()).color).not.toBe('rgba(0, 0, 0, 0)')
})

test('the panel sits just below the trigger', async () => {
  mount(`<div style="padding: 40px">${menu}</div>`)
  await userEvent.click(page.getByRole('button', { name: 'More' }))
  const trigger = box(document.querySelector('e-button')!)
  const panel = box(document.querySelector('[role="menu"]')!)
  expect(panel.y).toBeGreaterThanOrEqual(trigger.y + trigger.height)
  expect(panel.y).toBeLessThan(trigger.y + trigger.height + 12)
  expect(Math.abs(panel.x - trigger.x)).toBeLessThanOrEqual(1)
})

test('at 1440 px a trigger in the right half end-aligns its panel, one in the left half start-aligns', async () => {
  await page.viewport(1440, 900)
  for (const [left, edge] of [
    [1260, 'right'],
    [100, 'left'],
  ] as const) {
    mount(
      `<e-menu><e-button slot="trigger" style="position: fixed; top: 100px; left: ${left}px; width: 80px">More</e-button><e-menu-item>Print</e-menu-item></e-menu>`,
    )
    await userEvent.click(page.getByRole('button', { name: 'More' }))
    const trigger = document.querySelector('e-button')!.getBoundingClientRect()
    const panel = document.querySelector('[role="menu"]')!.getBoundingClientRect()
    const [panelEdge, triggerEdge, expected] =
      edge === 'right' ? [panel.right, trigger.right, 1340] : [panel.left, trigger.left, 100]
    expect(Math.abs(triggerEdge - expected!)).toBeLessThanOrEqual(1)
    expect(Math.abs(panelEdge! - expected!)).toBeLessThanOrEqual(1)
    document.body.replaceChildren()
  }
})

test('the open panel wears the pop shadow and a danger item is the danger colour', async () => {
  await page.viewport(800, 600)
  mount(`${menu}<i data-probe style="box-shadow: var(--e-shadow-pop); color: var(--e-color-danger)"></i>`)
  await userEvent.click(page.getByRole('button', { name: 'More' }))
  const probe = getComputedStyle(document.querySelector('[data-probe]')!)
  expect(probe.boxShadow).not.toBe('none')
  expect(getComputedStyle(document.querySelector('[role="menu"]')!).boxShadow).toBe(probe.boxShadow)
  expect(getComputedStyle(document.querySelector('e-menu-item[tone="danger"]')!).color).toBe(probe.color)
})

test('arrow keys move focus and wrap, Home and End jump', async () => {
  mount(menu)
  await userEvent.click(page.getByRole('button', { name: 'More' }))
  const [print, duplicate, cancel] = ['Print', 'Duplicate', 'Cancel order'].map((name) =>
    page.getByRole('menuitem', { name }).element(),
  )
  await userEvent.keyboard('{ArrowDown}')
  expect(document.activeElement).toBe(duplicate)
  await userEvent.keyboard('{ArrowUp}{ArrowUp}')
  expect(document.activeElement).toBe(cancel)
  await userEvent.keyboard('{ArrowDown}')
  expect(document.activeElement).toBe(print)
  await userEvent.keyboard('{End}')
  expect(document.activeElement).toBe(cancel)
  await userEvent.keyboard('{Home}')
  expect(document.activeElement).toBe(print)
})

test('Escape closes the menu and focus goes back to the trigger', async () => {
  mount(menu)
  const more = page.getByRole('button', { name: 'More' })
  await userEvent.click(more)
  await expect.element(page.getByRole('menu')).toBeVisible()
  await userEvent.keyboard('{Escape}')
  expect(page.getByRole('menu').elements()).toHaveLength(0)
  expect(more.element().getAttribute('aria-expanded')).toBe('false')
  expect(document.activeElement).toBe(more.element())
})

test('Tab closes the menu and focus moves on instead of staying in it', async () => {
  mount(`${menu}<e-button>After</e-button>`)
  const more = page.getByRole('button', { name: 'More' })
  await userEvent.click(more)
  await userEvent.keyboard('{Tab}')
  expect(page.getByRole('menu').elements()).toHaveLength(0)
  expect(more.element().getAttribute('aria-expanded')).toBe('false')
  expect(document.activeElement).toBe(page.getByRole('button', { name: 'After' }).element())
})

test('a click on an item fires click and closes the menu; Enter on an item does the same', async () => {
  const holder = mount(menu)
  const clicked: string[] = []
  holder.addEventListener('click', (event) => {
    const item = (event.target as Element).closest('e-menu-item')
    if (item) clicked.push(item.textContent!)
  })
  await userEvent.click(page.getByRole('button', { name: 'More' }))
  await userEvent.click(page.getByRole('menuitem', { name: 'Duplicate' }))
  expect(clicked).toEqual(['Duplicate'])
  expect(page.getByRole('menu').elements()).toHaveLength(0)

  await userEvent.click(page.getByRole('button', { name: 'More' }))
  await userEvent.keyboard('{Enter}')
  expect(clicked).toEqual(['Duplicate', 'Print'])
  expect(page.getByRole('menu').elements()).toHaveLength(0)
})

test('a press outside closes the menu without taking focus back', async () => {
  mount(`${menu}<input aria-label="Search">`)
  await userEvent.click(page.getByRole('button', { name: 'More' }))
  await userEvent.click(page.getByRole('textbox', { name: 'Search' }))
  expect(page.getByRole('menu').elements()).toHaveLength(0)
  expect(document.activeElement).toBe(page.getByRole('textbox', { name: 'Search' }).element())
})

test('at 360 px each item is at least 44 px tall', async () => {
  await page.viewport(360, 800)
  mount(menu)
  await userEvent.click(page.getByRole('button', { name: 'More' }))
  for (const item of document.querySelectorAll('e-menu-item')) expect(box(item).height).toBeGreaterThanOrEqual(44)
  expect(document.documentElement.scrollWidth).toBe(360)
})

test('a menu of one short item is still a 160 px panel, its item a 44 px target', async () => {
  defineButton()
  defineMenu()
  mount('<div lang="bn"><e-menu><e-button slot="trigger">আরও</e-button><e-menu-item>ট্র্যাক</e-menu-item></e-menu></div>')
  await userEvent.click(page.getByRole('button', { name: 'আরও' }))
  const item = page.getByRole('menuitem', { name: 'ট্র্যাক' })
  await expect.element(item).toBeVisible()
  const box = item.element().getBoundingClientRect()
  expect([box.width >= 44, box.height >= 44]).toEqual([true, true])
  expect(document.querySelector('e-menu > [data-part="panel"]')!.getBoundingClientRect().width).toBe(160)
})
