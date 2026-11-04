import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '../../src/v1.ts'
import { contrast, inDark } from './colour.ts'
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

function panel(selector: string): HTMLElement {
  const el = root(selector).querySelector<HTMLElement>('[popover]')
  if (!el) throw new Error(`no panel in ${selector}`)
  return el
}

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

const menuHtml = `
  <div style="display: flex; justify-content: flex-end; padding: 8px 0">
    <eb-menu label="More actions">
      <eb-button slot="trigger">More</eb-button>
      <eb-menu-item>Print</eb-menu-item>
      <eb-menu-item tone="critical">Cancel order</eb-menu-item>
    </eb-menu>
  </div>`

test.for(phones)(
  'a menu at the right edge opens below its trigger and inside the screen, on a $width x $height phone',
  async ({ width, height }) => {
    await page.viewport(width, height)
    await render(menuHtml)
    const trigger = document.querySelector('eb-button')!
    trigger.click()
    await frame()
    const box = panel('eb-menu').getBoundingClientRect()
    // The labels show, so the panel is wider than the More button and has to be kept on screen.
    const cancel = document.querySelector('eb-menu-item[tone="critical"]')!
    expect(cancel.getBoundingClientRect().width).toBeGreaterThan(trigger.getBoundingClientRect().width)
    expect(box.top).toBeGreaterThanOrEqual(trigger.getBoundingClientRect().bottom)
    expect(box.left).toBeGreaterThanOrEqual(0)
    expect(box.right).toBeLessThanOrEqual(width)
    expect(box.bottom).toBeLessThanOrEqual(height)
  },
)

test('a menu names its panel, focuses the first item and moves with the arrow keys', async () => {
  await render(menuHtml)
  const trigger = document.querySelector('eb-button')!
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
  trigger.click()
  await frame()
  expect(trigger.getAttribute('aria-expanded')).toBe('true')
  const menu = panel('eb-menu')
  expect(menu.getAttribute('role')).toBe('menu')
  expect(menu.getAttribute('aria-label')).toBe('More actions')
  const items = [...document.querySelectorAll('eb-menu-item')]
  expect(items.map((i) => i.getAttribute('role'))).toEqual(['menuitem', 'menuitem'])
  expect(document.activeElement).toBe(items[0])
  await userEvent.keyboard('{ArrowDown}')
  expect(document.activeElement).toBe(items[1])
  await userEvent.keyboard('{ArrowDown}')
  expect(document.activeElement).toBe(items[0])
  await userEvent.keyboard('{End}')
  expect(document.activeElement).toBe(items[1])
})

test('pressing Enter on a menu item fires its click once, closes the menu and refocuses the trigger', async () => {
  await render(menuHtml)
  const trigger = document.querySelector('eb-button')!
  const cancel = document.querySelector('eb-menu-item[tone="critical"]')!
  let clicks = 0
  cancel.addEventListener('click', () => clicks++)
  trigger.click()
  await frame()
  await userEvent.keyboard('{ArrowDown}')
  await userEvent.keyboard('{Enter}')
  expect(clicks).toBe(1)
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
  expect(panel('eb-menu').matches(':popover-open')).toBe(false)
  expect(document.activeElement).toBe(trigger)
})

test('pressing Escape closes a menu and refocuses the trigger', async () => {
  await render(menuHtml)
  const trigger = document.querySelector('eb-button')!
  trigger.click()
  await frame()
  await userEvent.keyboard('{Escape}')
  await frame()
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
  expect(document.activeElement).toBe(trigger)
})

test('a click outside closes a menu', async () => {
  await render(`${menuHtml}<p id="away" style="height: 200px">Elsewhere</p>`)
  const trigger = document.querySelector('eb-button')!
  trigger.click()
  await frame()
  await userEvent.click(document.getElementById('away')!)
  await frame()
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
  expect(panel('eb-menu').matches(':popover-open')).toBe(false)
})

// The Admin's chrome draws a menu inside its own shadow root, where document.activeElement is the
// shadow host and not the focused item.
async function renderInShadow(): Promise<ShadowRoot> {
  document.body.innerHTML = '<div id="host"></div>'
  const shadow = document.getElementById('host')!.attachShadow({ mode: 'open' })
  shadow.innerHTML = menuHtml.replace(
    '<eb-menu-item>Print',
    '<eb-menu-item>Print</eb-menu-item><eb-menu-item>Duplicate',
  )
  for (const el of shadow.querySelectorAll('*')) {
    if (el.localName.startsWith('eb-') && isUpdatable(el)) await el.updateComplete
  }
  return shadow
}

test('inside a shadow root the arrow keys move focus and Enter runs the focused item', async () => {
  const shadow = await renderInShadow()
  const items = [...shadow.querySelectorAll<HTMLElement>('eb-menu-item')]
  const picked: string[] = []
  for (const item of items) item.addEventListener('click', () => picked.push(item.textContent!))
  shadow.querySelector<HTMLElement>('eb-button')!.click()
  await frame()
  expect(shadow.activeElement).toBe(items[0])
  await userEvent.keyboard('{ArrowDown}')
  expect(shadow.activeElement).toBe(items[1])
  await userEvent.keyboard('{Enter}')
  expect(picked).toEqual(['Duplicate'])
})

test('inside a shadow root focus goes back to the trigger after Escape and after a pick', async () => {
  const shadow = await renderInShadow()
  const trigger = shadow.querySelector<HTMLElement>('eb-button')!
  trigger.click()
  await frame()
  await userEvent.keyboard('{Escape}')
  await frame()
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
  expect(shadow.activeElement).toBe(trigger)
  trigger.click()
  await frame()
  await userEvent.click(shadow.querySelectorAll<HTMLElement>('eb-menu-item')[1]!)
  await frame()
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
  expect(shadow.activeElement).toBe(trigger)
})

async function openMenu(): Promise<HTMLElement[]> {
  await render(menuHtml)
  document.querySelector('eb-button')!.click()
  await frame()
  return [...document.querySelectorAll<HTMLElement>('eb-menu-item')]
}

test('menu items are 36 px tall at 1280 px and 44 px at 360 px', async () => {
  await page.viewport(1280, 800)
  let wide: number[]
  try {
    wide = (await openMenu()).map((i) => i.getBoundingClientRect().height)
  } finally {
    await page.viewport(360, 800)
  }
  const narrow = (await openMenu()).map((i) => i.getBoundingClientRect().height)
  expect(wide).toEqual([36, 36])
  expect(narrow).toEqual([44, 44])
})

test('a hovered menu item takes surface-3 in light and in dark', async () => {
  const [print] = await openMenu()
  await userEvent.hover(print!)
  expect(getComputedStyle(print!).backgroundColor).toBe('oklch(0.952 0.004 85)')
  const dark = await inDark(async () => getComputedStyle(print!).backgroundColor)
  expect(dark).toBe('oklch(0.29 0.005 85)')
})

test('the critical item reads at 4.5:1 on surface and surface-3 in light and in dark', async () => {
  const [, cancel] = await openMenu()
  await userEvent.hover(cancel!)
  const read = () => ({
    text: getComputedStyle(cancel!).color,
    surface: getComputedStyle(panel('eb-menu')).backgroundColor,
    hover: getComputedStyle(cancel!).backgroundColor,
  })
  const light = read()
  const dark = await inDark(async () => read())
  expect(light.text).toBe('oklch(0.49 0.19 27)')
  expect(contrast(light.text, light.surface)).toBeGreaterThanOrEqual(4.5)
  expect(contrast(light.text, light.hover)).toBeGreaterThanOrEqual(4.5)
  expect(dark.text).toBe('oklch(0.8 0.11 27)')
  expect(contrast(dark.text, dark.surface)).toBeGreaterThanOrEqual(4.5)
  expect(contrast(dark.text, dark.hover)).toBeGreaterThanOrEqual(4.5)
})

function readPanel(selector: string) {
  const style = getComputedStyle(panel(selector))
  return { background: style.backgroundColor, radius: style.borderRadius, shadow: style.boxShadow }
}

test('menu and popover panels sit on surface with a 12 px radius, the edge ring and shadow 3', async () => {
  await openMenu()
  document.body.insertAdjacentHTML(
    'beforeend',
    '<eb-popover><eb-button slot="trigger">Info</eb-button><p>Pickup</p></eb-popover>',
  )
  const popover = document.querySelector('eb-popover')!
  await popover.updateComplete
  popover.show()
  await popover.updateComplete
  await frame()
  for (const selector of ['eb-menu', 'eb-popover']) {
    const light = readPanel(selector)
    expect(light.background).toBe('oklch(1 0 0)')
    expect(light.radius).toBe('12px')
    expect(light.shadow).toContain('oklch(0.925 0.004 85) 0px 0px 0px 1px inset')
    const dark = await inDark(async () => readPanel(selector))
    expect(dark.background).toBe('oklch(0.215 0.004 85)')
    expect(dark.radius).toBe('12px')
    expect(dark.shadow).toContain('oklch(0.35 0.006 85) 0px 0px 0px 1px inset')
  }
})

test.for(phones)(
  'a popover opens below its trigger inside the screen and closes on Escape, on a $width x $height phone',
  async ({ width, height }) => {
    await page.viewport(width, height)
    await render(`<div style="display: flex; justify-content: flex-end; padding: 8px 0">
    <eb-popover><eb-button slot="trigger">Info</eb-button><p style="width: 300px; margin: 0">Courier pickup is between 10 and 1.</p></eb-popover>
  </div>`)
    const trigger = document.querySelector('eb-button')!
    trigger.click()
    await frame()
    const box = panel('eb-popover').getBoundingClientRect()
    expect(box.top).toBeGreaterThanOrEqual(trigger.getBoundingClientRect().bottom)
    expect(box.left).toBeGreaterThanOrEqual(0)
    expect(box.right).toBeLessThanOrEqual(width)
    expect(box.bottom).toBeLessThanOrEqual(height)
    await userEvent.keyboard('{Escape}')
    await frame()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  },
)

const windowsAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const macAgent =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'

test.each([
  [windowsAgent, ['Ctrl', 'D'], 'Control+D'],
  [macAgent, ['⌘', 'D'], 'Meta+D'],
])('a menu item shows its shortcut as one key per chip at the end of the row (%#)', async (userAgent, chips, keys) => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'userAgent')
  try {
    Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true })
    await render(`<div style="display: flex; justify-content: flex-end; padding: 8px 0">
      <eb-menu label="More actions">
        <eb-button slot="trigger">More</eb-button>
        <eb-menu-item shortcut="mod+d" style="width: 240px">Duplicate</eb-menu-item>
        <eb-menu-item>Print</eb-menu-item>
      </eb-menu>
    </div>`)
    document.querySelector('eb-button')!.click()
    await frame()
    const [item, plain] = [...document.querySelectorAll<HTMLElement>('eb-menu-item')]
    const kbds = [...item!.shadowRoot!.querySelectorAll<HTMLElement>('eb-kbd')]
    for (const kbd of kbds) await (kbd as Updatable).updateComplete
    expect(kbds.map((kbd) => kbd.shadowRoot!.querySelector('kbd')!.textContent)).toEqual(chips)
    expect(item!.shadowRoot!.querySelector('[part="shortcut"]')!.getAttribute('aria-hidden')).toBe('true')
    expect(item!.getAttribute('aria-keyshortcuts')).toBe(keys)
    const row = item!.getBoundingClientRect()
    const hint = kbds.at(-1)!.getBoundingClientRect()
    expect(Math.abs(hint.right - (row.right - 8))).toBeLessThanOrEqual(1)
    expect(Math.abs(hint.top + hint.height / 2 - (row.top + row.height / 2))).toBeLessThanOrEqual(1)
    expect(kbds[1]!.getBoundingClientRect().left - kbds[0]!.getBoundingClientRect().right).toBe(4)
    expect(plain!.shadowRoot!.querySelector('eb-kbd')).toBeNull()
    expect(plain!.hasAttribute('aria-keyshortcuts')).toBe(false)
    item!.removeAttribute('shortcut')
    await (item as Updatable).updateComplete
    expect(item!.hasAttribute('aria-keyshortcuts')).toBe(false)
    expect(item!.shadowRoot!.querySelector('eb-kbd')).toBeNull()
  } finally {
    if (original) Object.defineProperty(navigator, 'userAgent', original)
    else delete (navigator as { userAgent?: string }).userAgent
  }
})

// The shared tone list: danger is the 1.0.0 critical, kept as its alias until 2.0, and the other
// tones read as a plain item.
test('a danger item draws as a critical one, and the other tones as a plain item, in light and dark', async () => {
  await render(`<eb-menu-item>Print</eb-menu-item>
    <eb-menu-item tone="critical">Cancel</eb-menu-item>
    <eb-menu-item tone="danger">Cancel</eb-menu-item>
    <eb-menu-item tone="neutral">Print</eb-menu-item>
    <eb-menu-item tone="info">Print</eb-menu-item>
    <eb-menu-item tone="success">Print</eb-menu-item>
    <eb-menu-item tone="warning">Print</eb-menu-item>`)
  const colours = () => [...document.querySelectorAll('eb-menu-item')].map((item) => getComputedStyle(item).color)
  for (const [plain, critical, danger, ...rest] of [colours(), await inDark(async () => colours())]) {
    expect(danger).toBe(critical)
    expect(critical).not.toBe(plain)
    expect(rest).toEqual([plain, plain, plain, plain])
  }
})

test('an item with no tone keeps the 1.0.0 default', async () => {
  await render('<eb-menu-item>Print</eb-menu-item>')
  expect(document.querySelector('eb-menu-item')!.getAttribute('tone')).toBe('default')
})

test('a shortcut with Alt and Shift names each key, as ARIA names them', async () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'userAgent')
  try {
    for (const [agent, chips] of [
      [windowsAgent, ['Alt', 'Shift', 'D']],
      [macAgent, ['⌥', '⇧', 'D']],
    ] as const) {
      Object.defineProperty(navigator, 'userAgent', { value: agent, configurable: true })
      await render('<eb-menu-item shortcut="alt+shift+d">Duplicate</eb-menu-item>')
      const item = document.querySelector<HTMLElement>('eb-menu-item')!
      const kbds = [...item.shadowRoot!.querySelectorAll<HTMLElement>('eb-kbd')]
      for (const kbd of kbds) await (kbd as Updatable).updateComplete
      expect(kbds.map((kbd) => kbd.shadowRoot!.querySelector('kbd')!.textContent)).toEqual(chips)
      expect(item.getAttribute('aria-keyshortcuts')).toBe('Alt+Shift+D')
    }
  } finally {
    if (original) Object.defineProperty(navigator, 'userAgent', original)
    else delete (navigator as { userAgent?: string }).userAgent
  }
})

test('a menu item draws a slotted icon at 16 px before its label', async () => {
  await render('<eb-menu-item style="width: 240px"><eb-icon slot="icon" name="copy"></eb-icon>Duplicate</eb-menu-item>')
  const item = document.querySelector<HTMLElement>('eb-menu-item')!
  const icon = item.querySelector('eb-icon')!.getBoundingClientRect()
  const row = item.getBoundingClientRect()
  expect([icon.width, icon.height]).toEqual([16, 16])
  expect(icon.left - row.left).toBe(8)
  const label = document.createRange()
  label.selectNodeContents(item.lastChild!)
  expect(label.getBoundingClientRect().left - icon.right).toBe(8)
  expect(item.textContent).toBe('Duplicate')
})

// A menu longer than the room below and above its trigger fits the room below and scrolls, so
// every item can be reached.
test('a menu of 50 items under a trigger near the top fits the screen and scrolls to its last item', async () => {
  const items = Array.from({ length: 50 }, (_, i) => `<eb-menu-item>Item ${i}</eb-menu-item>`).join('')
  await render(
    `<div style="padding-top: 60px"><eb-menu label="More"><eb-button slot="trigger">More</eb-button>${items}</eb-menu></div>`,
  )
  await userEvent.click(page.getByRole('button', { name: 'More' }))
  const box = panel('eb-menu')
  await expect.poll(() => box.matches(':popover-open')).toBe(true)
  await frame()
  const { top, bottom } = box.getBoundingClientRect()
  expect(top).toBeGreaterThanOrEqual(60)
  expect(bottom).toBeLessThanOrEqual(window.innerHeight - 8)
  expect(box.scrollHeight).toBeGreaterThan(box.clientHeight)
  const last = document.querySelectorAll('eb-menu-item')[49]!
  last.scrollIntoView({ block: 'nearest' })
  const item = last.getBoundingClientRect()
  expect(item.bottom).toBeLessThanOrEqual(window.innerHeight - 8)
  expect(item.top).toBeGreaterThanOrEqual(top)
})
