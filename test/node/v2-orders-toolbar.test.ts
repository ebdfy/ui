// The playground's orders list at 1440 px, as the revised Orders board draws it: the toolbar's search
// field and Add filter are 32 px, the payment chip Add filter applies is a 32 px box at the toolbar's
// radius, and the pager sits in a surface-2 footer.
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

test('at 1440 px the toolbar controls and the applied COD chip are 32 px, and the pager is a surface-2 footer', async () => {
  const { page, errors } = await pages.open('', 1440)
  await page.context().addInitScript(() => localStorage.setItem('ebdfy-playground-lang', 'en'))
  await page.goto(`${pages.ui}/playground`)
  const app = page.frameLocator('e-admin-panel iframe')
  await app.getByRole('button', { name: 'Add filter' }).click()
  const chip = app.locator('[slot="filter"][name="payment"]')
  await chip.waitFor()
  const read = (locator: ReturnType<typeof app.locator>) =>
    locator.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        height: Math.round(element.getBoundingClientRect().height),
        radius: style.borderTopLeftRadius,
        background: style.backgroundColor,
      }
    })
  expect((await read(app.locator('e-index-table > e-search-field'))).height).toBe(32)
  expect((await read(app.locator('e-index-table > e-button').first())).height).toBe(32)
  expect(await chip.textContent()).toContain('Cash on delivery')
  expect(await read(chip)).toMatchObject({ height: 32, radius: '8px' })
  const surface2 = await app.locator('body').evaluate(() => {
    const probe = document.createElement('i')
    probe.style.backgroundColor = 'var(--e-color-surface-2)'
    document.body.append(probe)
    const colour = getComputedStyle(probe).backgroundColor
    probe.remove()
    return colour
  })
  expect((await read(app.locator('e-index-table > e-pagination'))).background).toBe(surface2)
  expect(errors).toEqual([])
})
