// Every docs page sits in one frame: a skip link, the header, a sidebar of every page in its group
// with the current one marked, and links to the component pages before and after.
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, expect, test } from 'vitest'

import { docsPages, groups, pathOf } from '../../scripts/docs.ts'
import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const ui = fileURLToPath(new URL('../../site/ui/', import.meta.url))
const files = readdirSync(ui, { recursive: true, encoding: 'utf8' }).filter((file) => file.endsWith('.html'))

test('the sidebar lists every docs page once, in the eight groups', () => {
  expect(groups.map((group) => group.name)).toEqual([
    'Foundations',
    'Actions',
    'Forms',
    'Data',
    'Feedback',
    'Overlays',
    'Layout',
    'Admin chrome',
  ])
  const listed = docsPages.map((page) => page.path)
  expect(new Set(listed).size).toBe(listed.length)
  const served = files.map(pathOf).filter((path) => path !== '/')
  expect([...listed].sort()).toEqual([...served].sort())
})

test('at 1280 px the Table page has a 240 px sidebar that stays in view, Table marked current', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/components/table`, 1280)
  const sidebar = page.getByRole('navigation', { name: 'Pages' })
  expect((await sidebar.boundingBox())?.width).toBe(240)
  const groupNames = await sidebar.locator('.group').allInnerTexts()
  expect(groupNames).toEqual(groups.map((group) => group.name))
  expect(await sidebar.locator('[aria-current="page"]').innerText()).toBe('Table')
  // Scrolled past the header, the sidebar sticks to the top of the window.
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight))
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(56)
  const box = await sidebar.boundingBox()
  expect(box?.y).toBe(0)
  await sidebar.getByRole('link', { name: 'Tabs', exact: true }).click()
  await page.waitForURL(`${pages.ui}/components/tabs`)
  expect(errors).toEqual([])
})

test('a component page links to the pages before and after it in sidebar order', async () => {
  const { page } = await pages.open(`${pages.ui}/components/table`, 1280)
  const pager = page.getByRole('navigation', { name: 'Previous and next' })
  expect(await pager.getByRole('link').allTextContents()).toEqual(['Previous Switch', 'Next List'])
  await pager.getByRole('link', { name: 'Next List' }).click()
  await page.waitForURL(`${pages.ui}/components/list`)
  expect(await page.locator('main > h1').innerText()).toBe('List')
})

for (const path of ['/', '/foundations', '/components/button']) {
  test(`on ${path} the first Tab shows "Skip to content" and Enter moves focus to the main content`, async () => {
    const { page } = await pages.open(`${pages.ui}${path}`, 1280)
    await page.waitForFunction(() => document.querySelectorAll(':not(:defined):not(eb-column)').length === 0)
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Skip to content' })
    await expect.poll(() => skip.evaluate((el) => el === document.activeElement)).toBe(true)
    expect(await skip.isVisible()).toBe(true)
    await page.keyboard.press('Enter')
    await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('content')
  })
}

test('on the Button page the Tab after the skip link lands in the page, past the sidebar', async () => {
  const { page } = await pages.open(`${pages.ui}/components/button`, 1280)
  await page.waitForFunction(() => document.querySelectorAll(':not(:defined):not(eb-column)').length === 0)
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('main')))).toBe(true)
})

test('the header names the system with its mark and v1.1.0, and links to npm and GitHub', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/components/table`, 1280)
  const header = page.locator('header.bar')
  expect(await header.getByRole('link', { name: 'ebdfy design system' }).getAttribute('href')).toBe('/')
  expect(await header.locator('.mark').isVisible()).toBe(true)
  expect(await header.locator('.version').textContent()).toBe('v1.1.0')
  expect(await header.getByRole('link', { name: 'npm' }).getAttribute('href')).toBe(
    'https://www.npmjs.com/package/@ebdfy/ui',
  )
  expect(await header.getByRole('link', { name: 'GitHub' }).getAttribute('href')).toBe('https://github.com/ebdfy/ui')
  expect(errors).toEqual([])
})

test('the header holds the theme and language as segmented controls, বাংলা before English', async () => {
  const { page } = await pages.open(`${pages.ui}/components/table`, 1280)
  const header = page.locator('header.bar')
  await page.waitForFunction(() => customElements.get('eb-button-group') !== undefined)
  const theme = header.locator('eb-button-group.theme-switch[segmented]')
  expect(await theme.locator('eb-button').allTextContents()).toEqual(['System', 'Light', 'Dark'])
  const language = header.locator('eb-button-group#language[segmented]')
  expect(await language.locator('eb-button').allTextContents()).toEqual(['বাংলা', 'English'])
  expect(await page.locator('main #language').count()).toBe(0)
  await language.locator('eb-button', { hasText: 'বাংলা' }).click()
  expect(await page.locator('#examples').getAttribute('lang')).toBe('bn')
})

test('a page with no examples has no language switch', async () => {
  const { page } = await pages.open(`${pages.ui}/foundations`, 1280)
  expect(await page.locator('#language').count()).toBe(0)
})

for (const width of [360, 1280]) {
  test(`at ${width} px a page title is 30/40 at weight 650`, async () => {
    const { page } = await pages.open(`${pages.ui}/components/table`, width)
    await page.waitForFunction(() => document.querySelectorAll(':not(:defined):not(eb-column)').length === 0)
    const title = await page.locator('main > h1').evaluate((el) => {
      const style = getComputedStyle(el)
      return `${style.fontSize}/${style.lineHeight} ${style.fontWeight}`
    })
    expect(title).toBe('30px/40px 650')
  })
}

test('below 1024 px the sidebar is a drawer behind the Pages button, which gets the focus back when it closes', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/components/table`, 360)
  await page.waitForFunction(() => document.querySelectorAll(':not(:defined):not(eb-column)').length === 0)
  expect(await page.getByRole('navigation', { name: 'Pages' }).count()).toBe(0)
  const menu = page.locator('header.bar').getByRole('button', { name: 'Pages' })
  expect(await menu.getAttribute('aria-expanded')).toBe('false')
  await menu.click()
  const drawer = page.getByRole('dialog', { name: 'Pages' })
  await expect.poll(() => drawer.isVisible()).toBe(true)
  expect(await menu.getAttribute('aria-expanded')).toBe('true')
  expect(await drawer.locator('[aria-current="page"]').textContent()).toBe('Table')
  // The focus stays inside the open drawer.
  for (let i = 0; i < 60; i++) await page.keyboard.press('Tab')
  expect(await drawer.evaluate((el) => el.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect.poll(() => drawer.isVisible()).toBe(false)
  expect(await menu.evaluate((el) => el === document.activeElement)).toBe(true)
  expect(await menu.getAttribute('aria-expanded')).toBe('false')

  await menu.click()
  await drawer.getByRole('button', { name: 'Close' }).click()
  await expect.poll(() => drawer.isVisible()).toBe(false)
  expect(await menu.evaluate((el) => el === document.activeElement)).toBe(true)

  await menu.click()
  await drawer.getByRole('link', { name: 'Tabs', exact: true }).click()
  await page.waitForURL(`${pages.ui}/components/tabs`)
  expect(errors).toEqual([])
})

test('at 1024 px and up the Pages button is gone and the sidebar shows', async () => {
  const { page } = await pages.open(`${pages.ui}/components/table`, 1024)
  expect(await page.locator('header.bar').getByRole('button', { name: 'Pages' }).isVisible()).toBe(false)
  expect(await page.getByRole('navigation', { name: 'Pages' }).isVisible()).toBe(true)
})

for (const [width, columns] of [
  [1280, 3],
  [360, 1],
] as const) {
  test(`at ${width} px the home page is a grid of tiles, ${columns} across, each with a live preview`, async () => {
    const { page, errors } = await pages.open(`${pages.ui}/`, width)
    await page.waitForFunction(() => document.querySelectorAll(':not(:defined):not(eb-column)').length === 0)
    const tiles = await page.locator('main .tile').evaluateAll((els) =>
      els.map((tile) => ({
        x: Math.round(tile.getBoundingClientRect().x),
        live: [...(tile.querySelector('.preview')?.querySelectorAll('*') ?? [])].some(
          (el) => el.localName.startsWith('eb-') || el.localName === 'svg',
        ),
        inert: tile.querySelector('.preview')?.hasAttribute('inert'),
      })),
    )
    expect(tiles.length).toBe(docsPages.filter((page) => page.path !== '/playground').length)
    expect(new Set(tiles.map((tile) => tile.x)).size).toBe(columns)
    expect(tiles.filter((tile) => !tile.live || !tile.inert)).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    expect(errors).toEqual([])
  })

  // A preview the tile squeezes to nothing, or cuts at a side or the top, looks broken on the first
  // page a developer sees. A tall example may run off the foot, as through a window.
  test(`at ${width} px each tile's preview shows its whole example, with nothing empty or cut`, async () => {
    const { page } = await pages.open(`${pages.ui}/`, width)
    await page.waitForFunction(() => document.querySelectorAll(':not(:defined):not(eb-column)').length === 0)
    const broken = await page.locator('main .tile').evaluateAll((els) =>
      els.flatMap((tile) => {
        const preview = tile.querySelector<HTMLElement>('.preview')!
        const name = tile.querySelector('h2')?.textContent?.trim()
        const empty = [...preview.querySelectorAll<HTMLElement>('*')]
          .filter((el) => el.localName.startsWith('eb-') && el.localName !== 'eb-column' && el.checkVisibility())
          .filter((el) => el.getBoundingClientRect().width < 1 || el.getBoundingClientRect().height < 1)
          .map((el) => `${name}: ${el.localName} is empty`)
        const edge = preview.getBoundingClientRect()
        const cut = [...preview.children]
          .map((el) => el.getBoundingClientRect())
          .some((box) => box.left < edge.left || box.right > edge.right || box.top < edge.top)
          ? [`${name}: the preview is cut`]
          : []
        return [...empty, ...cut]
      }),
    )
    expect(broken).toEqual([])
  })
}
