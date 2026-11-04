import { expect, test } from 'vitest'
import { page } from 'vitest/browser'

import '../../src/v1.ts'
import { phones } from './phones.ts'

type Updatable = HTMLElement & { updateComplete: Promise<unknown> }

function isUpdatable(el: Element): el is Updatable {
  return 'updateComplete' in el
}

async function render(html: string): Promise<void> {
  document.body.innerHTML = html
  for (const el of document.querySelectorAll('*')) {
    if (el.localName.startsWith('eb-') && isUpdatable(el)) await el.updateComplete
  }
}

function root(selector: string): ShadowRoot {
  const shadow = document.querySelector(selector)?.shadowRoot
  if (!shadow) throw new Error(`no shadow root on ${selector}`)
  return shadow
}

test('a button group is a labelled group whose buttons share a row when they fit', async () => {
  await render(`<eb-button-group label="Actions">
    <eb-button>One</eb-button><eb-button>Two</eb-button><eb-button>Three</eb-button>
  </eb-button-group>`)
  const group = root('eb-button-group').querySelector('[role="group"]')!
  expect(group.getAttribute('aria-label')).toBe('Actions')
  const tops = [...document.querySelectorAll('eb-button')].map((b) => b.getBoundingClientRect().top)
  expect(new Set(tops).size).toBe(1)
})

test('a button group wraps instead of overflowing a 360 px page', async () => {
  await render(`<eb-button-group>
    <eb-button>Print the delivery label</eb-button><eb-button>Send a message to the buyer</eb-button><eb-button>Book courier</eb-button>
  </eb-button-group>`)
  const tops = new Set([...document.querySelectorAll('eb-button')].map((b) => b.getBoundingClientRect().top))
  expect(tops.size).toBeGreaterThan(1)
  for (const b of document.querySelectorAll('eb-button')) {
    expect(b.getBoundingClientRect().right).toBeLessThanOrEqual(360)
  }
})

test.for(phones)(
  'a bottom bar sits on the screen bottom edge before scrolling, on a $width x $height phone',
  async ({ width, height }) => {
    await page.viewport(width, height)
    window.scrollTo(0, 0)
    await render(`<div style="height: 2000px"></div>
    <eb-bottom-bar><eb-button-group><eb-button variant="primary">Book</eb-button></eb-button-group></eb-bottom-bar>`)
    const bar = document.querySelector('eb-bottom-bar')!
    expect(Math.abs(bar.getBoundingClientRect().bottom - height)).toBeLessThanOrEqual(1)
    expect(document.querySelector('eb-button')!.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
  },
)

// The visible button inside an eb-button, which is what a finger meets.
const face = (button: Element) => button.shadowRoot!.querySelector('button')!.getBoundingClientRect()

test("under 640 px a bottom bar's two buttons share its row in equal halves", async () => {
  await page.viewport(360, 800)
  await render(`<eb-bottom-bar><eb-button-group label="Booking">
    <eb-button>Cancel</eb-button><eb-button variant="primary">Book</eb-button>
  </eb-button-group></eb-bottom-bar>`)
  const bar = document.querySelector('eb-bottom-bar')!.getBoundingClientRect()
  const [cancel, book] = [...document.querySelectorAll('eb-button')].map(face)
  expect(cancel!.left).toBe(bar.left + 16)
  expect(book!.right).toBe(bar.right - 16)
  expect(cancel!.width).toBe(book!.width)
  expect(book!.left - cancel!.right).toBe(8)
  expect(cancel!.height).toBe(44)
})

test('from 641 px a bottom bar keeps its buttons at their own width, at the right', async () => {
  await page.viewport(1280, 800)
  await render(`<eb-bottom-bar><eb-button-group label="Booking">
    <eb-button>Cancel</eb-button><eb-button variant="primary">Book</eb-button>
  </eb-button-group></eb-bottom-bar>`)
  const bar = document.querySelector('eb-bottom-bar')!.getBoundingClientRect()
  const [cancel, book] = [...document.querySelectorAll('eb-button')].map(face)
  expect(book!.right).toBe(bar.right - 16)
  expect(cancel!.width).toBeLessThan(100)
  expect(cancel!.height).toBe(36)
})
