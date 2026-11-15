// A record's person and their contact: e-avatar at 24 and 32 px with the signed-in person in lime,
// e-person (avatar, name, a line of history), e-contact (a tel: link with copy), e-meter (a thin bar
// for a share) and e-bottom-bar's phone dock.
import { afterEach, expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '../../src/v2.css'
import { defineAvatar } from '../../src/v2/avatar.ts'
import { defineButton } from '../../src/v2/button.ts'
import { defineContact } from '../../src/v2/contact.ts'
import { defineIcon } from '../../src/v2/icon.ts'
import { defineMeter } from '../../src/v2/meter.ts'

afterEach(async () => {
  document.body.replaceChildren()
  await page.viewport(360, 800)
})

const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect()

const boxes = () =>
  [...document.querySelectorAll('body *')].map((el) => {
    const r = el.getBoundingClientRect()
    return `${el.localName} ${Math.round(r.left)} ${Math.round(r.top)} ${Math.round(r.width)} ${Math.round(r.height)}`
  })

test('an avatar is 32 px, 24 px with size="24", and lime with tone="lime"', () => {
  document.body.innerHTML = `<e-avatar name="Rahima Akter"></e-avatar><e-avatar name="Rafiq Ahmed" size="24"></e-avatar><e-avatar name="Rafiq Ahmed" tone="lime"></e-avatar>`
  defineAvatar()
  const [plain, small, lime] = document.querySelectorAll('e-avatar')
  expect([plain!.getBoundingClientRect().width, plain!.getBoundingClientRect().height]).toEqual([32, 32])
  expect([small!.getBoundingClientRect().width, small!.getBoundingClientRect().height]).toEqual([24, 24])
  const tint = getComputedStyle(document.documentElement).getPropertyValue('--e-color-lime').trim()
  const probe = document.createElement('div')
  probe.style.background = tint
  document.body.append(probe)
  expect(getComputedStyle(lime!).backgroundColor).toBe(getComputedStyle(probe).backgroundColor)
  expect(getComputedStyle(lime!, '::before').content).toBe('"RA"')
  expect(Number.parseFloat(getComputedStyle(small!).fontSize)).toBeGreaterThanOrEqual(11)
})

test('a person row shows the avatar, the name and a quieter history line beside it', () => {
  document.body.innerHTML = `<div style="width: 320px"><e-person><e-avatar name="Rahima Akter"></e-avatar><a href="/customers/7" slot="name">Rahima Akter</a><span slot="meta">4 orders · ৳9,840 spent</span></e-person></div>`
  defineAvatar()
  const avatar = rect('e-avatar')
  const name = rect('[slot="name"]')
  const meta = rect('[slot="meta"]')
  expect(avatar.width).toBe(32)
  expect(name.left).toBeGreaterThanOrEqual(avatar.right + 8)
  expect(meta.left).toBe(name.left)
  expect(meta.top).toBeGreaterThanOrEqual(name.bottom)
  expect(Math.abs((name.top + meta.bottom) / 2 - (avatar.top + avatar.bottom) / 2)).toBeLessThanOrEqual(2)
  const style = getComputedStyle(document.querySelector('[slot="meta"]')!)
  expect([style.fontSize, style.color]).not.toEqual([
    getComputedStyle(document.querySelector('[slot="name"]')!).fontSize,
    getComputedStyle(document.querySelector('[slot="name"]')!).color,
  ])
  expect(style.fontSize).toBe('13px')
})

test('a contact row is a tel: link, and its copy button, shown only by the script, puts the number on the clipboard', async () => {
  document.body.innerHTML = `<e-contact><e-icon name="phone"></e-icon><a href="tel:01707071042">01707-071042</a></e-contact>`
  const before = boxes()
  expect(document.querySelector('e-contact button')).toBeNull()
  defineIcon()
  defineContact()
  expect(boxes().filter((box) => !box.startsWith('button') && !box.startsWith('e-icon'))).toEqual(
    before.filter((box) => !box.startsWith('e-icon')),
  )
  expect(document.querySelector('e-contact a')!.getAttribute('href')).toBe('tel:01707071042')
  const copy = document.querySelector<HTMLButtonElement>('e-contact button')!
  expect(copy.getAttribute('aria-label')).toBe('Copy 01707071042')
  expect(copy.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
  expect(copy.getBoundingClientRect().left).toBeGreaterThanOrEqual(rect('e-contact a').right)
  const written: string[] = []
  const real = navigator.clipboard.writeText.bind(navigator.clipboard)
  navigator.clipboard.writeText = async (text: string) => {
    written.push(text)
  }
  try {
    await userEvent.click(copy)
  } finally {
    navigator.clipboard.writeText = real
  }
  expect(written).toEqual(['01707071042'])
  expect(copy.getAttribute('aria-label')).toBe('Copied')
  await expect.poll(() => copy.querySelector('use')?.getAttribute('href')).toBe('#e-icon-check')
})

test('a Bangla contact names its copy button in Bangla', () => {
  document.body.innerHTML = `<e-contact lang="bn"><a href="tel:01707071042">01707-071042</a></e-contact>`
  defineContact()
  expect(document.querySelector('e-contact button')!.getAttribute('aria-label')).toBe('01707071042 কপি করুন')
})

test('a contact whose number changes after the script ran names and copies the new number', async () => {
  document.body.innerHTML = `<e-contact><a href="tel:01707071042">01707-071042</a></e-contact>`
  defineContact()
  const link = document.querySelector('e-contact a')!
  link.setAttribute('href', 'tel:01811111111')
  link.textContent = '01811-111111'
  await new Promise((resolve) => setTimeout(resolve))
  const copy = document.querySelector<HTMLButtonElement>('e-contact button')!
  expect(copy.getAttribute('aria-label')).toBe('Copy 01811111111')
  const written: string[] = []
  const real = navigator.clipboard.writeText.bind(navigator.clipboard)
  navigator.clipboard.writeText = async (text: string) => {
    written.push(text)
  }
  try {
    await userEvent.click(copy)
  } finally {
    navigator.clipboard.writeText = real
  }
  expect(written).toEqual(['01811111111'])
})

test('a meter fills the share its value names, and says it to a screen reader', () => {
  document.body.innerHTML = `<div style="width: 300px"><e-meter value="92" label="Delivered"></e-meter><e-meter value="15" tone="critical" label="Returned"></e-meter></div>`
  defineMeter()
  const [delivered, returned] = document.querySelectorAll('e-meter')
  const track = delivered!.getBoundingClientRect()
  expect(track.width).toBe(300)
  expect(track.height).toBeLessThanOrEqual(8)
  const fill = Number.parseFloat(getComputedStyle(delivered!, '::before').width)
  expect(fill).toBeCloseTo(300 * 0.92, 0)
  expect(Number.parseFloat(getComputedStyle(returned!, '::before').width)).toBeCloseTo(45, 0)
  expect(getComputedStyle(returned!, '::before').backgroundColor).not.toBe(
    getComputedStyle(delivered!, '::before').backgroundColor,
  )
  expect([delivered!.getAttribute('role'), delivered!.getAttribute('aria-valuenow')]).toEqual(['meter', '92'])
  expect(delivered!.getAttribute('aria-label')).toBe('Delivered')
})

test('at 360 px a dock sticks to the bottom with 44 px buttons; from 600 px it is gone', async () => {
  document.body.innerHTML = `<div style="height: 2000px"></div><e-bottom-bar dock><e-button>Call</e-button><e-button tone="primary">Confirm</e-button></e-bottom-bar>`
  defineButton()
  const dock = document.querySelector('e-bottom-bar')!
  expect(Math.round(dock.getBoundingClientRect().bottom)).toBe(800)
  // An e-button is a 44 px host round its 42 px button, as every phone tap target is.
  for (const button of document.querySelectorAll('e-bottom-bar e-button')) {
    expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
  }
  await page.viewport(1280, 800)
  expect(getComputedStyle(dock).display).toBe('none')
})
