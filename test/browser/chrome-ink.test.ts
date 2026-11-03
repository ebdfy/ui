import { expect, test } from 'vitest'

import '../../src/host.ts'
import { contrast, inDark } from './colour.ts'

const appOrigin = `http://localhost:${location.port}`
const formUrl = `${appOrigin}/test/browser/fixtures/form.html`

const inverse = { light: 'oklch(0.22 0.006 85)', dark: 'oklch(0.29 0.005 85)' }
const onInverse = 'oklch(0.97 0 0)'
const darkEdge = 'oklch(0.35 0.006 85) 0px 0px 0px 1px inset'

function chrome(): HTMLElement & { updateComplete: Promise<unknown> } {
  return document.querySelector('eb-admin-chrome')!
}

function part(name: string): HTMLElement | null {
  return chrome().shadowRoot!.querySelector(`[part="${name}"]`)
}

async function raiseBar(): Promise<void> {
  document.body.innerHTML = `<eb-admin-chrome src="${formUrl}"></eb-admin-chrome>`
  await chrome().updateComplete
  await expect.poll(() => part('save-bar'), { timeout: 10_000 }).not.toBeNull()
}

async function openToast(query: string): Promise<void> {
  document.body.innerHTML = `<eb-admin-chrome src="${appOrigin}/test/browser/fixtures/app.html?${query}"></eb-admin-chrome>`
  await chrome().updateComplete
  await expect.poll(() => part('toast'), { timeout: 10_000 }).not.toBeNull()
}

function look(element: Element) {
  const style = getComputedStyle(element)
  return { background: style.backgroundColor, colour: style.color, shadow: style.boxShadow }
}

test('the save bar is the inverse surface with on-inverse text and a Save in on-inverse', async () => {
  await raiseBar()
  const header = look(chrome().shadowRoot!.querySelector('header')!)
  const save = look(part('save')!)
  expect(header.background).toBe(inverse.light)
  expect(header.colour).toBe(onInverse)
  expect(save.background).toBe(onInverse)
  expect(save.colour).toBe(inverse.light)
  expect(contrast(onInverse, inverse.light)).toBeGreaterThanOrEqual(4.5)
  expect(part('discard')!.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
})

test('in dark the save bar keeps the inverse look and gains an edge ring', async () => {
  await raiseBar()
  const header = await inDark(async () => look(chrome().shadowRoot!.querySelector('header')!))
  expect(header.background).toBe(inverse.dark)
  expect(header.colour).toBe(onInverse)
  expect(header.shadow).toContain(darkEdge)
  expect(contrast(onInverse, inverse.dark)).toBeGreaterThanOrEqual(4.5)
})

test('a toast is the inverse surface with on-inverse text and no ring in light', async () => {
  await openToast('toast=Saved')
  const toast = look(part('toast')!)
  expect(toast.background).toBe(inverse.light)
  expect(toast.colour).toBe(onInverse)
  expect(toast.shadow).not.toContain('oklch(0.35')
  expect(getComputedStyle(part('toast')!).borderRadius).toBe('12px')
  expect(contrast(onInverse, inverse.light)).toBeGreaterThanOrEqual(4.5)
})

test('in dark a toast gains the edge ring', async () => {
  await openToast('toast=Saved')
  const toast = await inDark(async () => look(part('toast')!))
  expect(toast.background).toBe(inverse.dark)
  expect(toast.colour).toBe(onInverse)
  expect(toast.shadow).toContain(darkEdge)
})

test('an error toast is the danger fill with on-danger text, Dismiss included', async () => {
  await openToast('toast=Pathao+did+not+answer&error')
  const toast = look(part('toast')!)
  expect(toast.background).toBe('oklch(0.55 0.2 27)')
  expect(toast.colour).toBe('oklch(1 0 0)')
  expect(getComputedStyle(part('dismiss')!).color).toBe('oklch(1 0 0)')
})

// The ring is the focus colour drawn 2 px outside the button, on the inverse surface around it.
for (const theme of ['light', 'dark'] as const) {
  test(`the focus ring on the save bar and on a toast's action reads 3:1 on the inverse surface in ${theme}`, async () => {
    const ring = (el: Element) => getComputedStyle(el).getPropertyValue('--eb-color-focus').trim()
    const run = async () => {
      await raiseBar()
      const save = ring(part('save')!)
      await openToast('toast=Saved&undo')
      await expect.poll(() => part('toast-action')).not.toBeNull()
      return { save, action: ring(part('toast-action')!) }
    }
    const found = theme === 'dark' ? await inDark(run) : await run()
    expect(contrast(found.save, inverse[theme])).toBeGreaterThanOrEqual(3)
    expect(contrast(found.action, inverse[theme])).toBeGreaterThanOrEqual(3)
  })
}
