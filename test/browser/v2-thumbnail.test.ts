// e-thumbnail: a fixed square that takes src and alt, draws a letter or an image mark when empty,
// and keeps its box when the script runs.
import { afterEach, expect, test } from 'vitest'

import '../../src/v2.css'
import { defineThumbnail } from '../../src/v2/thumbnail.ts'

afterEach(() => {
  document.body.replaceChildren()
})

const svg =
  'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2710%27 height=%2710%27%3E%3Crect width=%2710%27 height=%2710%27 fill=%27%23369%27/%3E%3C/svg%3E'

const box = (el: Element) => {
  const r = el.getBoundingClientRect()
  return [r.width, r.height]
}

test('small is 32 px, the default 40 px and large 88 px', () => {
  document.body.innerHTML =
    '<e-thumbnail size="small"></e-thumbnail><e-thumbnail></e-thumbnail><e-thumbnail size="large"></e-thumbnail>'
  const [small, plain, large] = document.querySelectorAll('e-thumbnail')
  expect(box(small!)).toEqual([32, 32])
  expect(box(plain!)).toEqual([40, 40])
  expect(box(large!)).toEqual([88, 88])
})

test('src and alt build an img, the box is the same before and after, and a new src updates it', () => {
  document.body.innerHTML = `<e-thumbnail src="${svg}" alt="Saree"></e-thumbnail>`
  const t = document.querySelector('e-thumbnail')!
  const before = box(t)
  defineThumbnail()
  const img = t.querySelector('img')!
  expect(img.getAttribute('src')).toBe(svg)
  expect(img.getAttribute('alt')).toBe('Saree')
  expect(box(t)).toEqual(before)
  t.setAttribute('src', svg.replace('369', 'c63'))
  expect(t.querySelectorAll('img')).toHaveLength(1)
  expect(t.querySelector('img')!.getAttribute('src')).toContain('c63')
})

test('an img already inside is kept', () => {
  document.body.innerHTML = `<e-thumbnail src="${svg}"><img alt="Mine" src="${svg}"></e-thumbnail>`
  defineThumbnail()
  const imgs = document.querySelectorAll('e-thumbnail img')
  expect(imgs).toHaveLength(1)
  expect(imgs[0]!.getAttribute('alt')).toBe('Mine')
})

test('an empty thumbnail draws the first letter of its alt, or of its line item title', () => {
  defineThumbnail()
  document.body.innerHTML = `<e-thumbnail alt="রহিমা"></e-thumbnail>
    <e-line-item><e-thumbnail></e-thumbnail><span slot="title">Jamdani saree</span></e-line-item>`
  const [bn, inLine] = document.querySelectorAll('e-thumbnail')
  expect(bn!.getAttribute('letter')).toBe('র')
  expect(getComputedStyle(bn!, '::before').content).toBe('"র"')
  expect(inLine!.getAttribute('letter')).toBe('J')
  expect(getComputedStyle(inLine!, '::before').content).toBe('"J"')
})

test('an empty thumbnail with no alt draws the image mark and no letter', () => {
  document.body.innerHTML = '<e-thumbnail></e-thumbnail>'
  const t = document.querySelector('e-thumbnail')!
  const before = box(t)
  defineThumbnail()
  expect(t.hasAttribute('letter')).toBe(false)
  const style = getComputedStyle(t, '::before')
  expect(style.content).not.toBe('none')
  expect(style.maskImage !== 'none' || style.backgroundImage !== 'none').toBe(true)
  expect(box(t)).toEqual(before)
})
