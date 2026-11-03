// The docs page of each form component shows it default, focused, in error, disabled and filled, in
// English and Bangla, and every target on it is a phone's 44 px.
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const forms = [
  'text-field',
  'text-area',
  'select',
  'search-field',
  'date-field',
  'phone-field',
  'taka-field',
  'district-picker',
  'checkbox',
  'choice-list',
  'switch',
]

const slow = 60_000

async function open(name: string, width = 360) {
  const opened = await pages.open('', width)
  await opened.page.emulateMedia({ colorScheme: 'light' })
  await opened.page.goto(`${pages.ui}/components/${name}`)
  await opened.page.waitForFunction(() => document.querySelectorAll(':not(:defined):not(eb-column)').length === 0)
  await opened.page.evaluate(() => document.fonts.ready)
  return opened
}

type Example = HTMLElement & {
  label: string
  error: string
  disabled: boolean
  value?: string
  district?: string
  checked?: boolean
}

for (const name of forms) {
  test(
    `the ${name} page shows it default, focused, in error, disabled and filled`,
    async () => {
      const { page, errors } = await open(name)
      const found = await page.evaluate(() => {
        const at = (state: string) => document.querySelector<Example>(`#examples [data-state="${state}"]`)
        let inner = document.activeElement
        while (inner?.shadowRoot?.activeElement) inner = inner.shadowRoot.activeElement
        const ring = inner ? getComputedStyle(inner) : null
        const filled = at('filled')
        return {
          states: [...document.querySelectorAll<HTMLElement>('#examples [data-state]')].map((el) => el.dataset.state),
          focused: document.activeElement === at('focus'),
          ring: ring && `${ring.outlineWidth} ${ring.outlineStyle} ${ring.outlineColor} ${ring.outlineOffset}`,
          error: at('error')?.error ?? '',
          invalid: at('error')?.shadowRoot?.querySelector('[aria-invalid="true"]') !== null,
          disabled: at('disabled')?.disabled,
          filled: filled && ('checked' in filled ? filled.checked : Boolean(filled.value || filled.district)),
        }
      })
      expect(found.states).toEqual(['default', 'focus', 'error', 'disabled', 'filled'])
      expect(found.focused).toBe(true)
      expect(found.ring).toBe('2px solid oklch(0.52 0.19 268) 2px')
      expect(found.error).not.toBe('')
      expect(found.invalid).toBe(true)
      expect(found.disabled).toBe(true)
      expect(found.filled).toBe(true)
      expect(errors).toEqual([])
    },
    slow,
  )

  test(
    `the ${name} page switches its labels and error to Bangla and back`,
    async () => {
      const { page, errors } = await open(name)
      const words = () =>
        page.evaluate(() =>
          [...document.querySelectorAll<Example>('#examples [data-label-en]')].map((el) => ({
            label: el.label,
            en: el.dataset.labelEn,
            bn: el.dataset.labelBn,
            error: el.error,
            errorEn: el.dataset.errorEn ?? '',
            errorBn: el.dataset.errorBn ?? '',
          })),
        )
      await page.locator('#language eb-button', { hasText: 'বাংলা' }).click()
      const bangla = await words()
      expect(bangla.length).toBeGreaterThanOrEqual(5)
      expect(bangla.filter((w) => w.label !== w.bn || w.error !== w.errorBn)).toEqual([])
      expect(bangla.every((w) => /[ঀ-৿]/.test(w.label))).toBe(true)
      expect(bangla.some((w) => /[ঀ-৿]/.test(w.error))).toBe(true)
      // Every option a select draws reads in Bangla too.
      const options = await page.evaluate(() =>
        [...document.querySelectorAll('#examples [data-state]')].flatMap((el) =>
          [...(el.shadowRoot?.querySelectorAll('select option') ?? [])].map((option) => option.textContent ?? ''),
        ),
      )
      expect(options.filter((text) => !/[ঀ-৿]/.test(text))).toEqual([])
      await page.locator('#language eb-button', { hasText: 'English' }).click()
      expect((await words()).filter((w) => w.label !== w.en || w.error !== w.errorEn)).toEqual([])
      expect(errors).toEqual([])
    },
    slow,
  )

  test(
    `on the ${name} page at 360 px every example's target is 44 px or more`,
    async () => {
      const { page } = await open(name)
      const short = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('#examples [data-state]')].flatMap((el) =>
          [...el.shadowRoot!.querySelectorAll('.control, .row')]
            .map((control) => control.getBoundingClientRect().height)
            .filter((height) => height < 44)
            .map((height) => `${el.dataset.state}: ${height}`),
        ),
      )
      expect(short).toEqual([])
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
    },
    slow,
  )
}
