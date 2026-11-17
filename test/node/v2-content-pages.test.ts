// The playground's Products > Import and Content's page and menu: drawn in the panel under their own
// areas, swapped in as a full load marks them, and saved with the bar against the dev server's fake.
import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { importAnswer, menuAnswer, menuItems, pageAnswer } from '../../scripts/content-fake.ts'
import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const paths = {
  import: '/playground/products/import',
  page: '/playground/content/pages/delivery',
  menu: '/playground/content/menus/main',
}

// Every mark the menu and the tab bar carry, as [where, name, mark].
const marks = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[slot="menu"] a[aria-current], [slot="tabs"] a[aria-current]')].map((link) => [
      link.closest('[slot]')?.getAttribute('slot'),
      link.textContent,
      link.getAttribute('aria-current'),
    ]),
  )

test('each page answers whole and as its panel, with its own heading', async () => {
  for (const [path, heading] of [
    [paths.import, 'Import products'],
    [paths.page, 'Delivery'],
    [paths.menu, 'Main menu'],
  ]) {
    const whole = await fetch(`${pages.ui}${path}`)
    expect(whole.status).toBe(200)
    expect(await whole.text()).toContain(`>${heading}</h1>`)
    const panel = await (await fetch(`${pages.ui}${path}`, { headers: { 'Ebdfy-Panel': '1' } })).text()
    expect(panel.startsWith('<title>')).toBe(true)
    expect(panel).not.toContain('<e-admin-frame')
  }
})

test('a full load marks Products on Import, Content on its page, and Content with Menus on the menu', async () => {
  const { page } = await pages.open('', 1440)
  await page.goto(`${pages.ui}${paths.import}`)
  expect(await marks(page)).toEqual([
    ['menu', 'Products', 'page'],
    ['tabs', 'Products', 'page'],
  ])
  await page.goto(`${pages.ui}${paths.page}`)
  expect(await marks(page)).toEqual([
    ['menu', 'Content', 'page'],
    ['tabs', 'Content', 'page'],
  ])
  await page.goto(`${pages.ui}${paths.menu}`)
  expect(await marks(page)).toEqual([
    ['menu', 'Content', 'true'],
    ['menu', 'Menus', 'page'],
    ['tabs', 'Content', 'true'],
    ['tabs', 'Menus', 'page'],
  ])
})

for (const width of [1440, 360]) {
  test(`at ${width} px moves between Drafts, Import, Content and Menus mark what a full load of each marks`, async () => {
    const { page } = await pages.open('', width)
    const full: Record<string, unknown> = {}
    for (const path of ['/playground/orders/drafts', paths.import, paths.page, paths.menu]) {
      await page.goto(`${pages.ui}${path}`)
      full[path] = await marks(page)
    }
    await page.goto(`${pages.ui}/playground/orders/drafts`)
    const open = async (name: string) => {
      if (width > 1000) return page.locator('nav[slot="menu"] a', { hasText: name }).first().click()
      if (name === 'Products') return page.locator('nav[slot="tabs"] > a', { hasText: name }).click()
      await page.locator('nav[slot="tabs"] > button[popovertarget]').click()
      await page.locator('#e-more > a', { hasText: name }).first().click()
    }
    for (const [name, path] of [
      ['Products', paths.import],
      ['Content', paths.page],
      ['Menus', paths.menu],
      ['Products', paths.import],
      ['Drafts', '/playground/orders/drafts'],
    ] as const) {
      // Menus is under Content, so a phone reaches it from More once Content is shown.
      await open(name)
      await page.waitForURL(`**${path}`)
      await expect.poll(() => marks(page)).toEqual(full[path])
    }
  })
}

test('on Import, choosing products-eid-2026.csv reads its name, size and rows, and Import products answers "Import started"', async () => {
  const { page } = await pages.open(`${pages.ui}${paths.import}`, 1440)
  const header = 'handle,title,price\n'
  const rows = Array.from({ length: 418 }, (_, at) => `panjabi-${at},"Jamdani ${'x'.repeat(2970)}",${1200 + at}\n`)
  const buffer = Buffer.from(header + rows.join(''))
  await page.locator('e-file-field input[type="file"]').setInputFiles({
    name: 'products-eid-2026.csv',
    mimeType: 'text/csv',
    buffer,
  })
  const chosen = page.locator('e-file-field [data-part="chosen"] > *')
  await expect.poll(() => chosen.allTextContents()).toEqual(['products-eid-2026.csv', '1.2 MB', '418 rows'])
  const bar = page.locator('e-admin-frame > .e-save-bar')
  await expect.poll(() => bar.isVisible()).toBe(true)
  await bar.getByRole('button', { name: 'Import products' }).click()
  await expect.poll(() => page.locator('.e-toast').textContent()).toBe('Import started')
})

test('a file the Admin refuses shows its error under the file field, and the bar reads "1 field needs a fix"', async () => {
  const { page } = await pages.open(`${pages.ui}${paths.import}`, 1440)
  // The field's own check would refuse it first; the Admin's check is the one under test.
  await page.locator('e-file-field').evaluate((tag) => {
    tag.removeAttribute('accept')
    tag.querySelector('input')!.removeAttribute('accept')
  })
  await page.locator('e-file-field input[type="file"]').setInputFiles({
    name: 'products.xlsx',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('PK'),
  })
  const bar = page.locator('e-admin-frame > .e-save-bar')
  await bar.getByRole('button', { name: 'Import products' }).click()
  await expect
    .poll(() => bar.locator('.e-save-bar-message > span:visible').textContent())
    .toBe('Not saved: 1 field needs a fix')
  expect(await page.locator('e-file-field').getAttribute('error')).toBe('Pick a .csv file')
})

const form = (fields: Record<string, string | File>) => {
  const data = new FormData()
  for (const [name, value] of Object.entries(fields)) data.set(name, value)
  return data
}
const html = async (path: string) => (await fetch(`${pages.ui}${path}`)).text()

test('the page fake keeps the posted body as text in its text area, and refuses an empty title', async () => {
  const page = await html(paths.page)
  const saved = pageAnswer(page, form({ title: 'Delivery', body: '<p>Hi</textarea><script>x</script></p>' }))
  expect(saved.status).toBe(200)
  expect(saved.html).toContain(
    '<textarea name="body">&lt;p&gt;Hi&lt;/textarea&gt;&lt;script&gt;x&lt;/script&gt;&lt;/p&gt;</textarea>',
  )
  expect(saved.html).toMatch(/<e-admin-panel[^>]* toast="Page saved"/)
  const refused = pageAnswer(page, form({ title: ' ', body: '' }))
  expect(refused.status).toBe(422)
  expect(refused.html).toMatch(/<e-text-field[^>]*name="title"[^>]* error="Enter a title."/)
})

test('the menu fake draws the posted tree, and refuses a fourth level, a forged item or bad JSON', async () => {
  const page = await html(paths.menu)
  const items = [
    { title: 'Kids', resourceId: 'gid://ebdfy/Collection/31', items: [] },
    { title: 'Home', url: '/', items: [{ title: 'New "in"', url: 'https://rubelfashion.com/new', items: [] }] },
  ]
  const saved = menuAnswer(page, form({ title: 'Main menu', items: JSON.stringify(items) }))
  expect(saved.status).toBe(200)
  expect(saved.html).toMatch(/<e-admin-panel[^>]* toast="Menu saved"/)
  expect([...saved.html.matchAll(/<e-menu-tree-item label="([^"]*)"/g)].map((match) => match[1])).toEqual([
    'Kids',
    'Home',
    'New &quot;in&quot;',
  ])
  // Titles are the store's own words, drawn as they were sent, never translated.
  expect(saved.html).toContain('<e-menu-tree-item label="Kids" resource-id="gid://ebdfy/Collection/31">')
  expect(saved.html).not.toContain('data-bn-label="শিশুদের"')
  const deep = (depth: number): object => ({ title: `L${depth}`, url: '/', items: depth < 4 ? [deep(depth + 1)] : [] })
  expect(menuItems(JSON.stringify([deep(2)]))).not.toBeNull()
  expect(menuItems(JSON.stringify([deep(1)]))).toBeNull()
  expect(menuItems(JSON.stringify([{ title: 'Both', url: '/', resourceId: 'x', items: [] }]))).toBeNull()
  expect(menuItems(JSON.stringify([{ title: 'Script', url: 'javascript:alert(1)', items: [] }]))).toBeNull()
  expect(menuItems(JSON.stringify([{ title: 'Away', url: '//evil.example', items: [] }]))).toBeNull()
  for (const url of ['/\\evil.example', '/\\/evil.example', '/a\tb//evil', '/\t/evil.example']) {
    expect(menuItems(JSON.stringify([{ title: 'Away', url, items: [] }])), url).toBeNull()
  }
  expect(menuItems(JSON.stringify(Array.from({ length: 101 }, () => ({ title: 'A', url: '/', items: [] }))))).toBeNull()
  const refused = menuAnswer(page, form({ title: 'Main menu', items: '{' }))
  expect(refused.status).toBe(422)
  expect(refused.html).toMatch(/<e-menu-tree[^>]* error="These menu items could not be saved."/)
})

test('the import fake refuses a file that is not a .csv or is over 5 MB', async () => {
  const page = await html(paths.import)
  expect(importAnswer(page, form({ file: new File(['PK'], 'products.xlsx') })).status).toBe(422)
  expect(importAnswer(page, form({ file: new File([new Uint8Array(5_242_881)], 'big.csv') })).html).toMatch(
    /<e-file-field[^>]* error="Pick a file of at most 5 MB"/,
  )
  expect(importAnswer(page, form({ file: new File(['a\n1'], 'ok.csv') })).status).toBe(200)
})
