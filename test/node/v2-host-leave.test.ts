// Leaving a page whose form holds an edit asks first: a link in the frame stops and the leave dialog
// opens; Back and Forward come back to the page and ask; a reload gets the browser's own prompt.
import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

async function open(path = '/playground/settings/store', width = 1440) {
  const opened = await pages.open('', width, { viewport: { width, height: 900 } })
  await opened.page.context().addInitScript(() => localStorage.setItem('ebdfy-playground-lang', 'en'))
  await opened.page.goto(`${pages.ui}${path}`)
  await opened.page.locator('e-admin-panel > header h1').waitFor()
  return opened
}

const bar = (page: Page) => page.locator('e-admin-frame > .e-save-bar')
const phone = (page: Page) => page.locator('e-phone-field input')
const dialog = (page: Page) => page.locator('dialog.e-leave')
const path = (page: Page) => new URL(page.url()).pathname
const heading = (page: Page) => page.locator('e-admin-panel > header h1').textContent()
const settingsLink = (page: Page, name: string) =>
  page.locator('[slot="menu"] > a').filter({ hasText: new RegExp(`^${name}$`) })
const focusedText = (page: Page) => page.evaluate(() => document.activeElement?.textContent)

async function edit(page: Page) {
  await phone(page).waitFor()
  await phone(page).fill('01819556699')
  await expect.poll(() => bar(page).isVisible()).toBe(true)
}

test('with the Store form dirty, Orders stays put and asks "Leave without saving?" with Stay focused', async () => {
  const { page, errors } = await open('/playground/settings/store', 360)
  await edit(page)
  await page.locator('[slot="tabs"] > a').filter({ hasText: 'Orders' }).click()
  await expect.poll(() => dialog(page).isVisible()).toBe(true)
  expect(path(page)).toBe('/playground/settings/store')
  expect(await dialog(page).locator('h2').textContent()).toBe('Leave without saving?')
  expect(await dialog(page).locator('p').textContent()).toBe(
    'Your changes to Store are not saved yet. If you leave now they are lost.',
  )
  // A screen reader names the dialog by its question and reads its sentence.
  const named = page.getByRole('dialog', { name: 'Leave without saving?' })
  expect(await named.isVisible()).toBe(true)
  expect(await named.getAttribute('aria-describedby')).toBe(await dialog(page).locator('p').getAttribute('id'))
  expect(await focusedText(page)).toBe('Stay on this page')
  expect(await bar(page).evaluate((element) => element.classList.contains('e-save-bar-nudge'))).toBe(true)
  expect(errors).toEqual([])
})

test('from a dirty Store, Leave goes to Orders with no bar, and Stay keeps the typed phone', async () => {
  const { page } = await open('/playground/settings/store', 360)
  await edit(page)
  const orders = page.locator('[slot="tabs"] > a').filter({ hasText: 'Orders' })
  await orders.click()
  await expect.poll(() => dialog(page).isVisible()).toBe(true)
  await dialog(page).getByRole('button', { name: 'Stay on this page' }).click()
  await expect.poll(() => dialog(page).isVisible()).toBe(false)
  expect(await phone(page).inputValue()).toBe('01819556699')
  expect(path(page)).toBe('/playground/settings/store')
  await orders.click()
  await dialog(page).getByRole('button', { name: 'Leave' }).click()
  await expect.poll(() => path(page)).toBe('/playground/orders')
  await page.locator('e-admin-panel').waitFor()
  expect(await bar(page).isVisible()).toBe(false)
})

test('a move between Settings pages asks too, and Leave swaps in the page it pointed at', async () => {
  const { page } = await open()
  await edit(page)
  await settingsLink(page, 'Staff').click()
  await expect.poll(() => dialog(page).isVisible()).toBe(true)
  await dialog(page).getByRole('button', { name: 'Leave' }).click()
  await expect.poll(() => heading(page)).toBe('Staff')
  await expect.poll(() => bar(page).isVisible()).toBe(false)
})

test('on a dirty Store, picking Staff in the search closes it and asks; Leave shows Staff with no dialog open', async () => {
  const { page } = await open()
  await edit(page)
  await page.keyboard.press('Control+k')
  const search = page.locator('dialog.e-search')
  await search.locator('input[type="search"]').fill('staff')
  await search.getByRole('link', { name: 'Staff', exact: true }).click()
  await expect.poll(() => dialog(page).isVisible()).toBe(true)
  // The search fades out as the question opens over the page.
  await expect.poll(() => search.isVisible()).toBe(false)
  expect(await search.evaluate((modal) => (modal as HTMLDialogElement).open)).toBe(false)
  expect(await heading(page)).toBe('Store')
  await dialog(page).getByRole('button', { name: 'Leave' }).click()
  await expect.poll(() => heading(page)).toBe('Staff')
  expect(await page.evaluate(() => document.querySelectorAll('dialog[open]').length)).toBe(0)
  await expect.poll(() => bar(page).isVisible()).toBe(false)
})

test('browser Back with the form dirty asks, and the address stays on Store', async () => {
  const { page } = await open('/playground/settings/payments')
  await settingsLink(page, 'Staff').click()
  await expect.poll(() => heading(page)).toBe('Staff')
  await settingsLink(page, 'Store').click()
  await expect.poll(() => heading(page)).toBe('Store')
  await edit(page)
  const entries = await page.evaluate(() => history.length)
  await page.goBack()
  await expect.poll(() => dialog(page).isVisible()).toBe(true)
  await expect.poll(() => path(page)).toBe('/playground/settings/store')
  expect(await heading(page)).toBe('Store')
  expect(await phone(page).inputValue()).toBe('01819556699')
  // Leave goes where Back pointed; one more Back goes to the page before, with no dialog and no
  // entry added on the way.
  await dialog(page).getByRole('button', { name: 'Leave' }).click()
  await expect.poll(() => heading(page)).toBe('Staff')
  expect(path(page)).toBe('/playground/settings/staff')
  await page.goBack()
  await expect.poll(() => heading(page)).toBe('Payments')
  expect(await dialog(page).isVisible()).toBe(false)
  expect(await page.evaluate(() => history.length)).toBe(entries)
})

test('browser Forward with the form dirty asks too, and Stay keeps the page', async () => {
  const { page } = await open('/playground/settings/staff')
  await settingsLink(page, 'Store').click()
  await expect.poll(() => heading(page)).toBe('Store')
  await page.goBack()
  await expect.poll(() => heading(page)).toBe('Staff')
  await page.goForward()
  await expect.poll(() => heading(page)).toBe('Store')
  await page.goBack()
  await expect.poll(() => heading(page)).toBe('Staff')
  await settingsLink(page, 'Store').click()
  await expect.poll(() => heading(page)).toBe('Store')
  await edit(page)
  await page.goBack()
  await expect.poll(() => dialog(page).isVisible()).toBe(true)
  await dialog(page).getByRole('button', { name: 'Stay on this page' }).click()
  await expect.poll(() => path(page)).toBe('/playground/settings/store')
  expect(await phone(page).inputValue()).toBe('01819556699')
})

test('a link to a place in the page keeps the panel and the edit, with no question', async () => {
  const { page } = await open()
  await edit(page)
  await page.evaluate(() => {
    const link = Object.assign(document.createElement('a'), { href: '#contact', textContent: 'To contact' })
    document.querySelector('e-admin-panel > header')!.append(link)
  })
  await page.getByText('To contact').click()
  await expect.poll(() => new URL(page.url()).hash).toBe('#contact')
  expect(await dialog(page).isVisible()).toBe(false)
  await page.goBack()
  await expect.poll(() => new URL(page.url()).hash).toBe('')
  expect(await phone(page).inputValue()).toBe('01819556699')
  expect(await dialog(page).isVisible()).toBe(false)
})

test('a reload of a dirty page asks the browser to prompt, and of a clean page does not', async () => {
  const { page } = await open()
  const prompts = () =>
    page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    })
  expect(await prompts()).toBe(false)
  await edit(page)
  expect(await prompts()).toBe(true)
})

// A promise the test lets go of when it says.
function gate() {
  const opener: { release?: () => void } = {}
  const shut = new Promise<undefined>((resolve) => {
    opener.release = () => resolve(undefined)
  })
  return { shut, release: () => opener.release?.() }
}

// A move whose page is held back, and let go when the test says.
async function holdStaff(page: Page) {
  const { shut: held, release } = gate()
  let asked = false
  await page.route(/\/playground\/settings\/staff$/, async (route) => {
    asked = true
    await held
    await route.continue()
  })
  return { release, asked: () => asked }
}

test('a phone typed on Store while a move to Staff waits asks when Staff arrives, and Stay keeps it', async () => {
  const { page } = await open()
  await phone(page).waitFor()
  const staff = await holdStaff(page)
  await settingsLink(page, 'Staff').click()
  await expect.poll(staff.asked).toBe(true)
  await edit(page)
  staff.release()
  await expect.poll(() => dialog(page).isVisible()).toBe(true)
  expect(await heading(page)).toBe('Store')
  await dialog(page).getByRole('button', { name: 'Stay on this page' }).click()
  await expect.poll(() => dialog(page).isVisible()).toBe(false)
  expect(await heading(page)).toBe('Store')
  expect(path(page)).toBe('/playground/settings/store')
  expect(await phone(page).inputValue()).toBe('01819556699')
})

test('a phone typed while Back to Staff waits asks when Staff arrives, and Stay puts the address back on Store', async () => {
  const { page } = await open('/playground/settings/staff')
  await settingsLink(page, 'Store').click()
  await expect.poll(() => heading(page)).toBe('Store')
  await phone(page).waitFor()
  const staff = await holdStaff(page)
  await page.goBack()
  await expect.poll(staff.asked).toBe(true)
  await edit(page)
  staff.release()
  await expect.poll(() => dialog(page).isVisible()).toBe(true)
  await dialog(page).getByRole('button', { name: 'Stay on this page' }).click()
  await expect.poll(() => path(page)).toBe('/playground/settings/store')
  expect(await heading(page)).toBe('Store')
  expect(await phone(page).inputValue()).toBe('01819556699')
  // Back once more asks, as from any dirty page, and Leave goes to Staff.
  await page.goBack()
  await expect.poll(() => dialog(page).isVisible()).toBe(true)
  await dialog(page).getByRole('button', { name: 'Leave' }).click()
  await expect.poll(() => heading(page)).toBe('Staff')
})

test('pressing Ctrl+S while a move to Staff waits: the refusal stays on Store, and Staff arrives with no Not saved', async () => {
  const { page } = await open()
  await phone(page).waitFor()
  // A form the browser does not check, so only the Admin can refuse it.
  await page.evaluate(() =>
    document.querySelector<HTMLFormElement>('form[data-save-bar]')!.setAttribute('novalidate', ''),
  )
  const staff = await holdStaff(page)
  await settingsLink(page, 'Staff').click()
  await expect.poll(staff.asked).toBe(true)
  await phone(page).fill('0181955669')
  await page.keyboard.press('Control+s')
  const said = () => bar(page).locator('.e-save-bar-message > span:visible').textContent()
  await expect.poll(said).toBe('Not saved: 1 field needs a fix')
  staff.release()
  await expect.poll(() => dialog(page).isVisible()).toBe(true)
  await dialog(page).getByRole('button', { name: 'Stay on this page' }).click()
  expect(await heading(page)).toBe('Store')
  expect(await said()).toBe('Not saved: 1 field needs a fix')
  expect(await page.locator('e-phone-field').getAttribute('error')).toBe(
    'Enter an 11-digit mobile number that starts with 01.',
  )
  await settingsLink(page, 'Staff').click()
  await dialog(page).getByRole('button', { name: 'Leave' }).click()
  await expect.poll(() => heading(page)).toBe('Staff')
  await expect.poll(() => bar(page).isVisible()).toBe(false)
})

test('pressing Ctrl+S while a move waits, its refusal coming after Leave: Staff shows no Not saved', async () => {
  const { page } = await open()
  await phone(page).waitFor()
  await page.evaluate(() =>
    document.querySelector<HTMLFormElement>('form[data-save-bar]')!.setAttribute('novalidate', ''),
  )
  const staff = await holdStaff(page)
  const { shut: held, release: answer } = gate()
  await page.route(/\/playground\/settings\/store$/, async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    await held
    await route.continue()
  })
  await settingsLink(page, 'Staff').click()
  await expect.poll(staff.asked).toBe(true)
  await phone(page).fill('0181955669')
  await page.keyboard.press('Control+s')
  staff.release()
  await expect.poll(() => dialog(page).isVisible()).toBe(true)
  await dialog(page).getByRole('button', { name: 'Leave' }).click()
  await expect.poll(() => heading(page)).toBe('Staff')
  answer()
  await page.waitForTimeout(500)
  expect(await bar(page).isVisible()).toBe(false)
  expect(await heading(page)).toBe('Staff')
})

// A link to a place in a page adds an entry of its own; Back onto it from a dirty page asks, as Back
// onto any other page's entry does.
test('browser Back onto an entry a link to a place on Staff made asks on a dirty Store, and Stay keeps the phone', async () => {
  const { page } = await open('/playground/settings/staff')
  await page.evaluate(() => {
    const link = Object.assign(document.createElement('a'), { href: '#team', textContent: 'To the team' })
    document.querySelector('e-admin-panel > header')!.append(link)
  })
  await page.getByText('To the team').click()
  await expect.poll(() => new URL(page.url()).hash).toBe('#team')
  await settingsLink(page, 'Store').click()
  await expect.poll(() => heading(page)).toBe('Store')
  await edit(page)
  await page.goBack()
  await expect.poll(() => dialog(page).isVisible()).toBe(true)
  await expect.poll(() => path(page)).toBe('/playground/settings/store')
  await dialog(page).getByRole('button', { name: 'Stay on this page' }).click()
  expect(await heading(page)).toBe('Store')
  expect(await phone(page).inputValue()).toBe('01819556699')
  // Leave on a second Back goes to Staff at its place, and Forward returns to Store with no reload.
  await page.evaluate(() => Object.assign(globalThis, { stayed: true }))
  await page.goBack()
  await expect.poll(() => dialog(page).isVisible()).toBe(true)
  await dialog(page).getByRole('button', { name: 'Leave' }).click()
  await expect.poll(() => heading(page)).toBe('Staff')
  expect(new URL(page.url()).hash).toBe('#team')
  await page.goForward()
  await expect.poll(() => heading(page)).toBe('Store')
  expect(await page.evaluate(() => (globalThis as { stayed?: boolean }).stayed)).toBe(true)
})

// Two Backs whose pages are both held: the first move is overtaken, and the second arrives after a
// phone was typed. Stay must put the address back on Store, two entries on, with no reload.
test('two Backs held while a phone is typed: Stay returns the address to Store with no reload', async () => {
  const { page } = await open('/playground/settings/payments')
  await settingsLink(page, 'Staff').click()
  await expect.poll(() => heading(page)).toBe('Staff')
  await settingsLink(page, 'Store').click()
  await expect.poll(() => heading(page)).toBe('Store')
  await phone(page).waitFor()
  await page.evaluate(() => Object.assign(globalThis, { stayed: true }))
  const { shut, release } = gate()
  const asked: string[] = []
  await page.route(/\/playground\/settings\/(staff|payments)$/, async (route) => {
    asked.push(new URL(route.request().url()).pathname)
    await shut
    await route.continue()
  })
  await page.goBack()
  await expect.poll(() => asked.length).toBe(1)
  await page.goBack()
  await expect.poll(() => asked.length).toBe(2)
  await edit(page)
  release()
  await expect.poll(() => dialog(page).isVisible()).toBe(true)
  await dialog(page).getByRole('button', { name: 'Stay on this page' }).click()
  await expect.poll(() => path(page)).toBe('/playground/settings/store')
  await page.waitForTimeout(300)
  expect(path(page)).toBe('/playground/settings/store')
  expect(await dialog(page).isVisible()).toBe(false)
  expect(await heading(page)).toBe('Store')
  expect(await phone(page).inputValue()).toBe('01819556699')
  expect(await page.evaluate(() => (globalThis as { stayed?: boolean }).stayed)).toBe(true)
})

test('a Back overtaken by a tap on the menu, a phone typed meanwhile: Stay returns the address to Store', async () => {
  const { page } = await open('/playground/settings/payments')
  await settingsLink(page, 'Staff').click()
  await expect.poll(() => heading(page)).toBe('Staff')
  await settingsLink(page, 'Store').click()
  await expect.poll(() => heading(page)).toBe('Store')
  await phone(page).waitFor()
  const { shut, release } = gate()
  const asked: string[] = []
  await page.route(/\/playground\/settings\/(staff|delivery)$/, async (route) => {
    asked.push(new URL(route.request().url()).pathname)
    await shut
    await route.continue()
  })
  await page.goBack()
  await expect.poll(() => asked.length).toBe(1)
  await settingsLink(page, 'Delivery').click()
  await expect.poll(() => asked.length).toBe(2)
  await edit(page)
  release()
  await expect.poll(() => dialog(page).isVisible()).toBe(true)
  await dialog(page).getByRole('button', { name: 'Stay on this page' }).click()
  await expect.poll(() => path(page)).toBe('/playground/settings/store')
  expect(await heading(page)).toBe('Store')
  expect(await phone(page).inputValue()).toBe('01819556699')
  // Back from here asks, and Leave lands on Staff, the entry before Store.
  await page.goBack()
  await expect.poll(() => dialog(page).isVisible()).toBe(true)
  await dialog(page).getByRole('button', { name: 'Leave' }).click()
  await expect.poll(() => heading(page)).toBe('Staff')
  expect(path(page)).toBe('/playground/settings/staff')
})
