// e-print-sheet: an order on one A5 page, printed from its docs page the way a person does, by an
// example's Print, and read back from the PDF Chromium makes at the page's own size.
import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'
import { printedPages } from './pdf.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

// A5 in points: 148 by 210 mm.
const a5 = { width: 419.5, height: 595.3 }

async function sheetsPage(width = 1440) {
  const { page, errors } = await pages.open(`${pages.ui}/components/print-sheet`, width)
  // The browser's print dialog would wait for a person; the PDF below is what it would print.
  await page.evaluate(() => {
    window.print = () => {}
  })
  return { page, errors }
}

async function printExample(page: Page, index: number) {
  await page.locator('.example').nth(index).locator('button.print').click()
  return printedPages(await page.pdf({ preferCSSPageSize: true }))
}

const sizeOf = ({ width, height }: { width: number; height: number }) => ({
  width: Math.round(width),
  height: Math.round(height),
})

test("the #1042 example's Print makes one A5 page", async () => {
  const { page, errors } = await sheetsPage()
  const printed = await printExample(page, 0)
  expect(printed.map(sizeOf)).toEqual([sizeOf(a5)])
  expect(errors).toEqual([])
})

test('a page with no sheet, such as Button, prints at the browser’s own paper size', async () => {
  const { page } = await pages.open(`${pages.ui}/components/button`, 1440)
  const printed = printedPages(await page.pdf({ preferCSSPageSize: true }))
  expect(printed.length).toBeGreaterThan(0)
  expect(new Set(printed.map(({ width, height }) => `${width} x ${height}`))).toEqual(new Set(['612 x 792']))
})

test('the two-order example prints two A5 pages, each starting 10 mm or more below the top', async () => {
  const { page } = await sheetsPage()
  const printed = await printExample(page, 2)
  expect(printed.map(sizeOf)).toEqual([sizeOf(a5), sizeOf(a5)])
  for (const { textTop } of printed) expect(textTop).toBeGreaterThanOrEqual(10)
})

// The #1042 sheet with 30 lines in both its tables.
async function longOrder(page: Page) {
  await page
    .locator('.example')
    .first()
    .evaluate((example) => {
      for (const table of example.querySelectorAll('e-print-sheet table')) {
        const first = table.querySelector('tbody > tr')!
        for (let n = 3; n <= 30; n++) {
          const line = first.cloneNode(true) as HTMLElement
          line.querySelectorAll('td')[table.querySelector('[slot="tick"]') ? 1 : 0]!.textContent =
            `Line ${n}, Jamdani saree`
          first.parentElement!.insertBefore(line, first.nextElementSibling)
        }
      }
    })
}

// 60 rows of 12 px type, 30 in each table, fill three A5 pages, and no page is left with nothing but
// a stray row or a blank.
test('a 30-line order prints on three A5 pages, each starting 10 mm or more below the paper’s top edge', async () => {
  const { page } = await sheetsPage()
  await longOrder(page)
  const printed = await printExample(page, 0)
  expect(printed.map(sizeOf)).toEqual([sizeOf(a5), sizeOf(a5), sizeOf(a5)])
  for (const { textTop } of printed) expect(textTop).toBeGreaterThanOrEqual(10)
})

// What the sheet's text computes to, read from every element that holds words of its own, with its
// colour and the paper's as sRGB channels, whatever space the tokens write them in.
async function printedText(page: Page, colorScheme: 'light' | 'dark' = 'light', media: 'print' | 'screen' = 'print') {
  await page.emulateMedia({ media, colorScheme })
  return page.locator('e-print-sheet').evaluateAll((sheets) => {
    const canvas = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
    const rgb = (color: string) => {
      canvas.clearRect(0, 0, 1, 1)
      canvas.fillStyle = color
      canvas.fillRect(0, 0, 1, 1)
      return Array.from(canvas.getImageData(0, 0, 1, 1).data.slice(0, 3))
    }
    return sheets.flatMap((sheet) =>
      [sheet, ...sheet.querySelectorAll('*')]
        .filter((element) => [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent?.trim()))
        .map((element) => {
          const style = getComputedStyle(element)
          return {
            text: element.textContent?.trim() ?? '',
            size: Number.parseFloat(style.fontSize),
            color: rgb(style.color),
            paper: rgb(getComputedStyle(sheet).backgroundColor),
          }
        }),
    )
  })
}

test.for(['light', 'dark'] as const)(
  'in print, %s, the recipient is larger than the shop and no text is under 12 px',
  async (scheme) => {
    const { page } = await sheetsPage()
    const text = await printedText(page, scheme)
    const size = (words: string) => text.find(({ text: shown }) => shown.startsWith(words))?.size ?? 0
    expect(size('Rahima Akter')).toBeGreaterThan(size('Demo shop'))
    expect(size('রহিমা আক্তার')).toBeGreaterThan(size('ডেমো শপ'))
    expect(text.length).toBeGreaterThan(40)
    expect(text.filter(({ size: px }) => px < 12)).toEqual([])
  },
)

// WCAG's contrast of two sRGB colours.
const contrast = (one: number[], two: number[]) => {
  const light = (rgb: number[]) =>
    rgb
      .map((channel) => channel / 255)
      .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i]!, 0)
  const [high = 0, low = 0] = [light(one), light(two)].sort((a, b) => b - a)
  return (high + 0.05) / (low + 0.05)
}

test.for(['screen', 'print'] as const)(
  'in a dark theme, on %s, the sheet is dark text on white paper',
  async (media) => {
    const { page } = await sheetsPage()
    await page.locator('html').evaluate((html) => html.setAttribute('data-theme', 'dark'))
    const text = await printedText(page, 'dark', media)
    expect(text.length).toBeGreaterThan(40)
    expect(new Set(text.map(({ paper }) => paper.join(', ')))).toEqual(new Set(['255, 255, 255']))
    expect(text.filter(({ color, paper }) => contrast(color, paper) < 7)).toEqual([])
  },
)

// The name is 40 characters, and the recipient's column is tried at every width from a phone's to a
// printed sheet's, so the phone meets the end of a line somewhere along the way.
test('the phone stays on one line beside a 40-character name, at every column width, on screen and in print', async () => {
  const { page } = await sheetsPage()
  const name = 'Mohammad Abdur Rahman Chowdhury Talukder'
  expect(name.length).toBe(40)
  const recipient = page.locator('.example').first().locator('[slot="recipient"]')
  await recipient.evaluate((line, written) => {
    line.firstChild!.textContent = `${written} · `
  }, name)
  const split = () =>
    recipient.evaluate((line) => {
      const column = line.parentElement!
      const phone = line.querySelector('[slot="phone"]')!
      const widths: number[] = []
      for (let width = 120; width <= 484; width += 2) {
        column.style.inlineSize = `${width}px`
        if (phone.getClientRects().length > 1) widths.push(width)
      }
      column.style.inlineSize = ''
      return widths
    })
  expect(await split()).toEqual([])
  await page.emulateMedia({ media: 'print' })
  expect(await split()).toEqual([])
})

test('in Bangla the labels are Bangla, the order number stays #1042 and amounts are in Bangla digits', async () => {
  const { page } = await sheetsPage()
  const sheet = page.locator('.example[lang="bn"] e-print-sheet')
  expect(await sheet.locator('h2').textContent()).toBe('ইনভয়েস #1042')
  expect(await sheet.locator('h3').first().textContent()).toBe('প্রাপক')
  expect(await sheet.locator('[slot="due"] > b').textContent()).toBe('৳১,৯৩০')
})

test('printed in the Admin, a sheet shows with no frame, menu, save bar or toast', async () => {
  const { page } = await pages.open(`${pages.ui}/playground/settings/store`, 1440)
  await page.locator('e-phone-field input').fill('01819556690')
  await expect.poll(() => page.locator('e-admin-frame > .e-save-bar').isVisible()).toBe(true)
  // A sheet the panel holds, beside a toast, as an app or the Admin might print one.
  await page.evaluate(() => {
    const panel = document.querySelector('e-admin-panel')!
    const toast = document.createElement('div')
    toast.className = 'e-toast'
    toast.textContent = 'Store saved'
    const sheet = document.createElement('e-print-sheet')
    sheet.innerHTML = '<h2>Invoice #1042</h2>'
    panel.append(toast, sheet)
  })
  await page.emulateMedia({ media: 'print' })
  // The save bar fades out over 200 ms on screen; print draws no transition.
  const shown = () =>
    page.evaluate(() =>
      [...document.body.querySelectorAll('*')]
        .filter((element) => element.getClientRects().length > 0 && !element.closest('e-print-sheet'))
        .map((element) => `${element.localName}.${element.className}`),
    )
  await expect.poll(shown).toEqual([])
  expect(await page.locator('e-print-sheet h2').isVisible()).toBe(true)
  const printed = printedPages(await page.pdf({ preferCSSPageSize: true }))
  expect(printed.map(sizeOf)).toEqual([sizeOf(a5)])
})

// Each cell's words, as drawn: the boxes of its text, so two figures side by side can be told apart.
test.for([360, 1440])(
  'at %i px, on screen and in print, no two cells of a row draw their words touching',
  async (width) => {
    const { page } = await sheetsPage(width)
    const touching = () =>
      page.locator('e-print-sheet tr').evaluateAll((rows) =>
        rows.flatMap((row) => {
          const spans = [...row.children].flatMap((cell) => {
            const range = document.createRange()
            range.selectNodeContents(cell)
            const boxes = [...range.getClientRects()].filter((box) => box.width > 0)
            if (!boxes.length) return []
            return [
              { left: Math.min(...boxes.map((box) => box.left)), right: Math.max(...boxes.map((box) => box.right)) },
            ]
          })
          return spans
            .slice(1)
            .flatMap((span, i) =>
              span.left - spans[i]!.right < 6 ? [`${row.textContent?.replaceAll(/\s+/g, ' ').trim()}`] : [],
            )
        }),
      )
    expect(await touching()).toEqual([])
    await page.emulateMedia({ media: 'print' })
    expect(await touching()).toEqual([])
  },
)

// Ctrl+P on the docs page itself: its four sheets sit in three examples, each sheet on a page of its own.
// Each is cut to its title first, so sheets that ran on from one page to the next would share one.
test('printing the whole docs page puts each of its four sheets, however short, on an A5 page of its own', async () => {
  const { page } = await sheetsPage()
  await page.locator('e-print-sheet').evaluateAll((sheets) => {
    for (const sheet of sheets) sheet.replaceChildren(sheet.querySelector('h2')!)
  })
  const printed = printedPages(await page.pdf({ preferCSSPageSize: true }))
  expect(printed.map(sizeOf)).toEqual([sizeOf(a5), sizeOf(a5), sizeOf(a5), sizeOf(a5)])
})

// With the browser's background graphics on, the margin and the space under a sheet are paper too.
test('in a dark theme the printed page around the sheet is white paper', async () => {
  const { page } = await sheetsPage()
  await page.locator('html').evaluate((html) => html.setAttribute('data-theme', 'dark'))
  await page.emulateMedia({ media: 'print', colorScheme: 'dark' })
  const grounds = await page.evaluate(() => {
    const canvas = document.createElement('canvas').getContext('2d')!
    const rgb = (color: string) => {
      canvas.clearRect(0, 0, 1, 1)
      canvas.fillStyle = color
      canvas.fillRect(0, 0, 1, 1)
      return Array.from(canvas.getImageData(0, 0, 1, 1).data.slice(0, 3)).join(', ')
    }
    return [document.documentElement, document.body].map((element) => rgb(getComputedStyle(element).backgroundColor))
  })
  expect(grounds).toEqual(['255, 255, 255', '255, 255, 255'])
})
