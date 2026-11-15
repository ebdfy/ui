// Editing a customer in the v2 playground: on order #1042, Edit on the customer opens their form; a
// short phone is refused under the field, a fixed one saves with Dhaka, Mirpur and ৳80 and the toast
// "Saved", and Discard puts an edit back. Each step is driven as a person does, by role and name, in
// English at 1440 px and in Bangla at 360 px.
import type { Frame, Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const words = {
  en: {
    edit: 'Edit',
    dialog: 'Edit customer',
    phone: 'Phone',
    district: 'District',
    upazila: 'Upazila',
    dhaka: 'Dhaka',
    mirpur: 'Mirpur',
    charge: 'Delivery charge',
    name: 'Name',
    short: 'Enter an 11-digit number starting 01',
    saved: 'Saved',
    discard: 'Discard',
    save: 'Save',
    shownCharge: '80',
    cardCharge: 'Delivery charge ৳80',
    area: 'Mirpur, Dhaka',
  },
  bn: {
    edit: 'এডিট করুন',
    dialog: 'গ্রাহকের তথ্য এডিট করুন',
    phone: 'ফোন',
    district: 'জেলা',
    upazila: 'উপজেলা',
    dhaka: 'ঢাকা',
    mirpur: 'মিরপুর',
    charge: 'ডেলিভারি চার্জ',
    name: 'নাম',
    short: '01 দিয়ে শুরু ১১ অঙ্কের নম্বর লিখুন',
    saved: 'সংরক্ষিত',
    discard: 'বাতিল',
    save: 'সংরক্ষণ',
    shownCharge: '৮০',
    cardCharge: 'ডেলিভারি চার্জ ৳৮০',
    area: 'মিরপুর, ঢাকা',
  },
}

const view = (page: Page) => page.frameLocator('e-admin-panel iframe')
const appFrame = (page: Page): Frame => page.frames().find((frame) => frame.url().startsWith(`${pages.sampleApp}/`))!

// Opens #1042 in the playground in a language and width, and counts the customer form's submits.
async function open(lang: 'en' | 'bn', width: number) {
  const { page } = await pages.open('', width, { viewport: { width, height: 900 } })
  await page.context().addInitScript((chosen) => {
    localStorage.setItem('ebdfy-playground-lang', chosen)
    localStorage.setItem('ebdfy-sample-lang', chosen)
  }, lang)
  await page.goto(`${pages.ui}/playground/orders/1042`)
  await expect
    .poll(() => appFrame(page)?.evaluate(() => document.querySelector('#customer form input[name="phone"]') !== null), {
      timeout: 15_000,
    })
    .toBe(true)
  await appFrame(page).evaluate(() => {
    const form = document.querySelector('#customer form')!
    Object.assign(globalThis, { submits: 0 })
    form.addEventListener('submit', () => (globalThis as unknown as { submits: number }).submits++)
  })
  const t = words[lang]
  const dialog = view(page).getByRole('dialog', { name: t.dialog })
  const footer = () => dialog.locator('footer button:visible').allTextContents()
  const submits = () => appFrame(page).evaluate(() => (globalThis as unknown as { submits: number }).submits)
  const toast = () => page.locator('e-admin-panel').getByRole('status').textContent()
  return { page, t, dialog, footer, submits, toast }
}

test.for([
  ['en', 1440],
  ['bn', 360],
] as const)('a merchant edits the customer of #1042 in %s at %i px', async ([lang, width]) => {
  const { page, t, dialog, footer, submits, toast } = await open(lang, width)
  const card = view(page).locator('#customer-card')

  await card.getByRole('button', { name: t.edit }).click()
  await expect.poll(() => dialog.isVisible()).toBe(true)
  // The form opens with its values from the markup, so nothing reads as edited yet.
  expect(await footer()).toEqual([])

  const phone = dialog.getByRole('textbox', { name: t.phone })
  await phone.fill('0170707159')
  await expect.poll(footer).toEqual([t.discard, t.save])
  await dialog.getByRole('button', { name: t.save }).click()
  await expect.poll(() => dialog.getByText(t.short).isVisible()).toBe(true)
  expect(await phone.getAttribute('aria-invalid')).toBe('true')
  expect(await submits()).toBe(0)

  await phone.fill('01707071591')
  await expect.poll(() => dialog.getByText(t.short).count()).toBe(0)
  await dialog.getByRole('combobox', { name: t.district, exact: true }).selectOption({ label: t.dhaka })
  await expect.poll(() => dialog.getByRole('combobox', { name: t.upazila, exact: true }).isEnabled()).toBe(true)
  await dialog.getByRole('combobox', { name: t.upazila, exact: true }).selectOption({ label: t.mirpur })
  const charge = dialog.getByRole('textbox', { name: t.charge })
  await charge.fill('80')
  await charge.blur()
  expect(await charge.inputValue()).toBe(t.shownCharge)

  // A double tap on Save sends one submit.
  await dialog.getByRole('button', { name: t.save }).dblclick()
  await expect.poll(toast).toBe(t.saved)
  expect(await submits()).toBe(1)
  await expect.poll(() => card.textContent()).toContain(t.area)
  expect(await card.textContent()).toContain(t.cardCharge)
  expect(await footer()).toEqual([])

  await dialog.getByRole('textbox', { name: t.name }).fill('Someone else')
  await phone.fill('01811111111')
  await expect.poll(footer).toEqual([t.discard, t.save])
  await dialog.getByRole('button', { name: t.discard }).click()
  expect(await phone.inputValue()).toBe('01707071591')
  expect(await dialog.getByRole('combobox', { name: t.district, exact: true }).inputValue()).toBe('dhaka')
  expect(await dialog.getByRole('combobox', { name: t.upazila, exact: true }).inputValue()).toBe('mirpur')
  expect(await charge.inputValue()).toBe(t.shownCharge)
  expect(await footer()).toEqual([])
  expect(await submits()).toBe(1)
})

test('switching the Admin to Bangla before an edit opens the form in Bangla, with nothing to save', async () => {
  const { page } = await open('en', 1440)
  await page.getByRole('button', { name: 'Rafiq Ahmed' }).click()
  await page.locator('#e-user').getByRole('button', { name: 'বাংলা' }).click()
  const t = words.bn
  const card = view(page).locator('#customer-card')
  await expect.poll(() => card.textContent()).toContain('রহিমা আক্তার')
  await card.getByRole('button', { name: t.edit }).click()
  const dialog = view(page).getByRole('dialog', { name: t.dialog })
  await expect.poll(() => dialog.isVisible()).toBe(true)
  expect(await dialog.getByRole('textbox', { name: t.name }).inputValue()).toBe('রহিমা আক্তার')
  expect(await dialog.getByRole('textbox', { name: 'ঠিকানা' }).inputValue()).toBe('বাড়ি ১২, রোড ৫')
  expect(await dialog.getByRole('textbox', { name: t.charge }).inputValue()).toBe('১২০')
  expect(await dialog.locator('footer button:visible').allTextContents()).toEqual([])
})
