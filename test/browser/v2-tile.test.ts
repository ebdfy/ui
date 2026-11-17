// .e-tile: an app's initial on lime at 20, 28 and 40 px, its icon over the initial when the page
// gives one, and the initial again when the icon fails to load.
import { afterEach, expect, test } from 'vitest'

import '../../src/v2.css'
import { keepTileInitials } from '../../src/v2-host-tile.ts'

afterEach(() => document.body.replaceChildren())

// A 2 by 2 red PNG, which loads, and an address that answers no image.
const icon =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGP4z8DwHwyBNAMDAE5cBfuBMb/aAAAAAElFTkSuQmCC'
const missing = '/no-such-icon.png'

const box = (element: Element) => {
  const { width, height } = element.getBoundingClientRect()
  return { width, height }
}

// What the tile shows: its icon, or a broken image, when the img is drawn over it, else its initial.
const shows = (tile: Element) => {
  const image = tile.querySelector('img')
  if (image?.checkVisibility()) return image.naturalWidth > 0 ? 'icon' : 'broken image'
  return tile.textContent?.trim()
}

test.for([
  ['20', 20],
  ['28', 28],
  ['40', 40],
] as const)('a tile of data-size %s holds its icon at %i px over the whole tile', async ([size, px]) => {
  document.body.innerHTML = `<span class="e-tile" data-size="${size}">S<img alt="" src="${icon}" /></span>`
  keepTileInitials()
  const tile = document.querySelector('.e-tile')!
  await expect.poll(() => shows(tile)).toBe('icon')
  expect(box(tile)).toEqual({ width: px, height: px })
  expect(box(tile.querySelector('img')!)).toEqual({ width: px, height: px })
})

test('a tile with no icon shows its initial', () => {
  document.body.innerHTML = '<span class="e-tile">S</span>'
  keepTileInitials()
  expect(shows(document.querySelector('.e-tile')!)).toBe('S')
  expect(box(document.querySelector('.e-tile')!)).toEqual({ width: 28, height: 28 })
})

test('an icon that failed to load before the script ran leaves the initial showing', async () => {
  document.body.innerHTML = `<span class="e-tile">S<img alt="" src="${missing}" /></span>`
  const image = document.querySelector('img')!
  await new Promise((done) => image.addEventListener('error', done, { once: true }))
  keepTileInitials()
  await expect.poll(() => shows(document.querySelector('.e-tile')!)).toBe('S')
})

test('an icon added after the script ran that fails to load leaves the initial showing', async () => {
  keepTileInitials()
  document.body.innerHTML = `<span class="e-tile" data-size="20">S<img alt="" src="${missing}" /></span>`
  await expect.poll(() => shows(document.querySelector('.e-tile')!)).toBe('S')
})
