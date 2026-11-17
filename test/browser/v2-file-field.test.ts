// e-file-field: the written file input joins its form; the script shows the chosen file's name, its
// size and a CSV's row count, and refuses a file the page does not take.
import { afterEach, expect, test } from 'vitest'

import '../../src/v2.css'
import { csvRows, defineFileField } from '../../src/v2/file-field.ts'

afterEach(() => {
  document.body.replaceChildren()
  document.documentElement.lang = 'en'
})

function mount(html: string): HTMLElement {
  const holder = document.createElement('div')
  holder.innerHTML = html
  document.body.append(holder)
  defineFileField()
  return holder.querySelector('e-file-field')!
}

const products =
  '<form><e-file-field label="Products CSV" accept=".csv" max-size="5242880"><input type="file" name="file" accept=".csv" /></e-file-field></form>'

// A CSV of a header and count rows, padded to about bytes long.
function csv(count: number, bytes = 0, bom = false): string {
  const header = 'handle,title,price\n'
  const pad = Math.max(0, Math.floor((bytes - header.length) / count) - 30)
  const rows = Array.from({ length: count }, (_, at) => `panjabi-${at},"Jamdani ${'x'.repeat(pad)}",${1200 + at}\n`)
  return `${bom ? '﻿' : ''}${header}${rows.join('')}`
}

// Puts files on the input as a person's choice does, and fires its input and change.
function choose(field: Element, ...files: File[]): void {
  const input = field.querySelector('input[type="file"]') as HTMLInputElement
  const list = new DataTransfer()
  for (const file of files) list.items.add(file)
  input.files = list.files
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

const chosen = (field: Element) =>
  [...field.querySelectorAll('[data-part="chosen"] > *')].map((part) => part.textContent)

test('choosing products-eid-2026.csv reads its name, "1.2 MB" and "418 rows"', async () => {
  const field = mount(products)
  expect(field.querySelector('[data-part="chosen"]')!.textContent).toBe('No file chosen')
  const text = csv(418, 1.2 * 1024 ** 2)
  expect(text.length).toBeGreaterThan(1.15 * 1024 ** 2)
  expect(text.length).toBeLessThan(1.25 * 1024 ** 2)
  choose(field, new File([text], 'products-eid-2026.csv', { type: 'text/csv' }))
  await expect.poll(() => chosen(field)).toEqual(['products-eid-2026.csv', '1.2 MB', '418 rows'])
  expect(field.querySelector('label')!.textContent).toBe('Products CSV')
  expect(field.querySelector('input')!.labels![0]!.textContent).toBe('Products CSV')
})

test('a quoted line break is one row, and a byte order mark is no data', () => {
  expect(csvRows('a,b\n1,"two\nlines"\n3,x\n')).toBe(2)
  expect(csvRows('a,b\r\n1,"two\r\nlines"\r\n3,x')).toBe(2)
  expect(csvRows('a,b\n1,"he said ""hi""\n"\n')).toBe(1)
  expect(csvRows(csv(418, 0, true))).toBe(418)
  expect(csvRows('a,b\n\n1,2\n\n')).toBe(1)
  expect(csvRows('')).toBe(0)
})

test('the same file starting with a BOM still reads "418 rows"', async () => {
  const field = mount(products)
  choose(field, new File([csv(418, 0, true)], 'products-eid-2026.csv', { type: 'text/csv' }))
  await expect.poll(() => chosen(field).at(-1)).toBe('418 rows')
})

test('a file of 5,242,881 bytes is refused with "Pick a file of at most 5 MB" and the input emptied', async () => {
  const field = mount(products)
  choose(field, new File([new Uint8Array(5_242_881)], 'big.csv', { type: 'text/csv' }))
  expect(field.getAttribute('error')).toBe('Pick a file of at most 5 MB')
  expect(field.querySelector('[data-e-error]')!.textContent).toBe('Pick a file of at most 5 MB')
  const input = field.querySelector('input')!
  expect([input.value, input.files!.length]).toEqual(['', 0])
  expect(input.getAttribute('aria-invalid')).toBe('true')
  expect(field.querySelector('[data-part="chosen"]')!.textContent).toBe('No file chosen')
  // A file of exactly 5 MB is taken, and its choice clears the error.
  choose(field, new File([new Uint8Array(5_242_880)], 'edge.csv', { type: 'text/csv' }))
  expect(field.hasAttribute('error')).toBe(false)
  await expect.poll(() => chosen(field).slice(0, 2)).toEqual(['edge.csv', '5 MB'])
})

test('a .xlsx file under accept=".csv" is refused with "Pick a .csv file"', () => {
  const field = mount(products)
  choose(field, new File(['PK'], 'products.xlsx', { type: 'application/vnd.ms-excel' }))
  expect(field.getAttribute('error')).toBe('Pick a .csv file')
  expect(field.querySelector('input')!.files!.length).toBe(0)
})

test('in bn the count reads "৪১৮টি সারি", and the words follow a language change', async () => {
  document.documentElement.lang = 'bn'
  const field = mount(products)
  expect(field.querySelector('[data-part="choose"]')!.textContent).toBe('ফাইল বাছাই করুন')
  choose(field, new File([csv(418)], 'products-eid-2026.csv', { type: 'text/csv' }))
  await expect.poll(() => chosen(field).at(-1)).toBe('৪১৮টি সারি')
  document.documentElement.lang = 'en'
  await expect.poll(() => chosen(field).at(-1)).toBe('418 rows')
})

test('a second choice made while the first still counts wins', async () => {
  const field = mount(products)
  choose(field, new File([csv(5000, 4 * 1024 ** 2)], 'slow.csv', { type: 'text/csv' }))
  choose(field, new File([csv(3)], 'quick.csv', { type: 'text/csv' }))
  const shown = () => [chosen(field)[0], chosen(field).at(-1)]
  await expect.poll(shown).toEqual(['quick.csv', '3 rows'])
  await new Promise((done) => setTimeout(done, 300))
  expect(shown()).toEqual(['quick.csv', '3 rows'])
})

test('the chosen file posts under its name, and a file that is no CSV shows no count', async () => {
  const field = mount(products.replace(' accept=".csv"', '').replace(' accept=".csv"', ''))
  choose(field, new File(['hello'], 'note.txt', { type: 'text/plain' }))
  await expect.poll(() => chosen(field)).toEqual(['note.txt', '5 B'])
  const posted = new FormData(field.closest('form')!).get('file') as File
  expect(posted.name).toBe('note.txt')
})

test('the row is one bordered box with Choose file, 44 px tall on a phone, the input over it', () => {
  const field = mount(products)
  const row = field.querySelector<HTMLElement>('[data-part="row"]')!
  const style = getComputedStyle(row)
  expect(style.borderTopWidth).toBe('1px')
  expect(row.getBoundingClientRect().height).toBe(44)
  const input = field.querySelector('input')!.getBoundingClientRect()
  const box = row.getBoundingClientRect()
  expect([input.width, input.height]).toEqual([box.width - 2, box.height - 2])
  // The label sits above the row, outside it.
  expect(field.querySelector('label')!.getBoundingClientRect().bottom).toBeLessThanOrEqual(box.top)
})
