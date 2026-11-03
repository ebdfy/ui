import { expect, test } from 'vitest'

// This file loads v1.js only after the markup is in place, the order a slow network gives.
test('an eb-button reads as its text before v1.js loads, and keeps it after', async () => {
  document.body.innerHTML = '<eb-button variant="primary">Add order</eb-button>'
  const el = document.querySelector('eb-button')!
  expect(customElements.get('eb-button')).toBeUndefined()
  expect(el.innerText).toBe('Add order')
  expect(el.getBoundingClientRect().width).toBeGreaterThan(0)

  await import('../../src/v1.ts')
  await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete
  expect(el.innerText).toBe('Add order')
})
