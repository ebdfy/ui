import { afterEach, beforeEach, expect, test } from 'vitest'
// e-modal: a native dialog built inside the tag, in the app's own page. ebdfy.modal.show(id) and
// hide(id) open and close it; below 600 px it is a bottom sheet.
import { page, userEvent } from 'vitest/browser'

import '../../src/v2.css'
import { phones } from './phones.ts'

// v2.ts defines e-modal as it loads, so it loads after the one test that needs the tag undefined.
let ebdfy: (typeof import('../../src/v2.ts'))['ebdfy']
beforeEach(async ({ task }) => {
  if (!task.name.startsWith('before the script')) ebdfy = (await import('../../src/v2.ts')).ebdfy
})

afterEach(async () => {
  document.body.replaceChildren()
  document.documentElement.removeAttribute('lang')
  await page.viewport(360, 800)
})

function mount(html: string): HTMLElement {
  const holder = document.createElement('div')
  holder.innerHTML = html
  document.body.append(holder)
  return holder
}

const confirm = (attrs = '') => `
  <button id="opener">Confirm</button>
  <e-modal id="confirm" heading="Confirm order #1042" ${attrs}>
    <p>Send to the courier?</p>
    <button slot="footer" id="cancel">Cancel</button>
    <button slot="footer" id="send">Send</button>
  </e-modal>`

function track(): string[] {
  const seen: string[] = []
  const tag = document.querySelector('e-modal')!
  for (const name of ['e-modal-open', 'e-modal-close']) tag.addEventListener(name, () => seen.push(name))
  return seen
}

const dialog = () => document.querySelector('e-modal dialog') as HTMLDialogElement

test('before the script an e-modal with content has no box and shows nothing', () => {
  mount('<e-modal id="early" heading="Early"><p>Hidden words</p><button>Inside</button></e-modal>')
  const tag = document.querySelector('e-modal')!
  expect(tag.getBoundingClientRect().height).toBe(0)
  expect(getComputedStyle(tag).display).toBe('none')
  expect(document.querySelector('e-modal p')!.getBoundingClientRect().height).toBe(0)
})

test('show(id) opens a dialog named by the heading, with its content and footer buttons clickable', async () => {
  mount(confirm())
  let sent = 0
  document.getElementById('send')!.addEventListener('click', () => sent++)
  ebdfy.modal.show('confirm')
  const open = page.getByRole('dialog', { name: 'Confirm order #1042' })
  await expect.element(open).toBeVisible()
  expect(dialog().contains(document.querySelector('e-modal p'))).toBe(true)
  await expect.element(page.getByText('Send to the courier?')).toBeVisible()
  await userEvent.click(page.getByRole('button', { name: 'Send' }))
  expect(sent).toBe(1)
  // The footer buttons sit at the end of their row.
  const send = document.getElementById('send')!.getBoundingClientRect()
  expect(send.right).toBeGreaterThan(dialog().getBoundingClientRect().right - 40)
})

test('pressing Escape closes it and focus returns to the button that opened it', async () => {
  mount(confirm())
  const opener = document.getElementById('opener')!
  opener.focus()
  const seen = track()
  ebdfy.modal.show('confirm')
  expect(dialog().open).toBe(true)
  expect(document.activeElement).not.toBe(opener)
  await userEvent.keyboard('{Escape}')
  expect(dialog().open).toBe(false)
  expect(document.activeElement).toBe(opener)
  await expect.poll(() => seen).toEqual(['e-modal-open', 'e-modal-close'])
})

test('the close button and hide(id) close it, each firing one close event', async () => {
  mount(confirm())
  const seen = track()
  ebdfy.modal.show('confirm')
  await userEvent.click(page.getByRole('button', { name: 'Close' }))
  expect(dialog().open).toBe(false)
  ebdfy.modal.show('confirm')
  ebdfy.modal.hide('confirm')
  expect(dialog().open).toBe(false)
  // The dialog's close event is queued, so the last one lands a task later.
  await expect.poll(() => seen).toEqual(['e-modal-open', 'e-modal-close', 'e-modal-open', 'e-modal-close'])
})

test('a click on the backdrop leaves it open', async () => {
  mount(confirm())
  ebdfy.modal.show('confirm')
  await userEvent.click(page.elementLocator(document.body), { position: { x: 4, y: 4 } })
  expect(dialog().open).toBe(true)
})

test.for(phones)('on a $width x $height phone the dialog is a sheet on the bottom edge', async ({ width, height }) => {
  await page.viewport(width, height)
  mount(confirm())
  ebdfy.modal.show('confirm')
  const rect = dialog().getBoundingClientRect()
  expect(rect.bottom).toBe(window.innerHeight)
  expect(rect.width).toBe(window.innerWidth)
  expect(rect.left).toBe(0)
  expect(getComputedStyle(dialog()).borderTopLeftRadius).toBe('16px')
  expect(getComputedStyle(dialog()).borderBottomLeftRadius).toBe('0px')
})

test.for([
  ['', 620],
  ['size="small"', 380],
  ['size="large"', 980],
] as const)('at 1280 wide %s is %i px wide and centred', async ([attrs, wide]) => {
  await page.viewport(1280, 800)
  mount(confirm(attrs))
  ebdfy.modal.show('confirm')
  const rect = dialog().getBoundingClientRect()
  expect(rect.width).toBe(wide)
  expect(rect.left).toBe((window.innerWidth - wide) / 2)
})

test.for([
  ['420', 420],
  ['560', 560],
  ['720', 720],
] as const)('at 1440 wide width="%s" is %i px wide', async ([width, wide]) => {
  await page.viewport(1440, 900)
  mount(confirm(`width="${width}"`))
  ebdfy.modal.show('confirm')
  expect(dialog().getBoundingClientRect().width).toBe(wide)
})

test('width wins over size when both are set', async () => {
  await page.viewport(1440, 900)
  mount(confirm('width="560" size="large"'))
  ebdfy.modal.show('confirm')
  expect(dialog().getBoundingClientRect().width).toBe(560)
})

test('at 360 wide width="560" is the full-width sheet', async () => {
  mount(confirm('width="560"'))
  ebdfy.modal.show('confirm')
  expect(dialog().getBoundingClientRect().width).toBe(360)
})

test('the title is 16px at 600 and the close button is 32px, 44px on a phone', async () => {
  await page.viewport(1440, 900)
  mount(confirm('width="560"'))
  ebdfy.modal.show('confirm')
  const title = getComputedStyle(dialog().querySelector('h2')!)
  expect(title.fontSize).toBe('16px')
  expect(title.fontWeight).toBe('600')
  const close = dialog().querySelector('header > button')!
  expect(close.getBoundingClientRect().width).toBe(32)
  expect(close.getBoundingClientRect().height).toBe(32)
  await page.viewport(360, 800)
  expect(close.getBoundingClientRect().width).toBe(44)
  expect(close.getBoundingClientRect().height).toBe(44)
})

test('the open dialog has the line ring and the pop shadow', () => {
  mount(confirm())
  ebdfy.modal.show('confirm')
  const shadow = getComputedStyle(dialog()).boxShadow
  expect(shadow.match(/\) 0px /g)).toHaveLength(3)
  expect(shadow).toContain('36px')
})

test('with lang bn the close button is named in Bangla', async () => {
  document.documentElement.lang = 'bn'
  mount(confirm())
  ebdfy.modal.show('confirm')
  expect(page.getByRole('button', { name: 'বন্ধ করুন' }).elements()).toHaveLength(1)
})

test('a changed heading attribute updates the dialog name', async () => {
  mount(confirm())
  ebdfy.modal.show('confirm')
  document.querySelector('e-modal')!.setAttribute('heading', 'অর্ডার নিশ্চিত করুন')
  await expect.element(page.getByRole('dialog', { name: 'অর্ডার নিশ্চিত করুন' })).toBeVisible()
})

test('ebdfy.modal is still a function, which asks the Admin for its modal', () => {
  expect(typeof ebdfy.modal).toBe('function')
})

test('an open modal taken off the page closes, and the page hears it close', async () => {
  const holder = mount(confirm())
  const heard: string[] = []
  const hear = () => heard.push('e-modal-close')
  window.addEventListener('e-modal-close', hear)
  ebdfy.modal.show('confirm')
  const shown = dialog()
  holder.querySelector('e-modal')!.remove()
  expect(shown.open).toBe(false)
  await expect.poll(() => heard).toEqual(['e-modal-close'])
  window.removeEventListener('e-modal-close', hear)
})
