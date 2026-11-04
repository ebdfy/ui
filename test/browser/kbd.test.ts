import { expect, test } from 'vitest'

import '../../src/v1.ts'
import { inDark } from './colour.ts'

type Updatable = HTMLElement & { updateComplete: Promise<unknown> }

const agents = {
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  android:
    'Mozilla/5.0 (Linux; Android 14; SM-A155F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  macos:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
}

// Renders one hint under a faked user agent and puts the real one back.
async function hint(shortcut: string, userAgent?: string): Promise<HTMLElement> {
  const original = Object.getOwnPropertyDescriptor(navigator, 'userAgent')
  try {
    if (userAgent) Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true })
    document.body.innerHTML = `<eb-kbd shortcut="${shortcut}"></eb-kbd>`
    const el = document.querySelector('eb-kbd') as Updatable
    await el.updateComplete
    const kbd = el.shadowRoot?.querySelector<HTMLElement>('kbd')
    if (!kbd) throw new Error('no kbd in eb-kbd')
    return kbd
  } finally {
    if (original) Object.defineProperty(navigator, 'userAgent', original)
    else delete (navigator as { userAgent?: string }).userAgent
  }
}

test.each([
  ['windows', 'Ctrl+D'],
  ['linux', 'Ctrl+D'],
  ['android', 'Ctrl+D'],
  ['macos', '⌘D'],
  ['ios', '⌘D'],
] as const)('mod+d on %s shows %s', async (name, text) => {
  expect((await hint('mod+d', agents[name])).textContent).toBe(text)
})

test('upper-cases other keys and leaves symbols alone', async () => {
  expect((await hint('mod+/', agents.linux)).textContent).toBe('Ctrl+/')
  expect((await hint('MOD+k', agents.macos)).textContent).toBe('⌘K')
})

test('keeps Latin letters on a Bangla page', async () => {
  const lang = document.documentElement.lang
  try {
    document.documentElement.lang = 'bn'
    expect((await hint('mod+d', agents.windows)).textContent).toBe('Ctrl+D')
  } finally {
    document.documentElement.lang = lang
  }
})

function look(kbd: HTMLElement) {
  const style = getComputedStyle(kbd)
  return { height: style.height, background: style.backgroundColor, shadow: style.boxShadow }
}

test('the hint is 20px tall on surface-2 with an edge ring, light', async () => {
  const { height, background, shadow } = look(await hint('mod+d', agents.linux))
  expect(height).toBe('20px')
  expect(background).toBe('oklch(0.972 0.003 85)')
  expect(shadow).toContain('oklch(0.87 0.005 85)')
})

test('the hint is 20px tall on surface-2 with an edge ring, dark', async () => {
  const { height, background, shadow } = await inDark(async () => look(await hint('mod+d', agents.linux)))
  expect(height).toBe('20px')
  expect(background).toBe('oklch(0.245 0.004 85)')
  expect(shadow).toContain('oklch(0.35 0.006 85)')
})
