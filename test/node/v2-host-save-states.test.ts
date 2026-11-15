// The save bar when a save does not go through: no answer in 10 s, a conflict, an expired session,
// and how each reads on a phone in Bangla.
import type { Page, Route } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

async function open(options: { lang?: 'en' | 'bn'; width?: number; fake?: string } = {}) {
  const { lang = 'en', width = 1440, fake } = options
  const opened = await pages.open('', width, { viewport: { width, height: 800 } })
  const context = opened.page.context()
  await context.addInitScript((chosen) => localStorage.setItem('ebdfy-playground-lang', chosen), lang)
  if (fake) await context.addCookies([{ name: 'ebdfy-store-fake', value: fake, url: pages.ui }])
  const sent: string[] = []
  opened.page.on('request', (request) => {
    if (request.method() === 'POST') sent.push(request.postData() ?? '')
  })
  await opened.page.goto(`${pages.ui}/playground/settings/store`)
  await opened.page.locator('e-phone-field input').waitFor()
  return { ...opened, sent }
}

const bar = (page: Page) => page.locator('e-admin-frame > .e-save-bar')
const said = (page: Page) => bar(page).locator('.e-save-bar-message > span:visible').textContent()
const phone = (page: Page) => page.locator('e-phone-field input')
const primary = (page: Page) => bar(page).locator('.e-save-bar-save')
const banner = async (page: Page) => {
  const shown = page.locator('form > .e-save-banner:visible')
  return (await shown.count()) ? shown.textContent() : null
}
// Each part of a multipart body has its own boundary, so two sends compare by what they carry.
const carried = (body: string | undefined) => body?.replaceAll(/-+WebKitFormBoundary\w+/g, '--')
const clearFake = (page: Page) => page.context().clearCookies({ name: 'ebdfy-store-fake' })

test('with no answer in 10 s the bar says to check the internet, and Try again saves', async () => {
  const { page } = await open({ fake: 'hang' })
  await phone(page).fill('01819556690')
  await primary(page).click()
  await expect.poll(() => said(page)).toBe('Saving…')
  await expect.poll(() => said(page), { timeout: 15_000 }).toBe('Not saved. Check the internet, then try again.')
  expect(await primary(page).textContent()).toBe('Try again')
  expect(await phone(page).inputValue()).toBe('01819556690')
  await clearFake(page)
  await primary(page).click()
  await expect.poll(() => page.locator('e-admin-panel > .e-toast').textContent()).toBe('Store saved')
})

test('a conflict offers Reload and keeps what was typed', async () => {
  const { page } = await open({ fake: 'conflict' })
  await phone(page).fill('01819556690')
  await primary(page).click()
  await expect.poll(() => said(page)).toBe('Someone changed this since you opened it.')
  expect(await primary(page).textContent()).toBe('Reload')
  expect(await phone(page).inputValue()).toBe('01819556690')
  // Reload takes the page as it is now, with no prompt to leave.
  await clearFake(page)
  await primary(page).click()
  await page.waitForLoadState('load')
  await expect.poll(() => phone(page).inputValue()).toBe('01819556680')
})

test('an expired session raises e-session-expired on the form, and e-session-restored sends the same values once more', async () => {
  const { page, sent } = await open({ fake: 'expired' })
  await page.evaluate(() => {
    const form = document.querySelector('form[data-save-bar]')!
    form.addEventListener('e-session-expired', () => Object.assign(globalThis, { expired: true }))
  })
  await phone(page).fill('01819556690')
  await primary(page).click()
  await expect.poll(() => page.evaluate(() => (globalThis as unknown as { expired?: boolean }).expired)).toBe(true)
  expect(sent).toHaveLength(1)
  // The Admin's log-in dialog has done its work.
  await clearFake(page)
  await page.evaluate(() => document.dispatchEvent(new Event('e-session-restored')))
  await expect.poll(() => page.locator('e-admin-panel > .e-toast').textContent()).toBe('Store saved')
  expect(sent).toHaveLength(2)
  expect(carried(sent[1])).toBe(carried(sent[0]))
  expect(sent[0]).toContain('01819556690')
  // Only the one save was waiting.
  await page.evaluate(() => document.dispatchEvent(new Event('e-session-restored')))
  await page.waitForTimeout(300)
  expect(sent).toHaveLength(2)
})

// Each answer the Admin can give, made at once, so every state can be read in turn.
const answers: Record<string, (route: Route) => Promise<void>> = {
  hang: () => new Promise(() => {}),
  fields: (route) =>
    route.fulfill({
      status: 422,
      contentType: 'text/html',
      body: '<e-admin-panel><form data-save-bar><e-phone-field name="contactPhone" error="ভুল"></e-phone-field><e-text-field name="contactEmail" error="ভুল"></e-text-field></form></e-admin-panel>',
    }),
  banner: (route) =>
    route.fulfill({
      status: 422,
      contentType: 'text/html',
      body: '<e-admin-panel><form data-save-bar><div data-e-form-errors><p>স্টোরটি এখন বন্ধ আছে, তাই পরিবর্তন রাখা যায়নি।</p></div></form></e-admin-panel>',
    }),
  offline: (route) => route.abort('internetdisconnected'),
  conflict: (route) => route.fulfill({ status: 409, body: '' }),
}

// The state each answer leaves the bar in.
const states: Record<string, string> = {
  fields: 'refused',
  banner: 'refused',
  offline: 'offline',
  conflict: 'conflict',
  hang: 'saving',
}

test('at 360 px in Bangla every state fits beside × and the button, uncut, with long sentences as a banner', async () => {
  const { page } = await open({ lang: 'bn', width: 360 })
  const fits = () =>
    bar(page).evaluate((element) =>
      [...element.querySelectorAll('p, button')].every((part) => part.scrollWidth <= part.clientWidth),
    )
  let answer = ''
  await page.route('**/playground/settings/store', (route) =>
    route.request().method() === 'POST' ? answers[answer]!(route) : route.fallback(),
  )
  await page.evaluate(() => document.querySelector('form[data-save-bar]')!.setAttribute('novalidate', ''))
  await phone(page).fill('01819556690')
  expect(await said(page)).toBe('অসংরক্ষিত পরিবর্তন')
  expect(await fits()).toBe(true)
  const seen: Record<string, [string | null, string | null, string | null]> = {}
  for (const name of ['fields', 'banner', 'offline', 'conflict', 'hang']) {
    answer = name
    // A Save from the keyboard: on a conflict the bar's own button reloads.
    await phone(page).fill(`0181955669${Object.keys(seen).length}`)
    await page.keyboard.press('Control+s')
    await expect.poll(() => bar(page).getAttribute('data-state')).toBe(states[name])
    seen[name] = [await said(page), await primary(page).textContent(), await banner(page)]
    expect(await fits(), name).toBe(true)
  }
  expect(seen).toEqual({
    hang: ['সংরক্ষণ হচ্ছে…', 'সংরক্ষণ করুন', null],
    fields: ['২টি ঘর ঠিক করুন', 'সংরক্ষণ করুন', null],
    banner: ['সংরক্ষণ হয়নি', 'সংরক্ষণ করুন', null],
    offline: ['সংরক্ষণ হয়নি', 'আবার চেষ্টা করুন', 'সংরক্ষণ হয়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।'],
    conflict: ['অন্য কেউ বদলেছে', 'আবার লোড করুন', 'আপনি খোলার পর অন্য কেউ এটি বদলেছে।'],
  })
})

// Holds the Store's next save until the test lets its answer through.
async function holdSave(page: Page) {
  const gate: { open?: () => void } = {}
  const released = new Promise((done) => {
    gate.open = () => done(true)
  })
  await page.route('**/playground/settings/store', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    const answer = await route.fetch()
    await released
    return route.fulfill({ response: answer })
  })
  return () => gate.open?.()
}

test('typing while a save waits keeps the new typing, and the bar goes back to "Unsaved changes"', async () => {
  const { page } = await open()
  const release = await holdSave(page)
  await phone(page).fill('01819556690')
  await primary(page).click()
  await expect.poll(() => said(page)).toBe('Saving…')
  await phone(page).fill('01819556691')
  release()
  await expect.poll(() => page.locator('e-admin-panel > .e-toast').textContent()).toBe('Store saved')
  expect(await phone(page).inputValue()).toBe('01819556691')
  await expect.poll(() => said(page)).toBe('Unsaved changes')
  // What was saved is what Discard goes back to.
  await bar(page).getByRole('button', { name: 'Discard' }).click()
  expect(await phone(page).inputValue()).toBe('01819556690')
})

test('leaving while a save waits drops its answer, so a late refusal raises no bar on Staff', async () => {
  const { page } = await open()
  await page.evaluate(() =>
    document.querySelector<HTMLFormElement>('form[data-save-bar]')!.setAttribute('novalidate', ''),
  )
  const release = await holdSave(page)
  await phone(page).fill('0181955669')
  await primary(page).click()
  await expect.poll(() => said(page)).toBe('Saving…')
  await page
    .locator('[slot="menu"] > a')
    .filter({ hasText: /^Staff$/ })
    .click()
  await page.locator('dialog.e-leave').getByRole('button', { name: 'Leave' }).click()
  await expect.poll(() => page.locator('e-admin-panel > header h1').textContent()).toBe('Staff')
  release()
  await page.waitForTimeout(500)
  expect(await bar(page).isVisible()).toBe(false)
  expect(await page.locator('e-admin-panel > header h1').textContent()).toBe('Staff')
})
