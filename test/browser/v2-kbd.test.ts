import { afterEach, expect, test } from 'vitest'
// e-kbd: CSS draws the chip before the script, which then writes the keys for the platform.
import { page } from 'vitest/browser'

import '../../src/v2.css'
import { defineKbd, shortcutText } from '../../src/v2/kbd.ts'

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

const linux = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const mac =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'

test('mod+k reads Ctrl K on Linux and ⌘ K on a Mac', () => {
  expect(shortcutText('mod+k', linux)).toBe('Ctrl K')
  expect(shortcutText('mod+k', mac)).toBe('⌘ K')
  expect(shortcutText('mod+shift+p', linux)).toBe('Ctrl Shift P')
  expect(shortcutText('mod+shift+p', mac)).toBe('⌘ ⇧ P')
})

// The tests above the first define call run before any test defines the tag, so they see the CSS alone.
test('before the script the chip is a 20 px tall box', () => {
  const tag = mount('<e-kbd shortcut="mod+k"></e-kbd>').firstElementChild!
  expect(box(tag).height).toBe(20)
})

test('the script writes the keys without moving the chip, whose text is ready in the markup or not', () => {
  const holder = mount(
    '<p>Press <e-kbd shortcut="mod+k">Ctrl K</e-kbd> or <e-kbd shortcut="mod+k"></e-kbd></p><p lang="bn">চাপুন <e-kbd shortcut="mod+k"></e-kbd></p>',
  )
  const tags = [...holder.querySelectorAll('e-kbd')]
  const before = tags.map(box)
  defineKbd(linux)
  expect(tags.map((tag) => tag.textContent)).toEqual(['Ctrl K', 'Ctrl K', 'Ctrl K'])
  // The text is ready in the first, so nothing moves; the others only grow to fit it.
  expect(near(before[0]!, box(tags[0]!))).toEqual([])
  for (const index of [1, 2]) {
    const after = box(tags[index]!)
    expect([before[index]!.x, before[index]!.y, before[index]!.height].map((v) => Math.round(v))).toEqual(
      [after.x, after.y, after.height].map((v) => Math.round(v)),
    )
  }
})

test('the chip is a kbd element showing Ctrl K', async () => {
  mount('<e-kbd shortcut="mod+k"></e-kbd>')
  await expect.element(page.getByText('Ctrl K')).toBeVisible()
  expect(document.querySelector('e-kbd > kbd')!.textContent).toBe('Ctrl K')
})
