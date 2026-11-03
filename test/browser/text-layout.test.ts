import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '../../src/v1.ts'

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

const levels = [
  ['1', 'H1', '30px', '40px', '650'],
  ['2', 'H2', '22px', '32px', '650'],
  ['3', 'H3', '17px', '24px', '600'],
] as const

for (const [level, tag, size, lineHeight, weight] of levels) {
  test(`a level ${level} heading is an ${tag} of ${size}/${lineHeight} text at weight ${weight}`, async () => {
    await render(`<eb-heading level="${level}">Orders</eb-heading>`)
    const h = root('eb-heading').querySelector(tag)!
    expect(h).not.toBeNull()
    const style = getComputedStyle(h)
    expect(style.fontSize).toBe(size)
    expect(style.lineHeight).toBe(lineHeight)
    expect(style.fontWeight).toBe(weight)
    expect(style.margin).toBe('0px')
  })
}

test('a level 1 heading in Bangla opens its lines to 42 px, a 1.4 line height', async () => {
  await render('<div lang="bn"><eb-heading level="1">অর্ডার</eb-heading></div>')
  const style = getComputedStyle(root('eb-heading').querySelector('h1')!)
  expect(style.fontSize).toBe('30px')
  expect(style.lineHeight).toBe('42px')
})

test('a heading with no level is an h2', async () => {
  await render('<eb-heading>Orders</eb-heading>')
  expect(root('eb-heading').querySelector('h2')).not.toBeNull()
})

test('on a phone, text is 15/24 in the text colour, and meta text is 13/20 and muted', async () => {
  await render('<eb-text>One</eb-text><eb-text variant="meta">Two</eb-text>')
  const [body, meta] = document.querySelectorAll('eb-text')
  expect(getComputedStyle(body!).fontSize).toBe('15px')
  expect(getComputedStyle(body!).lineHeight).toBe('24px')
  expect(getComputedStyle(body!).color).toBe('oklch(0.21 0.006 85)')
  expect(getComputedStyle(meta!).fontSize).toBe('13px')
  expect(getComputedStyle(meta!).lineHeight).toBe('20px')
  expect(getComputedStyle(meta!).color).toBe('oklch(0.47 0.008 85)')
})

test('on a desktop, text is 14/20 and meta text stays 13/20', async () => {
  try {
    await page.viewport(1280, 800)
    await render('<eb-text>One</eb-text><eb-text variant="meta">Two</eb-text>')
    const [body, meta] = document.querySelectorAll('eb-text')
    expect(getComputedStyle(body!).fontSize).toBe('14px')
    expect(getComputedStyle(body!).lineHeight).toBe('20px')
    expect(getComputedStyle(meta!).fontSize).toBe('13px')
    expect(getComputedStyle(meta!).lineHeight).toBe('20px')
  } finally {
    await page.viewport(360, 800)
  }
})

test('a long unbroken word in text does not widen the page', async () => {
  // A tracking link with no break in it, after a Bangla run with none. (A run of one letter, such as
  // 200 x's, overflows by 1 px in Geist: Chromium's kerning across the forced breaks.)
  await render(`<eb-text>${'ক'.repeat(200)}${'https://sample-app.ebdfy.com/track/EB1040X'.repeat(8)}</eb-text>`)
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(360)
})

test('a link is an underlined anchor in the text colour that navigates', async () => {
  try {
    await render('<eb-link href="#somewhere">Track</eb-link>')
    const a = root('eb-link').querySelector('a')!
    expect(a.getAttribute('part')).toBe('link')
    const style = getComputedStyle(a)
    expect(style.color).toBe('oklch(0.21 0.006 85)')
    expect(style.textDecorationLine).toBe('underline')
    a.click()
    expect(location.hash).toBe('#somewhere')
  } finally {
    history.replaceState(null, '', location.pathname + location.search)
  }
})

test('a focused link shows a 2 px focus-colour outline', async () => {
  await render('<eb-link href="#somewhere">Track</eb-link>')
  const a = root('eb-link').querySelector('a')!
  await userEvent.tab()
  const style = getComputedStyle(a)
  expect(a.matches(':focus-visible')).toBe(true)
  expect(style.outlineWidth).toBe('2px')
  expect(style.outlineColor).toBe('oklch(0.52 0.19 268)')
})

test('a stack is a column with a 12 px gap', async () => {
  await render('<eb-stack><div>A</div><div>B</div></eb-stack>')
  const stack = document.querySelector('eb-stack')!
  const style = getComputedStyle(stack)
  expect(style.display).toBe('flex')
  expect(style.flexDirection).toBe('column')
  expect(style.rowGap).toBe('12px')
  const [a, b] = stack.children
  expect(b!.getBoundingClientRect().top - a!.getBoundingClientRect().bottom).toBe(12)
})

test('a row stack keeps small items on one line and wraps big ones at 360 px', async () => {
  await render('<eb-stack direction="row"><span>A</span><span>B</span></eb-stack>')
  let [a, b] = document.querySelector('eb-stack')!.children
  expect(a!.getBoundingClientRect().top).toBe(b!.getBoundingClientRect().top)

  await render('<eb-stack direction="row"><div style="width:200px">A</div><div style="width:200px">B</div></eb-stack>')
  ;[a, b] = document.querySelector('eb-stack')!.children
  expect(b!.getBoundingClientRect().top).toBeGreaterThan(a!.getBoundingClientRect().bottom - 1)
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(360)
})

test('a grid stacks at 360 px and sits side by side from 600 px', async () => {
  try {
    await render('<eb-grid><div>A</div><div>B</div></eb-grid>')
    const [a, b] = document.querySelector('eb-grid')!.children
    expect(b!.getBoundingClientRect().top).toBeGreaterThan(a!.getBoundingClientRect().bottom)
    await page.viewport(800, 800)
    expect(b!.getBoundingClientRect().top).toBe(a!.getBoundingClientRect().top)
    expect(b!.getBoundingClientRect().left).toBeGreaterThan(a!.getBoundingClientRect().right)
    expect(getComputedStyle(document.querySelector('eb-grid')!).columnGap).toBe('12px')
  } finally {
    await page.viewport(360, 800)
  }
})

test('a divider is a 1 px separator in the line colour', async () => {
  await render('<eb-divider></eb-divider>')
  const hr = root('eb-divider').querySelector('hr')!
  expect(hr.getBoundingClientRect().height).toBe(1)
  expect(getComputedStyle(hr).margin).toBe('0px')
  expect(getComputedStyle(hr).backgroundColor).toBe('oklch(0.925 0.004 85)')
})

test('an English element inside a Bangla page goes back to Geist, and Bangla takes Noto Sans Bengali first', async () => {
  await render('<div lang="bn"><eb-text>অর্ডার</eb-text><eb-text lang="en">Order</eb-text></div>')
  const [bangla, english] = document.querySelectorAll('eb-text')
  expect(getComputedStyle(bangla!).fontFamily).toMatch(/^"Noto Sans Bengali"/)
  expect(getComputedStyle(english!).fontFamily).toMatch(/^Geist,/)
})
