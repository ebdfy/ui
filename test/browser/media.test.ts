import { expect, test } from 'vitest'

import { initials } from '../../src/components/avatar.ts'
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

const sizes = [
  ['small', 40],
  ['medium', 56],
  ['large', 80],
] as const

for (const [size, px] of sizes) {
  test(`a ${size} thumbnail is ${px} px square`, async () => {
    await render(`<eb-thumbnail size="${size}"></eb-thumbnail>`)
    const box = document.querySelector('eb-thumbnail')!.getBoundingClientRect()
    expect(box.width).toBe(px)
    expect(box.height).toBe(px)
  })
}

test('a thumbnail with no size is medium', async () => {
  await render('<eb-thumbnail></eb-thumbnail>')
  expect(document.querySelector('eb-thumbnail')!.getBoundingClientRect().width).toBe(56)
})

test('a thumbnail with no src shows the image icon and no img', async () => {
  await render('<eb-thumbnail alt="Shirt"></eb-thumbnail>')
  const shadow = root('eb-thumbnail')
  expect(shadow.querySelector('svg')).not.toBeNull()
  expect(shadow.querySelector('img')).toBeNull()
  const el = document.querySelector('eb-thumbnail')!
  expect(getComputedStyle(el).backgroundColor).toBe('oklch(0.972 0.003 85)')
  expect(getComputedStyle(el).color).toBe('oklch(0.47 0.008 85)')
  expect(getComputedStyle(el).borderRadius).toBe('8px')
})

test('a thumbnail with a working src shows a covering img', async () => {
  const pixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
  await render(`<eb-thumbnail src="${pixel}" alt="Shirt"></eb-thumbnail>`)
  const img = root('eb-thumbnail').querySelector('img')!
  expect(img.getAttribute('alt')).toBe('Shirt')
  expect(getComputedStyle(img).objectFit).toBe('cover')
  expect(root('eb-thumbnail').querySelector('svg')).toBeNull()
})

test('a thumbnail whose src fails to load ends showing the icon', async () => {
  await render('<eb-thumbnail src="/no-such-picture.png" alt="Shirt"></eb-thumbnail>')
  await expect.poll(() => root('eb-thumbnail').querySelector('svg')).not.toBeNull()
  expect(root('eb-thumbnail').querySelector('img')).toBeNull()
})

const names = [
  ['Rahim Uddin', 'RU'],
  ['Rahim', 'R'],
  ['ক্ষমা রায়', 'ক'],
] as const

for (const [name, shown] of names) {
  test(`an avatar for ${name} shows ${shown}`, async () => {
    await render(`<eb-avatar name="${name}"></eb-avatar>`)
    const el = document.querySelector('eb-avatar')!
    const circle = root('eb-avatar').querySelector('[role="img"]')!
    expect(circle.getAttribute('aria-label')).toBe(name)
    expect(circle.textContent?.trim()).toBe(shown)
    const box = el.getBoundingClientRect()
    expect(box.width).toBe(40)
    expect(box.height).toBe(40)
  })
}

test('an avatar is a round info tone circle of 15 px semibold text', async () => {
  await render('<eb-avatar name="Rahim Uddin"></eb-avatar>')
  const circle = root('eb-avatar').querySelector('[role="img"]')!
  const style = getComputedStyle(circle)
  expect(style.borderRadius).toBe('50%')
  expect(style.backgroundColor).toBe('oklch(0.952 0.004 85)')
  expect(style.color).toBe('oklch(0.47 0.008 85)')
  expect(style.fontSize).toBe('15px')
  expect(style.fontWeight).toBe('600')
})

test('an avatar with a src shows the picture', async () => {
  const pixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
  await render(`<eb-avatar name="Rahim Uddin" src="${pixel}"></eb-avatar>`)
  const shadow = root('eb-avatar')
  expect(shadow.querySelector('img')).not.toBeNull()
  expect(shadow.querySelector('[role="img"]')!.getAttribute('aria-label')).toBe('Rahim Uddin')
})

const initialsOf = [
  ['মো. হাসান', 'হ'],
  ['নুসরাত জাহান', 'ন'],
  ['মোহাম্মদ রফিক', 'র'],
  ['মোঃ করিম', 'ক'],
  ['Md. Hasan', 'MH'],
  ['Rahim Uddin', 'RU'],
  ['হাসান', 'হ'],
  ['মো.', 'ম'],
  ['মো: হাসান', 'হ'],
  ['মুহাম্মদ রফিক', 'র'],
  ['মোছা. নাসরিন আক্তার', 'ন'],
  ['মোসাম্মৎ শাহিনা বেগম', 'শ'],
] as const

for (const [name, expected] of initialsOf) {
  test(`initials of ${name} are ${expected}`, () => {
    expect(initials(name)).toBe(expected)
  })
}

test('an avatar for a Bangla name with an honorific shows one letter', async () => {
  await render('<eb-avatar name="মো. হাসান"></eb-avatar>')
  expect(root('eb-avatar').querySelector('.circle')!.textContent?.trim()).toBe('হ')
})

test('an avatar whose picture fails shows its initials, and a new src brings the picture back', async () => {
  await render('<eb-avatar name="Rahim Uddin" src="/does-not-exist.png"></eb-avatar>')
  const shadow = root('eb-avatar')
  await expect.poll(() => shadow.querySelector('img')).toBeNull()
  expect(shadow.querySelector('.circle')!.textContent?.trim()).toBe('RU')

  const svg = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E'
  document.querySelector('eb-avatar')!.setAttribute('src', svg)
  await expect.poll(() => shadow.querySelector('img')).not.toBeNull()
})

function paginationButtons(): HTMLButtonElement[] {
  return [...root('eb-pagination').querySelectorAll('button')]
}

test('pagination fires previous and next from enabled buttons only', async () => {
  await render('<eb-pagination has-next></eb-pagination>')
  const fired: string[] = []
  document.addEventListener('eb-previous', () => fired.push('previous'))
  document.addEventListener('eb-next', () => fired.push('next'))
  const [previous, next] = paginationButtons()
  expect(previous!.disabled).toBe(true)
  expect(next!.disabled).toBe(false)
  previous!.click()
  expect(fired).toEqual([])
  next!.click()
  expect(fired).toEqual(['next'])

  document.querySelector('eb-pagination')!.toggleAttribute('has-previous', true)
  await document.querySelector('eb-pagination')!.updateComplete
  paginationButtons()[0]!.click()
  expect(fired).toEqual(['next', 'previous'])

  document.querySelector('eb-pagination')!.toggleAttribute('has-next', false)
  await document.querySelector('eb-pagination')!.updateComplete
  expect(paginationButtons()[1]!.disabled).toBe(true)
  paginationButtons()[1]!.click()
  expect(fired).toEqual(['next', 'previous'])
})

test('pagination buttons are at least 44 px square with chevron icons', async () => {
  await render('<eb-pagination has-previous has-next></eb-pagination>')
  for (const button of paginationButtons()) {
    const box = button.getBoundingClientRect()
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(button.querySelector('svg')).not.toBeNull()
  }
})

test('pagination speaks Bangla under a bn page', async () => {
  document.documentElement.lang = 'bn'
  try {
    await render('<eb-pagination has-previous has-next></eb-pagination>')
    const [previous, next] = paginationButtons()
    expect(previous!.getAttribute('aria-label')).toBe('আগের পাতা')
    expect(next!.getAttribute('aria-label')).toBe('পরের পাতা')
    expect(root('eb-pagination').querySelector('nav')!.getAttribute('aria-label')).toBe('পাতা')
  } finally {
    document.documentElement.lang = 'en'
  }
})

test('pagination speaks English by default', async () => {
  document.documentElement.lang = 'en'
  await render('<eb-pagination has-previous has-next></eb-pagination>')
  const [previous, next] = paginationButtons()
  expect(previous!.getAttribute('aria-label')).toBe('Previous page')
  expect(next!.getAttribute('aria-label')).toBe('Next page')
  expect(root('eb-pagination').querySelector('nav')!.getAttribute('aria-label')).toBe('Pagination')
})

test.for([
  ['small', 16],
  ['medium', 16],
  ['large', 20],
] as const)(
  "a %s thumbnail's placeholder icon is %i px, on surface-2 inside a 1 px divider ring",
  async ([size, px]) => {
    await render(`<eb-thumbnail size="${size}"></eb-thumbnail>`)
    const host = document.querySelector('eb-thumbnail')!
    const icon = root('eb-thumbnail').querySelector('svg')!.getBoundingClientRect()
    expect([icon.width, icon.height]).toEqual([px, px])
    expect(getComputedStyle(host).backgroundColor).toBe('oklch(0.972 0.003 85)')
    expect(getComputedStyle(host, '::after').boxShadow).toBe('oklch(0.925 0.004 85) 0px 0px 0px 1px inset')
  },
)

test('the ring sits over a picture too, so a white product keeps its edge', async () => {
  const white =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Crect width='8' height='8' fill='white'/%3E%3C/svg%3E"
  await render(`<eb-thumbnail src="${white}" alt="Shirt"></eb-thumbnail>`)
  const host = document.querySelector('eb-thumbnail')!
  const ring = getComputedStyle(host, '::after')
  expect(ring.position).toBe('absolute')
  expect(ring.boxShadow).toBe('oklch(0.925 0.004 85) 0px 0px 0px 1px inset')
})
