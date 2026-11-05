import { afterEach, expect, test } from 'vitest'
import { page } from 'vitest/browser'

// e-thumbnail and e-avatar: fixed boxes drawn by v2.css alone. The avatar's script only fills in
// the initials, so its box is the same before and after.
import '../../src/v2.css'
import { defineAvatar } from '../../src/v2/avatar.ts'

afterEach(() => {
  document.body.replaceChildren()
})

const image =
  '<img alt="Blue three-piece" src="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27300%27 height=%27100%27%3E%3Crect width=%27300%27 height=%27100%27 fill=%27%23369%27/%3E%3C/svg%3E">'

const sizes = [
  ['small', 32],
  ['medium', 40],
  ['large', 56],
] as const

for (const [size, px] of sizes) {
  test(`a ${size} thumbnail is ${px} px square with and without an image`, () => {
    document.body.innerHTML = `<e-thumbnail size="${size}"></e-thumbnail><e-thumbnail size="${size}">${image}</e-thumbnail>`
    for (const t of document.querySelectorAll('e-thumbnail')) {
      const r = t.getBoundingClientRect()
      expect([r.width, r.height]).toEqual([px, px])
    }
    const img = document.querySelector('e-thumbnail img')!
    const r = img.getBoundingClientRect()
    expect([r.width, r.height]).toEqual([px - 2, px - 2])
    expect(getComputedStyle(img).objectFit).toBe('cover')
  })
}

test('a thumbnail with no size is medium, with the first radius and a line border', () => {
  document.body.innerHTML = '<e-thumbnail></e-thumbnail>'
  const t = document.querySelector('e-thumbnail')!
  const style = getComputedStyle(t)
  expect(t.getBoundingClientRect().width).toBe(40)
  expect(style.borderTopLeftRadius).toBe('8px')
  expect(style.borderTopWidth).toBe('1px')
})

test('an avatar is a 32 px circle that shows RA for Rahima Akter, with the same box before the script', () => {
  document.body.innerHTML = '<e-avatar name="Rahima Akter"></e-avatar>'
  const avatar = document.querySelector('e-avatar')!
  const before = avatar.getBoundingClientRect()
  expect([before.width, before.height]).toEqual([32, 32])
  defineAvatar()
  const after = avatar.getBoundingClientRect()
  expect([after.width, after.height, after.left, after.top]).toEqual([32, 32, before.left, before.top])
  expect(getComputedStyle(avatar).borderTopLeftRadius).toBe('50%')
  expect(getComputedStyle(avatar, '::before').content).toBe('"RA"')
})

test('an avatar takes its initials from the first and last word and follows a new name', () => {
  defineAvatar()
  document.body.innerHTML = '<e-avatar name="nusrat jahan mim"></e-avatar>'
  const avatar = document.querySelector('e-avatar')!
  expect(getComputedStyle(avatar, '::before').content).toBe('"NM"')
  avatar.setAttribute('name', 'রহিমা আক্তার')
  expect(getComputedStyle(avatar, '::before').content).toBe('"রআ"')
})

test('an avatar with an image shows the picture and no initials', () => {
  defineAvatar()
  document.body.innerHTML = `<e-avatar name="Rahima Akter">${image}</e-avatar>`
  const avatar = document.querySelector('e-avatar')!
  const img = avatar.querySelector('img')!.getBoundingClientRect()
  expect([img.width, img.height]).toEqual([32, 32])
  expect(getComputedStyle(avatar, '::before').content).toBe('none')
})

test('an avatar is named by its person for assistive tech, and follows a new name', async () => {
  defineAvatar()
  document.body.innerHTML = '<e-avatar name="Rahima Akter"></e-avatar>'
  await expect.element(page.getByRole('img', { name: 'Rahima Akter' })).toBeInTheDocument()
  document.querySelector('e-avatar')!.setAttribute('name', 'রহিমা আক্তার')
  await expect.element(page.getByRole('img', { name: 'রহিমা আক্তার' })).toBeInTheDocument()
})
