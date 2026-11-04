import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

test('the docs home lists the components and links to Button', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/`)
  for (const name of ['Button', 'Card', 'Page']) {
    expect(await page.getByRole('heading', { name, exact: true }).count(), name).toBe(1)
  }
  await page.locator('main').getByRole('link', { name: 'Button', exact: true }).click()
  await page.waitForURL(`${pages.ui}/components/button`)
  expect(errors).toEqual([])
})

test('the Button page shows both buttons live and switches the examples to Bangla', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/components/button`)
  const examples = page.locator('#examples')
  await page.waitForFunction(() => customElements.get('eb-button') !== undefined)
  expect(await examples.locator('eb-button[variant="primary"]').first().textContent()).toBe('Add order')
  expect(await examples.locator('eb-button[variant="secondary"]').first().textContent()).toBe('Cancel')
  expect(await examples.locator('[data-taka]').textContent()).toBe('৳1,25,000')

  await page.locator('eb-button', { hasText: 'বাংলা' }).click()
  expect(await examples.getAttribute('lang')).toBe('bn')
  expect(await examples.locator('eb-button[variant="primary"]').first().textContent()).toBe('অর্ডার যোগ করুন')
  expect(await examples.locator('[data-taka]').textContent()).toBe('৳১,২৫,০০০')
  expect(await examples.locator('[data-phone]').textContent()).toBe('01707071591')

  await page.locator('eb-button', { hasText: 'English' }).click()
  expect(await examples.getAttribute('lang')).toBe('en')
  expect(await examples.locator('eb-button[variant="primary"]').first().textContent()).toBe('Add order')
  expect(errors).toEqual([])
})

test('the Bangla specimen on Foundations shows the board strings at the body and heading sizes, never below 1.4', async () => {
  const { page } = await pages.open(`${pages.ui}/foundations`)
  const read = (selector: string) =>
    page.locator(selector).evaluateAll((els) =>
      els.map((el) => {
        const style = getComputedStyle(el)
        return [el.textContent?.trim(), style.fontSize, style.lineHeight]
      }),
    )
  const strings = ['ক্ষুদ্র ব্যবসায়ীদের স্বয়ংক্রিয় কুরিয়ার বুকিং', 'ঊর্ধ্বমুখী ঐতিহ্য, শ্রীমঙ্গলের চা, কৃষ্ণচূড়া']
  expect(await read('#type [data-specimen="body"]')).toEqual(strings.map((s) => [s, '15px', '24px']))
  expect(await read('#type [data-specimen="heading"]')).toEqual(strings.map((s) => [s, '30px', '42px']))
  // A specimen, not a test fixture: no ring or fill marks its lines.
  const marks = await page
    .locator('#type [data-specimen]')
    .evaluateAll((els) => els.map((el) => [getComputedStyle(el).boxShadow, getComputedStyle(el).outlineStyle]))
  for (const mark of marks) expect(mark).toEqual(['none', 'none'])
})

test('the docs home no longer lists the /type fixture', async () => {
  const { page } = await pages.open(`${pages.ui}/`)
  await page.locator('main a').first().waitFor()
  expect(await page.locator('a[href="/type"]').count()).toBe(0)
})

for (const path of ['/', '/components/button', '/foundations', '/playground']) {
  test(`${path} has no horizontal scroll at 360 px, in English and in Bangla`, async () => {
    const { page } = await pages.open(`${pages.ui}${path}`)
    await page.waitForLoadState('networkidle')
    const switcher = page.locator('eb-button', { hasText: 'বাংলা' })
    for (const _lang of (await switcher.count()) ? ['en', 'bn'] : ['en']) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
      if (await switcher.count()) await switcher.click()
    }
  })
}

const ink = {
  light: {
    bg: 'oklch(0.985 0.002 85)',
    text: 'oklch(0.21 0.006 85)',
    bar: 'oklch(0.972 0.003 85)',
    focus: 'oklch(0.52 0.19 268)',
  },
  dark: {
    bg: 'oklch(0.16 0.004 85)',
    text: 'oklch(0.955 0.003 85)',
    bar: 'oklch(0.245 0.004 85)',
    focus: 'oklch(0.74 0.13 268)',
  },
}

async function openDocs(colorScheme: 'light' | 'dark', path = '/') {
  const { page, errors } = await pages.open('')
  await page.emulateMedia({ colorScheme })
  await page.goto(`${pages.ui}${path}`)
  return { page, errors }
}

const paint = (page: Awaited<ReturnType<typeof openDocs>>['page']) =>
  page.evaluate(() => {
    const body = getComputedStyle(document.body)
    return {
      bg: body.backgroundColor,
      text: body.color,
      bar: getComputedStyle(document.querySelector('.bar')!).backgroundColor,
    }
  })

for (const scheme of ['light', 'dark'] as const) {
  test(`the docs home wears Ink ${scheme} in a ${scheme} browser, bar included`, async () => {
    const { page, errors } = await openDocs(scheme)
    expect(await paint(page)).toEqual({ bg: ink[scheme].bg, text: ink[scheme].text, bar: ink[scheme].bar })
    expect(errors).toEqual([])
  })
}

test('the theme switch forces Dark, keeps it over a reload, and System hands the choice back', async () => {
  const { page, errors } = await openDocs('light')
  const root = page.locator('html')
  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  expect(await root.getAttribute('data-theme')).toBe('dark')
  expect((await paint(page)).bg).toBe(ink.dark.bg)
  expect(await page.getByRole('button', { name: 'Dark', exact: true }).getAttribute('aria-pressed')).toBe('true')

  await page.reload()
  expect(await root.getAttribute('data-theme')).toBe('dark')
  expect((await paint(page)).bg).toBe(ink.dark.bg)

  await page.getByRole('button', { name: 'System', exact: true }).click()
  expect(await root.getAttribute('data-theme')).toBeNull()
  expect((await paint(page)).bg).toBe(ink.light.bg)
  await page.reload()
  expect(await root.getAttribute('data-theme')).toBeNull()
  expect(errors).toEqual([])
})

test('the Button page has the switch beside the language switch', async () => {
  const { page } = await openDocs('light', '/components/button')
  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  expect(await page.locator('html').getAttribute('data-theme')).toBe('dark')
})

for (const scheme of ['light', 'dark'] as const) {
  test(`the switch buttons take Tab and show the 2 px focus ring in ${scheme}`, async () => {
    const { page } = await openDocs(scheme)
    const seen: string[] = []
    for (let i = 0; i < 12 && seen.length < 3; i++) {
      await page.keyboard.press('Tab')
      const state = await page.evaluate(() => {
        // The switch is a segmented group of eb-buttons, so the focus sits on a button in one's shadow root.
        const host = document.activeElement as HTMLElement
        const el = (host.shadowRoot?.activeElement ?? host) as HTMLElement
        const style = getComputedStyle(el)
        return {
          name: host.closest('.theme-switch') ? (host.textContent ?? '').trim() : '',
          ring: `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor} ${style.outlineOffset}`,
        }
      })
      if (!state.name) continue
      seen.push(state.name)
      expect(state.ring).toBe(`2px solid ${ink[scheme].focus} 2px`)
    }
    expect(seen).toEqual(['System', 'Light', 'Dark'])
  })
}

test('docs.css holds no hex colour', () => {
  const css = readFileSync(fileURLToPath(new URL('../../site/ui/docs.css', import.meta.url)), 'utf8')
  expect(css.match(/#[0-9a-f]{3,8}\b/gi)).toBeNull()
})

test('the docs home links to Foundations and to every component page, and each link opens', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/`)
  const links = [
    'Foundations',
    'Button',
    'Card',
    'Page',
    'Heading',
    'Text',
    'Badge',
    'Link',
    'Text field',
    'Text area',
    'Select',
    'Search field',
    'Date field',
    'Phone field',
    'Taka field',
    'District picker',
    'Checkbox',
    'Choice list',
    'Switch',
    'Banner',
  ]
  const hrefs = []
  for (const name of links) {
    hrefs.push(await page.locator('main').getByRole('link', { name, exact: true }).getAttribute('href'))
  }
  for (const href of hrefs) {
    const response = await page.goto(`${pages.ui}${href}`)
    expect(response?.status(), href!).toBe(200)
    expect(await page.locator('main > h1').count(), href!).toBe(1)
  }
  expect(errors).toEqual([])
})

test('every link on the docs home is a 44 px target on a phone', async () => {
  const { page } = await pages.open(`${pages.ui}/`, 360)
  await page.waitForFunction(() => document.querySelectorAll(':not(:defined):not(eb-column)').length === 0)
  const short = await page.evaluate(() =>
    [...document.querySelectorAll('main a')]
      .map((a) => ({ text: a.textContent, height: a.getBoundingClientRect().height }))
      .filter((link) => link.height < 44),
  )
  expect(short).toEqual([])
})

test('an English heading inside the Bangla specimen draws in Geist first', async () => {
  const { page } = await pages.open(`${pages.ui}/foundations`)
  const family = await page
    .locator('#type [lang="bn"] h3[lang="en"]')
    .first()
    .evaluate((el) => getComputedStyle(el).fontFamily)
  expect(family).toMatch(/^Geist,/)
})
