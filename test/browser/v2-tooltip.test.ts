import { afterEach, expect, test } from 'vitest'
// e-tooltip: the bubble shows on hover and on keyboard focus of the control it wraps, hides on
// Escape, and names an icon-only button that has no name of its own.
import { page, userEvent } from 'vitest/browser'

import '../../src/v2.css'
import { defineButton } from '../../src/v2/button.ts'
import { defineModal, showModal } from '../../src/v2/modal.ts'
import { defineTooltip } from '../../src/v2/tooltip.ts'

afterEach(() => {
  document.body.replaceChildren()
})

function mount(html: string): HTMLElement {
  const holder = document.createElement('div')
  holder.innerHTML = html
  document.body.append(holder)
  return holder
}

const tooltip = `<e-tooltip text="Print"><e-button><e-icon name="printer"></e-icon></e-button></e-tooltip>`

// The tooltip is defined before the button, so the native button it names appears after it connects.
test('an icon-only button is named by the text, and follows a change of it', async () => {
  const holder = mount(`<p>Before ${tooltip}</p>`)
  defineTooltip()
  defineButton()
  await expect.element(page.getByRole('button', { name: 'Print' })).toBeInTheDocument()
  holder.querySelector('e-tooltip')!.setAttribute('text', 'প্রিন্ট করুন')
  await expect.element(page.getByRole('button', { name: 'প্রিন্ট করুন' })).toBeInTheDocument()
  expect(holder.querySelector('[role="tooltip"]')!.textContent).toBe('প্রিন্ট করুন')
})

test('a button with a name of its own is described by the text instead', async () => {
  mount(
    `<e-tooltip text="Print the slip"><e-button aria-label="Print"><e-icon name="printer"></e-icon></e-button></e-tooltip>`,
  )
  await expect.element(page.getByRole('button', { name: 'Print' })).toHaveAccessibleDescription('Print the slip')
})

test('hovering the button shows the bubble, and Escape hides it', async () => {
  mount(tooltip)
  expect(page.getByRole('tooltip').elements()).toHaveLength(0)
  await userEvent.hover(page.getByRole('button', { name: 'Print' }))
  const bubble = page.getByRole('tooltip')
  await expect.element(bubble).toBeVisible()
  await expect.element(bubble).toHaveTextContent('Print')
  await userEvent.keyboard('{Escape}')
  expect(page.getByRole('tooltip').elements()).toHaveLength(0)
})

test('tabbing to the button shows the bubble inside the window', async () => {
  mount(`<div style="padding-left: 320px">${tooltip}</div>`)
  await userEvent.keyboard('{Tab}')
  expect(document.activeElement).toBe(page.getByRole('button', { name: 'Print' }).element())
  const bubble = page.getByRole('tooltip')
  await expect.element(bubble).toBeVisible()
  const { x, width } = bubble.element().getBoundingClientRect()
  expect(x).toBeGreaterThanOrEqual(0)
  expect(x + width).toBeLessThanOrEqual(360)
})

test('Escape on a shown tooltip in a modal hides the bubble and leaves the modal open', async () => {
  defineTooltip()
  defineButton()
  defineModal()
  mount(`<e-modal id="sheet" heading="Order"><p>Body</p>${tooltip}</e-modal>`)
  showModal('sheet')
  const print = page.getByRole('button', { name: 'Print' })
  await expect.element(print).toBeInTheDocument()
  ;(print.element() as HTMLElement).focus({ focusVisible: true } as FocusOptions)
  await userEvent.keyboard('{Shift>}{Tab}{/Shift}{Tab}')
  await expect.element(page.getByRole('tooltip')).toBeVisible()
  await userEvent.keyboard('{Escape}')
  expect([
    document.querySelector<HTMLElement>('[role="tooltip"]')!.hidden,
    document.querySelector<HTMLDialogElement>('e-modal dialog')!.open,
  ]).toEqual([true, true])
})
