import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '../../src/v1.ts'
import { contrast, inDark } from './colour.ts'

type Tooltip = HTMLElement & { updateComplete: Promise<unknown> }

const icon = `<span role="img" data-trigger><svg aria-hidden="true" width="16" height="16"><circle cx="8" cy="8" r="6"></circle></svg></span>`

async function mount(html: string): Promise<Tooltip> {
  document.body.innerHTML = html
  const el = document.querySelector<Tooltip>('eb-tooltip')!
  await el.updateComplete
  return el
}

const bubble = (el: HTMLElement) => el.shadowRoot!.querySelector<HTMLElement>('[part="tooltip"]')!
const showing = (el: HTMLElement) => bubble(el).matches(':popover-open')
const trigger = () => document.querySelector<HTMLElement>('[data-trigger]')!

test('an icon-only trigger is named by the tooltip text and the keyboard reaches it', async () => {
  await mount(`<button>Before</button><eb-tooltip text="High return risk">${icon}</eb-tooltip>`)
  await expect.element(page.getByRole('img', { name: 'High return risk' })).toBeInTheDocument()
  await expect.element(page.getByRole('img')).toHaveAccessibleName('High return risk')
  document.querySelector<HTMLElement>('button')!.focus()
  await userEvent.tab()
  expect(document.activeElement).toBe(trigger())
})

test('the name follows the text when it changes', async () => {
  const el = await mount(`<eb-tooltip text="High return risk">${icon}</eb-tooltip>`)
  el.setAttribute('text', 'Low return risk')
  await el.updateComplete
  await expect.element(page.getByRole('img')).toHaveAccessibleName('Low return risk')
})

test('hovering the trigger shows the text and moving away hides it', async () => {
  const el = await mount(`<eb-tooltip text="High return risk">${icon}</eb-tooltip>`)
  expect(showing(el)).toBe(false)
  await userEvent.hover(trigger())
  await expect.poll(() => showing(el)).toBe(true)
  expect(bubble(el).textContent!.trim()).toBe('High return risk')
  expect(bubble(el).getAttribute('role')).toBe('tooltip')
  await userEvent.unhover(trigger())
  await expect.poll(() => showing(el)).toBe(false)
})

test('tabbing to the trigger shows the text, Escape hides it and Tab away hides it', async () => {
  const el = await mount(`<eb-tooltip text="High return risk">${icon}</eb-tooltip><button>After</button>`)
  await userEvent.tab()
  expect(document.activeElement).toBe(trigger())
  await expect.poll(() => showing(el)).toBe(true)
  await userEvent.keyboard('{Escape}')
  await expect.poll(() => showing(el)).toBe(false)
  expect(document.activeElement).toBe(trigger())
  await userEvent.tab()
  expect(document.activeElement).toBe(document.querySelector('button'))
  await userEvent.tab({ shift: true })
  await expect.poll(() => showing(el)).toBe(true)
  await userEvent.tab()
  await expect.poll(() => showing(el)).toBe(false)
})

test('the text reads 4.5:1 on the bubble in light and dark', async () => {
  const el = await mount(`<eb-tooltip text="High return risk">${icon}</eb-tooltip>`)
  await userEvent.hover(trigger())
  await expect.poll(() => showing(el)).toBe(true)
  const look = async () => {
    const style = getComputedStyle(bubble(el))
    return { colour: style.color, ratio: contrast(style.color, style.backgroundColor) }
  }
  const light = await look()
  const dark = await inDark(look)
  expect(light.ratio).toBeGreaterThanOrEqual(4.5)
  expect(dark.ratio).toBeGreaterThanOrEqual(4.5)
})

test('a trigger at the right edge of a 360 px viewport keeps the whole bubble inside it', async () => {
  const el = await mount(
    `<div style="position: fixed; top: 100px; right: 0"><eb-tooltip text="High return risk, check before you ship">${icon}</eb-tooltip></div>`,
  )
  await userEvent.hover(trigger())
  await expect.poll(() => showing(el)).toBe(true)
  const box = bubble(el).getBoundingClientRect()
  expect(box.left).toBeGreaterThanOrEqual(0)
  expect(box.right).toBeLessThanOrEqual(window.innerWidth)
  expect(box.bottom).toBeLessThanOrEqual(trigger().getBoundingClientRect().top)
})

test('a bubble is not clipped by a short overflow-hidden ancestor', async () => {
  const el = await mount(
    `<div style="margin-top: 100px; height: 20px; overflow: hidden"><eb-tooltip text="High return risk">${icon}</eb-tooltip></div>`,
  )
  await userEvent.hover(trigger())
  await expect.poll(() => showing(el)).toBe(true)
  const box = bubble(el).getBoundingClientRect()
  expect(box.bottom).toBeLessThanOrEqual(trigger().getBoundingClientRect().top)
  const hit = document.elementFromPoint(box.left + box.width / 2, box.top + 1)
  expect(hit).toBe(el)
})

test('a button with its own words keeps them as its name', async () => {
  await mount(`<eb-tooltip text="Copy the order number"><button data-trigger>Copy</button></eb-tooltip>`)
  await expect.element(page.getByRole('button')).toHaveAccessibleName('Copy')
  expect(trigger().hasAttribute('aria-label')).toBe(false)
  expect(trigger().hasAttribute('tabindex')).toBe(false)
})

test('the trigger the keyboard reaches shows the 2 px focus ring, in light and dark', async () => {
  const ring = async () => {
    await mount(`<button>Before</button><eb-tooltip text="High return risk">${icon}</eb-tooltip>`)
    document.querySelector<HTMLElement>('button')!.focus()
    await userEvent.tab()
    const style = getComputedStyle(trigger())
    const focus = getComputedStyle(document.documentElement).getPropertyValue('--eb-color-focus').trim()
    return { ring: `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor} ${style.outlineOffset}`, focus }
  }
  for (const found of [await ring(), await inDark(ring)]) expect(found.ring).toBe(`2px solid ${found.focus} 2px`)
})

test('an eb-button trigger stays one Tab stop and keeps its own name', async () => {
  await mount(
    `<button>Before</button><eb-tooltip text="More actions"><eb-button aria-label="More actions">⋯</eb-button></eb-tooltip><button>After</button>`,
  )
  const trigger = document.querySelector<Tooltip>('eb-button')!
  await trigger.updateComplete
  expect(trigger.hasAttribute('tabindex')).toBe(false)
  document.querySelector<HTMLElement>('button')!.focus()
  await userEvent.tab()
  await userEvent.tab()
  expect(document.activeElement!.textContent).toBe('After')
})
