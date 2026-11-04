import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

test.for(['light', 'dark'] as const)('the motion tokens are on the root in the %s theme', async (scheme) => {
  const { page, errors } = await pages.open('')
  await page.emulateMedia({ colorScheme: scheme })
  await page.goto(`${pages.ui}/`)
  await page.waitForFunction(() => customElements.get('eb-card') !== undefined)
  const tokens = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement)
    return {
      bg: style.getPropertyValue('--eb-color-bg').trim(),
      fast: style.getPropertyValue('--eb-duration-fast').trim(),
      base: style.getPropertyValue('--eb-duration-base').trim(),
      ease: style.getPropertyValue('--eb-ease-out').trim(),
    }
  })
  expect(tokens).toEqual({
    bg: scheme === 'light' ? 'oklch(0.985 0.002 85)' : 'oklch(0.16 0.004 85)',
    fast: '120ms',
    base: '200ms',
    ease: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  })
  expect(errors).toEqual([])
})

// With reduced motion nothing transitions: the duration is the browser's 0s and nothing starts.
const still = { duration: '0s', property: 'all' }

const overlayCases = (['menu', 'popover', 'tooltip'] as const).flatMap((name) => [
  {
    name,
    motion: 'no-preference' as const,
    expected: {
      duration: '0.12s',
      property: 'opacity, transform',
      from: { opacity: '0', transform: 'translateY(4px)' },
    },
  },
  { name, motion: 'reduce' as const, expected: { ...still, from: {} } },
])

// Opens the overlay on its docs page and reads, the moment it opens, where each transition starts.
test.for(overlayCases)('an opened $name with motion $motion', async ({ name, motion, expected }) => {
  const { page, errors } = await pages.open('', 1280)
  await page.emulateMedia({ reducedMotion: motion })
  await page.goto(`${pages.ui}/components/${name}`)
  const opened = await page
    .locator(`main eb-${name}:defined`)
    .first()
    .evaluate(async (host) => {
      const shown = host as HTMLElement & { show?: () => void; updateComplete?: Promise<unknown> }
      if (shown.show) {
        shown.show()
        await shown.updateComplete
      } else {
        host.dispatchEvent(new MouseEvent('mouseenter'))
      }
      const panel = host.shadowRoot!.querySelector<HTMLElement>('[popover]')!
      const style = getComputedStyle(panel)
      const from: Record<string, string> = {}
      for (const animation of panel.getAnimations()) {
        if (!(animation instanceof CSSTransition)) continue
        const first = (animation.effect as KeyframeEffect).getKeyframes()[0]!
        from[animation.transitionProperty] = String(first[animation.transitionProperty])
      }
      return {
        open: panel.matches(':popover-open'),
        transition: { duration: style.transitionDuration, property: style.transitionProperty, from },
      }
    })
  expect(opened.open).toBe(true)
  expect(opened.transition).toEqual(expected)
  expect(errors).toEqual([])
})

type Page = Awaited<ReturnType<typeof pages.open>>['page']

// Opens the sample order on a phone, noting each transition that starts in the chrome's shadow root.
async function openOrder(motion: 'no-preference' | 'reduce') {
  const opened = await pages.open('', 360)
  const { page } = opened
  await page.emulateMedia({ reducedMotion: motion })
  await page.goto(`${pages.ui}/playground`)
  await page.locator('eb-admin-chrome [part="app-nav"] a', { hasText: 'Order #1001' }).click({ timeout: 15_000 })
  const book = page.locator('eb-admin-chrome [part="title-action"]', { hasText: 'Book courier' })
  await book.waitFor({ timeout: 15_000 })
  await page.locator('eb-admin-chrome:defined').evaluate((chrome) => {
    const runs: { part: string; property: string; from: string }[] = []
    ;(window as unknown as { runs: typeof runs }).runs = runs
    chrome.shadowRoot!.addEventListener('transitionrun', (event) => {
      const { target, propertyName } = event as TransitionEvent
      const transition = (target as Element)
        .getAnimations()
        .find((one) => one instanceof CSSTransition && one.transitionProperty === propertyName)
      const first = (transition?.effect as KeyframeEffect | undefined)?.getKeyframes()[0]
      const part = (target as Element).getAttribute('part') ?? ''
      // Keyframes name a property in camel case: margin-bottom is marginBottom.
      const key = propertyName.replaceAll(/-(\w)/g, (_, letter: string) => letter.toUpperCase())
      runs.push({ part, property: propertyName, from: String(first?.[key]) })
    })
  })
  return { ...opened, book }
}

const runs = (page: Page, part: string) =>
  page.evaluate(
    (wanted) => (window as unknown as { runs: { part: string }[] }).runs.filter((run) => run.part === wanted),
    part,
  )

const transition = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => {
    const { transitionDuration, transitionProperty } = getComputedStyle(el)
    return { duration: transitionDuration, property: transitionProperty }
  })

const modal = 'eb-admin-chrome dialog[part="modal"]'

test.for([
  {
    motion: 'no-preference' as const,
    expected: { duration: '0.2s', property: 'margin-bottom' },
    // The sheet starts as far down as it can stand tall, 85% of the window, below the screen.
    started: [{ part: 'modal', property: 'margin-bottom', from: '-680px' }],
  },
  { motion: 'reduce' as const, expected: still, started: [] },
])('the phone sheet opens with motion $motion', async ({ motion, expected, started }) => {
  const { page, book, errors } = await openOrder(motion)
  await book.click()
  await page.locator(modal).waitFor()
  expect(await transition(page, modal)).toEqual(expected)
  await expect.poll(() => runs(page, 'modal')).toEqual(started)
  expect(errors).toEqual([])
})

const toast = 'eb-admin-chrome [part="toast"]'

test.for([
  {
    motion: 'no-preference' as const,
    expected: { duration: '0.2s', property: 'opacity' },
    started: [{ part: 'toast', property: 'opacity', from: '0' }],
  },
  { motion: 'reduce' as const, expected: still, started: [] },
])('the toast fades in with motion $motion', async ({ motion, expected, started }) => {
  const { page, errors } = await openOrder(motion)
  await page.locator('eb-admin-chrome [part="title-action"]', { hasText: 'More' }).click()
  await page.getByRole('menuitem', { name: 'Duplicate' }).click()
  await expect.poll(() => page.locator(`${toast} span`).textContent()).toBe('Copied to a new draft')
  expect(await transition(page, toast)).toEqual(expected)
  await expect.poll(() => runs(page, 'toast')).toEqual(started)
  expect(errors).toEqual([])
})

// A toast that shows while the sheet is still sliding up hangs from the top of the screen; it does
// not ride up inside the sheet and jump when the slide ends. The slide is held at 50 ms so the
// check does not hang on how fast the machine is.
test('a toast shown while the sheet slides up stays at the top of the screen', async () => {
  const { page, book, errors } = await openOrder('no-preference')
  await page.locator('eb-admin-chrome:defined').evaluate((chrome) => {
    const held = new Promise((resolve) => {
      chrome.shadowRoot!.addEventListener('transitionrun', async (event) => {
        const sheet = event.target as Element
        if (sheet.getAttribute('part') !== 'modal') return
        const slide = sheet.getAnimations().find((one) => one instanceof CSSTransition)!
        slide.pause()
        slide.currentTime = 50
        const host = chrome as unknown as {
          showToast: (payload: unknown, from: null) => void
          updateComplete: Promise<unknown>
        }
        host.showToast({ message: 'Early', error: false, call: 99 }, null)
        await host.updateComplete
        const toastTop = chrome.shadowRoot!.querySelector('[part="toast"]')!.getBoundingClientRect().top
        const sliding = sheet.getBoundingClientRect().top
        slide.finish()
        resolve({ toastTop, sliding, settled: sheet.getBoundingClientRect().top })
      })
    })
    ;(window as unknown as { held: typeof held }).held = held
  })
  await book.click()
  const seen = await page.evaluate(() => (window as unknown as { held: Promise<Record<string, number>> }).held)
  expect(seen.toastTop).toBe(8)
  expect(seen.sliding).toBeGreaterThan(seen.settled!)
  expect(errors).toEqual([])
})

// A toast fades in once. When the sheet closes under it, it moves from the sheet back to the foot of
// the screen and shows there at once, with no second fade.
test('a toast already showing when the sheet closes does not fade in again', async () => {
  const { page, book, errors } = await openOrder('no-preference')
  await book.click()
  await page.locator(modal).waitFor()
  await page.locator('eb-admin-chrome:defined').evaluate(async (chrome) => {
    const host = chrome as unknown as {
      showToast: (payload: unknown, from: null) => void
      updateComplete: Promise<unknown>
    }
    host.showToast({ message: 'Booked', error: false, call: 99 }, null)
    await host.updateComplete
    const shown = chrome.shadowRoot!.querySelector('[part="toast"]')!
    await Promise.all(shown.getAnimations().map((one) => one.finished))
  })
  await page.evaluate(() => ((window as unknown as { runs: unknown[] }).runs.length = 0))
  await page.keyboard.press('Escape')
  await page.locator(modal).waitFor({ state: 'detached' })
  const after = await page.locator('eb-admin-chrome:defined').evaluate(async (chrome) => {
    await new Promise(requestAnimationFrame)
    const toast = chrome.shadowRoot!.querySelector('[part="toast"]')!
    return { opacity: getComputedStyle(toast).opacity, text: toast.textContent!.trim() }
  })
  expect(after).toEqual({ opacity: '1', text: 'Booked' })
  expect(await runs(page, 'toast')).toEqual([])
  expect(errors).toEqual([])
})

// The switch's track and knob move over the fast duration, and stand still with reduced motion.
test.for([
  { motion: 'no-preference' as const, track: '0.12s', knob: '0.12s' },
  { motion: 'reduce' as const, track: '0s', knob: '0s' },
])('a switch moves with motion $motion', async ({ motion, track, knob }) => {
  const { page, errors } = await pages.open('', 1280)
  await page.emulateMedia({ reducedMotion: motion })
  await page.goto(`${pages.ui}/components/switch`)
  const found = await page
    .locator('main eb-switch:defined')
    .first()
    .evaluate((host) => {
      const input = host.shadowRoot!.querySelector('input')!
      return {
        track: getComputedStyle(input).transitionDuration,
        knob: getComputedStyle(input, '::before').transitionDuration,
      }
    })
  expect(found).toEqual({ track, knob })
  expect(errors).toEqual([])
})
