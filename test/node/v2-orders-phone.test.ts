// The sample orders list on a phone, in the v2 playground's Admin frame: flat rows with no checkbox
// until Select, select mode with a select-all and a count, Done that clears it, search and Add filter
// on one line, and every link and button a 44 px target, in English and Bangla.
import type { FrameLocator } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const words = {
  en: {
    select: 'Select',
    all: 'Select all',
    done: 'Done',
    one: 'Select #1042',
    two: 'Select #1041',
    count: '2 selected',
    labels: 'Print labels',
  },
  bn: {
    select: 'নির্বাচন করুন',
    all: 'সব নির্বাচন করুন',
    done: 'শেষ',
    one: 'অর্ডার #1042 নির্বাচন করুন',
    two: 'অর্ডার #1041 নির্বাচন করুন',
    count: '২টি নির্বাচিত',
    labels: 'লেবেল প্রিন্ট করুন',
  },
}

async function open(lang: 'en' | 'bn') {
  const opened = await pages.open('', 360, { viewport: { width: 360, height: 780 } })
  await opened.page.context().addInitScript((chosen) => {
    localStorage.setItem('ebdfy-sample-lang', chosen)
    localStorage.setItem('ebdfy-playground-lang', chosen)
  }, lang)
  await opened.page.goto(`${pages.ui}/playground`)
  const app = opened.page.frameLocator('e-admin-panel iframe')
  await app.locator('e-index-table > e-button[data-select] > button').waitFor({ state: 'attached', timeout: 15_000 })
  await app.locator('body').evaluate(() => document.fonts.ready)
  return { ...opened, app }
}

const rowBoxes = (app: FrameLocator) =>
  app
    .locator('e-table > e-row:not([head]) e-checkbox')
    .evaluateAll((all) =>
      all.map((box) => ({ shown: box.checkVisibility(), checked: box.querySelector('input')!.checked })),
    )

test.for(['en', 'bn'] as const)(
  'in %s at 360 px the list shows no checkbox, and row 1 reads #1042 and ৳1,930',
  async (lang) => {
    const { app, errors } = await open(lang)
    const boxes = await rowBoxes(app)
    expect(boxes.length).toBe(10)
    expect(boxes.filter((box) => box.shown)).toEqual([])
    const line = await app
      .locator('e-table > e-row:not([head])')
      .first()
      .evaluate((row) => {
        const at = (card: string) => row.querySelector(`[card="${card}"]`)!
        const box = (card: string) => at(card).getBoundingClientRect()
        return {
          title: at('title').textContent!.trim(),
          end: at('end').textContent!.trim(),
          same: Math.abs(box('title').top - box('end').top) <= 1,
          first: box('title').top < box('body').top,
        }
      })
    // The page's amounts are Bangla digits in Bangla.
    expect(line).toEqual({ title: '#1042', end: lang === 'bn' ? '৳১,৯৩০' : '৳1,930', same: true, first: true })
    expect(errors).toEqual([])
  },
)

test.for(['en', 'bn'] as const)(
  'in %s at 360 px Select shows every checkbox and a select-all, two ticked read the count, and Done clears them',
  async (lang) => {
    const { app, errors } = await open(lang)
    const t = words[lang]
    await app.getByRole('button', { name: t.select, exact: true }).click()
    // The bulk actions show before any order is ticked; with none they do nothing.
    await app.getByRole('button', { name: t.labels }).click()
    expect(errors).toEqual([])
    expect((await rowBoxes(app)).map((box) => box.shown)).toEqual(Array(10).fill(true))
    expect(await app.getByRole('checkbox', { name: t.all, exact: true }).isVisible()).toBe(true)
    await app.getByRole('checkbox', { name: t.one }).click()
    await app.getByRole('checkbox', { name: t.two }).click()
    await expect.poll(() => app.getByRole('status').textContent()).toBe(t.count)
    await app.getByRole('button', { name: t.done }).click()
    // Read after the move: every row's box unticked and hidden, and none still marked selected.
    expect(await rowBoxes(app)).toEqual(Array(10).fill({ shown: false, checked: false }))
    expect(await app.locator('e-row[selected]').count()).toBe(0)
    expect(await app.getByRole('searchbox').isVisible()).toBe(true)
  },
)

test.for(['en', 'bn'] as const)(
  'in %s at 360 px search and Add filter share a line, and every link and button in the list is 44 px tall',
  async (lang) => {
    const { app } = await open(lang)
    const found = await app.locator('e-index-table').evaluate((index) => {
      const middle = (element: Element) => {
        const { top, height } = element.getBoundingClientRect()
        return top + height / 2
      }
      const search = index.querySelector(':scope > e-search-field')!
      const add = index.querySelector(':scope > e-button:not([data-select])')!
      return {
        line: Math.abs(middle(search) - middle(add)) <= 1,
        beside: add.getBoundingClientRect().left > search.getBoundingClientRect().right,
      }
    })
    expect(found).toEqual({ line: true, beside: true })
    // Every target shown, before Select and in select mode, which brings the checkboxes, select-all,
    // the bulk actions and Done.
    const short = () =>
      app.locator('e-index-table').evaluate((index) => {
        // A row's link covers its row, so the row is its target; an e-button's tag, whose border holds
        // the native button, is the kit's button.
        const target = (element: Element) => element.closest('e-row') ?? element.closest('e-button') ?? element
        return [...index.querySelectorAll('a, button, [role="tab"], e-checkbox')]
          .filter((element) => element.checkVisibility())
          .map((element) => ({ element, height: target(element).getBoundingClientRect().height }))
          .filter(({ height }) => height < 44)
          .map(
            ({ element, height }) =>
              `${element.localName} ${element.textContent!.trim() || element.getAttribute('aria-label') || element.getAttribute('label')}: ${height}`,
          )
      })
    expect(await short()).toEqual([])
    await app.getByRole('button', { name: words[lang].select, exact: true }).click()
    expect(await app.getByRole('button', { name: words[lang].done }).isVisible()).toBe(true)
    expect(await short()).toEqual([])
  },
)
