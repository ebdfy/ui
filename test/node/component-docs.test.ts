import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import type { Locator } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

// Every page in site/ui/components.
const names = readdirSync(fileURLToPath(new URL('../../site/ui/components/', import.meta.url)))
  .filter((file) => file.endsWith('.html'))
  .map((file) => file.replace(/\.html$/, ''))

async function openDocs(name: string, width: number, colorScheme: 'light' | 'dark') {
  const { page, errors } = await pages.open('', width)
  await page.emulateMedia({ colorScheme })
  await page.goto(`${pages.ui}/components/${name}`)
  // Every element upgraded and every font in, rather than a quiet network, which a busy dev server
  // can put off past the test's time. eb-column is markup the table reads, never an element itself.
  await page.waitForFunction(() => document.querySelectorAll(':not(:defined):not(eb-column)').length === 0)
  await page.evaluate(() => document.fonts.ready)
  return { page, errors }
}

for (const name of names) {
  for (const width of [360, 1280]) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${name} loads clean at ${width} px in a ${scheme} browser, with its examples rendered`, async () => {
        const { page, errors } = await openDocs(name, width, scheme)
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
        const found = await page.evaluate(() => {
          // eb-column is markup the table reads, not an element, and a row's note shows only on a
          // phone's card, so neither is held to being drawn. A closed menu's or popover's content is
          // hidden by design; its trigger and the element itself are still held to it. So are the
          // bulk bar's actions it folds into its More actions menu on a phone.
          const folded = (el: Element) => {
            const action = el.closest('eb-bulk-bar > *')
            return action !== null && getComputedStyle(action).display === 'none'
          }
          const shown = [...document.querySelectorAll('#examples *')].filter(
            (el) =>
              el.localName !== 'eb-column' &&
              !folded(el) &&
              !(el.getAttribute('card') === 'note' && el.parentElement?.localName === 'eb-row') &&
              !(
                el.parentElement?.closest('eb-menu:not([open]), eb-popover:not([open])') &&
                !el.closest('[slot="trigger"]')
              ),
          )
          const tags = new Set(shown.map((el) => el.localName))
          return [...tags]
            .filter((tag) => tag.startsWith('eb-'))
            .map((tag) => ({
              tag,
              defined: customElements.get(tag) !== undefined,
              drawn: shown
                .filter((el) => el.localName === tag)
                .every((el) => {
                  // The bulk bar's host is a zero-height marker; the bar it floats is what shows.
                  const drawn = el.localName === 'eb-bulk-bar' ? el.shadowRoot!.querySelector('[part="bar"]')! : el
                  const box = drawn.getBoundingClientRect()
                  return box.width > 0 && box.height > 0
                }),
            }))
        })
        expect(found.length).toBeGreaterThan(0)
        expect(found.filter((tag) => !tag.defined || !tag.drawn)).toEqual([])
        expect(errors).toEqual([])
      })
    }
  }

  test(`${name} switches its examples to Bangla and back`, async () => {
    const { page, errors } = await openDocs(name, 360, 'light')
    const strings = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('#examples [data-en]')].map((el) => ({
          text: el.textContent,
          en: (el as HTMLElement).dataset.en,
          bn: (el as HTMLElement).dataset.bn,
        })),
      )
    await page.locator('#language eb-button', { hasText: 'বাংলা' }).click()
    expect(await page.locator('#examples').getAttribute('lang')).toBe('bn')
    const bangla = await strings()
    expect(bangla.length).toBeGreaterThan(0)
    expect(bangla.filter((s) => s.text !== s.bn)).toEqual([])
    expect(bangla.some((s) => s.bn !== s.en)).toBe(true)

    await page.locator('#language eb-button', { hasText: 'English' }).click()
    expect(await page.locator('#examples').getAttribute('lang')).toBe('en')
    expect((await strings()).filter((s) => s.text !== s.en)).toEqual([])
    expect(errors).toEqual([])
  })
}

for (const [scheme, surface] of [
  ['light', 'oklch(1 0 0)'],
  ['dark', 'oklch(0.215 0.004 85)'],
] as const) {
  test(`a card in the examples computes the ${scheme} surface in a ${scheme} browser`, async () => {
    const { page } = await openDocs('card', 1280, scheme)
    const background = await page
      .locator('#examples eb-card')
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(background).toBe(surface)
  })
}

test('the Button page shows four variants and three sizes', async () => {
  const { page } = await openDocs('button', 1280, 'light')
  const attributes = (name: string) =>
    page.locator('#examples eb-button').evaluateAll((els, attr) => els.map((el) => el.getAttribute(attr)), name)
  const variants = await attributes('variant')
  for (const variant of ['primary', 'secondary', 'ghost', 'danger']) expect(variants).toContain(variant)
  const sizes = await attributes('size')
  for (const size of ['sm', 'md', 'lg']) expect(sizes).toContain(size)
})

test('the Badge page shows the five order statuses in both languages', async () => {
  const { page } = await openDocs('badge', 360, 'light')
  const tones = () =>
    page.locator('#examples eb-badge').evaluateAll((els) => els.map((el) => [el.getAttribute('tone'), el.textContent]))
  const english = [
    ['attention', 'New'],
    ['critical', 'Returned'],
    ['info', 'Confirmed'],
    ['shipped', 'Shipped'],
    ['success', 'Paid'],
  ]
  expect(await tones()).toEqual(english)
  await page.locator('#language eb-button', { hasText: 'বাংলা' }).click()
  expect(await tones()).toEqual([
    ['attention', 'নতুন'],
    ['critical', 'ফেরত এসেছে'],
    ['info', 'কনফার্মড'],
    ['shipped', 'পাঠানো হয়েছে'],
    ['success', 'পরিশোধিত'],
  ])
})

test('the Banner page shows an info and a danger banner, in English and Bangla', async () => {
  const { page, errors } = await openDocs('banner', 360, 'light')
  const tones = () =>
    page
      .locator('#examples eb-banner')
      .evaluateAll((els) => els.map((el) => (el as HTMLElement & { tone: string }).tone))
  expect(await tones()).toEqual(['info', 'danger'])
  await page.locator('#language eb-button', { hasText: 'বাংলা' }).click()
  const label = await page
    .locator('#examples eb-banner[tone="danger"]')
    .evaluate((el) => el.shadowRoot!.querySelector('[role="img"]')!.getAttribute('aria-label'))
  expect(label).toBe('সতর্কতা')
  expect(errors).toEqual([])
})

test('the Card page titles its example card in Bangla when the switch says so, the order number Latin', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/components/card`)
  await page.waitForFunction(() => customElements.get('eb-card') !== undefined)
  const card = page.locator('#examples eb-card[data-heading-en]')
  await page.locator('#language eb-button[data-lang="bn"]').click()
  expect(await card.evaluate((el) => (el as HTMLElement & { heading: string }).heading)).toBe('অর্ডার 1042')
  await page.locator('#language eb-button[data-lang="en"]').click()
  expect(await card.evaluate((el) => (el as HTMLElement & { heading: string }).heading)).toBe('Order 1042')
  expect(errors).toEqual([])
})

test('the Tooltip page shows its bubble on the risk flag, in English and Bangla', async () => {
  const { page, errors } = await openDocs('tooltip', 1280, 'light')
  const flag = page.locator('#examples eb-tooltip').first()
  const bubble = flag.locator('[role="tooltip"]')
  await flag.hover()
  await expect.poll(() => bubble.isVisible()).toBe(true)
  expect(await bubble.textContent()).toBe('High return risk')
  expect(await page.getByRole('img', { name: 'High return risk' }).count()).toBe(1)
  await page.mouse.move(0, 0)
  await page.locator('#language eb-button', { hasText: 'বাংলা' }).click()
  await flag.hover()
  await expect.poll(() => bubble.isVisible()).toBe(true)
  expect(await bubble.textContent()).toBe('ফেরতের ঝুঁকি বেশি')
  expect(await page.getByRole('img', { name: 'ফেরতের ঝুঁকি বেশি' }).count()).toBe(1)
  expect(errors).toEqual([])
})

test('the Bulk bar page counts the selected rows in English and Bangla', async () => {
  const { page } = await openDocs('bulk-bar', 360, 'light')
  const status = page.locator('#examples eb-bulk-bar [role="status"]')
  await expect.poll(() => status.textContent()).toBe('2 selected')
  await page.locator('#language eb-button', { hasText: 'বাংলা' }).click()
  await expect.poll(() => status.textContent()).toBe('২টি নির্বাচিত')
})

test('the Courier status page says "With courier" and, in Bangla, "কুরিয়ারে"', async () => {
  const { page } = await openDocs('courier-status', 360, 'light')
  const words = () => page.locator('#examples eb-courier-status eb-badge').allTextContents()
  expect(await words()).toContain('With courier')
  await page.locator('#language eb-button', { hasText: 'বাংলা' }).click()
  await expect.poll(words).toContain('কুরিয়ারে')
})

test('the Table page shows the open row, a selected row and the risk note, as a table at 1280 px and cards at 360', async () => {
  const wide = await openDocs('table', 1280, 'light')
  const table = wide.page.locator('#examples eb-table').first()
  await table.locator('[role="table"]').waitFor()
  expect(await table.locator('eb-row[open]').count()).toBe(1)
  expect(await table.locator('eb-row[selected]').count()).toBe(1)
  expect(await wide.page.getByRole('checkbox', { name: 'Select all', exact: true }).getAttribute('aria-checked')).toBe(
    'mixed',
  )
  expect(await wide.page.locator('#examples eb-table[density="compact"]').count()).toBe(1)
  expect(wide.errors).toEqual([])
  const narrow = await openDocs('table', 360, 'light')
  await narrow.page.locator('#language eb-button', { hasText: 'বাংলা' }).click()
  const card = narrow.page.locator('#examples eb-table').first().locator('eb-row', { hasText: '#1039' })
  await card.locator('[part="card"]').waitFor()
  expect(await card.innerText()).toContain('৫টি অর্ডারের ৩টি ফেরত এসেছে')
})

// An eb-kbd draws its keys in its shadow root, which innerText on the host does not reach.
const keyText = (kbd: Locator) => kbd.evaluate((el) => el.shadowRoot!.textContent)

// The keys of a menu item's shortcut, one chip each.
const chips = (item: Locator) =>
  item.locator('eb-kbd').evaluateAll((els) => els.map((el) => el.shadowRoot!.textContent))

test('the Menu page opens from its trigger and shows Alt Shift D on Duplicate, in English and Bangla', async () => {
  const { page, errors } = await openDocs('menu', 1280, 'light')
  const items = page.locator('#examples eb-menu eb-menu-item')
  const trigger = page.locator('#examples eb-menu eb-button[slot="trigger"]')
  await trigger.click()
  await expect.poll(() => items.first().isVisible()).toBe(true)
  expect(await chips(items.first())).toEqual(['Alt', 'Shift', 'D'])
  await page.keyboard.press('Escape')
  await page.locator('#language eb-button', { hasText: 'বাংলা' }).click()
  await trigger.click()
  await expect.poll(() => items.first().isVisible()).toBe(true)
  expect((await items.allTextContents()).map((text) => text.trim())).toEqual(['ডুপ্লিকেট', 'ইনভয়েস প্রিন্ট', 'অর্ডার বাতিল'])
  expect(await chips(items.first())).toEqual(['Alt', 'Shift', 'D'])
  expect(errors).toEqual([])
})

test('the Kbd page shows Ctrl+D for mod+d', async () => {
  const { page } = await openDocs('kbd', 1280, 'light')
  expect(await keyText(page.locator('#examples eb-kbd[shortcut="mod+d"]').first())).toBe('Ctrl+D')
})

test('the Bottom bar page sticks its bar to the bottom of the scroll box, not of the window, at 360 px', async () => {
  const { page } = await openDocs('bottom-bar', 360, 'light')
  const edges = await page.evaluate(() => {
    const bar = document.querySelector('#examples eb-bottom-bar')!.getBoundingClientRect()
    const box = document.querySelector('#examples .frame > *')!.getBoundingClientRect()
    return { bar: bar.bottom, box: box.bottom, window: window.innerHeight }
  })
  expect(edges.bar).toBeCloseTo(edges.box, 0)
  expect(edges.bar).toBeLessThan(edges.window)
})

test('the Chrome page shows a 236 px sidebar with Orders current and the app title at 1280 px', async () => {
  const { page, errors } = await openDocs('chrome', 1280, 'light')
  const sidebar = page.locator('eb-admin-chrome [part="sidebar"]')
  await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(236)
  expect(await page.locator('eb-admin-chrome > a[aria-current="page"]').textContent()).toBe('Orders')
  await expect
    .poll(() => page.locator('eb-admin-chrome [part="title"]').textContent(), { timeout: 15_000 })
    .toBe('Orders')
  expect(errors).toEqual([])
})

test('the Chrome page lays its links in one row at the foot of the chrome at 360 px', async () => {
  const { page } = await openDocs('chrome', 360, 'light')
  const boxes = await page.evaluate(() => {
    const chrome = document.querySelector('eb-admin-chrome')!.getBoundingClientRect()
    const links = [...document.querySelectorAll('eb-admin-chrome > a[slot="nav"]')].map((a) => {
      const box = a.getBoundingClientRect()
      return { top: Math.round(box.top), bottom: box.bottom }
    })
    return { chrome: chrome.bottom, links }
  })
  expect(boxes.links).toHaveLength(3)
  expect(new Set(boxes.links.map((link) => link.top)).size).toBe(1)
  for (const link of boxes.links) {
    expect(link.bottom).toBeGreaterThan(boxes.chrome - 80)
    expect(link.bottom).toBeLessThanOrEqual(boxes.chrome)
  }
})

test('the Chrome page names its links in Bangla', async () => {
  const { page } = await openDocs('chrome', 360, 'light')
  await page.locator('#language eb-button', { hasText: 'বাংলা' }).click()
  expect(await page.locator('eb-admin-chrome > a[slot="nav"]').allTextContents()).toEqual(['অর্ডার', 'পণ্য', 'কাস্টমার'])
})

test('the Modal page opens a 620 px modal from Book courier and Escape closes it', async () => {
  const { page, errors } = await openDocs('modal', 1280, 'light')
  const modal = page.locator('eb-admin-chrome dialog[part="modal"]')
  await page.locator('eb-admin-chrome [part="title-action"]', { hasText: 'Book courier' }).click({ timeout: 15_000 })
  await expect.poll(() => modal.isVisible()).toBe(true)
  expect((await modal.boundingBox())?.width).toBe(620)
  await page.keyboard.press('Escape')
  await expect.poll(() => modal.isVisible()).toBe(false)
  expect(errors).toEqual([])
})

test('the Toast page shows "Copied to a new draft" with an Undo action after More, Duplicate', async () => {
  const { page, errors } = await openDocs('toast', 1280, 'light')
  await page.locator('eb-admin-chrome [part="title-action"]', { hasText: 'More' }).click({ timeout: 15_000 })
  await page.getByRole('menuitem', { name: 'Duplicate' }).click()
  await expect
    .poll(() => page.locator('eb-admin-chrome [part="toast"] span').textContent())
    .toBe('Copied to a new draft')
  expect(await page.locator('eb-admin-chrome [part="toast-action"]').textContent()).toBe('Undo')
  expect(errors).toEqual([])
})

// The docs' own link style is for prose; a link slotted into the chrome wears the chrome's look.
test("the Chrome page's slotted nav links keep the chrome's look, not the docs' underlined links", async () => {
  const { page } = await openDocs('chrome', 1280, 'light')
  const look = (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((el) => {
        const style = getComputedStyle(el)
        return { line: style.textDecorationLine, colour: style.color }
      })
  expect(await look('eb-admin-chrome:defined > a[href="#examples"]:not([aria-current])')).toEqual({
    line: 'none',
    colour: 'oklch(0.47 0.008 85)',
  })
  // The sample app shows its Orders page, which its own entry marks current, so the Admin's entry
  // for it draws as the others do.
  expect(await look('eb-admin-chrome:defined > a[aria-current="page"]')).toEqual({
    line: 'none',
    colour: 'oklch(0.47 0.008 85)',
  })
})

test('on the Button page a held-down button fills a step deeper, in light and dark', async () => {
  for (const [scheme, rest, held] of [
    ['light', 'oklch(0.21 0.006 85)', 'oklch(0.15 0.005 85)'],
    ['dark', 'oklch(0.955 0.003 85)', 'oklch(0.8 0.003 85)'],
  ] as const) {
    const { page } = await openDocs('button', 1280, scheme)
    const inner = page.locator('#examples eb-button[variant="primary"]').first().locator('button')
    const fill = () => inner.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(await fill(), scheme).toBe(rest)
    await inner.hover()
    await page.mouse.down()
    expect(await fill(), scheme).toBe(held)
    await page.mouse.up()
  }
})

test('the Thumbnail and Avatar pages show their sample photos, loaded', async () => {
  for (const [name, tag, count] of [
    ['thumbnail', 'eb-thumbnail', 3],
    ['avatar', 'eb-avatar', 2],
  ] as const) {
    const { page } = await openDocs(name, 1280, 'light')
    const photos = page.locator(`#examples ${tag}[src^="/samples/"]`)
    expect(await photos.count(), name).toBe(count)
    for (const img of await photos.locator('img').all()) {
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)
    }
  }
})
