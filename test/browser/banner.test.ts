import { expect, test } from 'vitest'
import { userEvent } from 'vitest/browser'

import '../../src/v1.ts'
import { contrast, inDark } from './colour.ts'

async function banner(html: string): Promise<HTMLElement> {
  document.body.innerHTML = html
  const el = document.querySelector<HTMLElement & { updateComplete: Promise<unknown> }>('eb-banner')!
  await el.updateComplete
  return el
}

function icon(el: HTMLElement): Element {
  return el.shadowRoot!.querySelector('[role="img"]')!
}

// What a banner paints, copied out of the live computed style.
function painted(el: HTMLElement) {
  const style = getComputedStyle(el)
  return { background: style.backgroundColor, shadow: style.boxShadow, colour: style.color }
}

const tokens = {
  light: {
    danger: { background: 'oklch(0.965 0.025 25)', edge: 'oklch(0.82 0.08 25)', colour: 'oklch(0.21 0.006 85)' },
    info: { background: 'oklch(0.96 0.022 268)', colour: 'oklch(0.47 0.008 85)' },
    neutral: { background: 'oklch(0.972 0.003 85)', edge: 'oklch(0.925 0.004 85)' },
  },
  dark: {
    danger: { background: 'oklch(0.29 0.07 25)', edge: 'oklch(0.45 0.12 25)', colour: 'oklch(0.955 0.003 85)' },
    info: { background: 'oklch(0.3 0.06 268)', colour: 'oklch(0.75 0.006 85)' },
    neutral: { background: 'oklch(0.245 0.004 85)', edge: 'oklch(0.285 0.005 85)' },
  },
}

async function check(theme: 'light' | 'dark') {
  const expected = tokens[theme]
  const danger = await banner('<eb-banner tone="danger">Pay by Friday</eb-banner>')
  const dangerPaint = painted(danger)
  const dangerPath = icon(danger).querySelector('path')!.getAttribute('d')!
  const info = await banner('<eb-banner tone="info">Pay by Friday</eb-banner>')
  const infoPaint = painted(info)
  const infoCircle = icon(info).querySelector('circle')!.getAttribute('r')
  const neutralPaint = painted(await banner('<eb-banner tone="neutral">Pay by Friday</eb-banner>'))
  return { expected, dangerPaint, dangerPath, infoPaint, infoCircle, neutralPaint }
}

test('a danger banner is the danger soft background, its edge and a triangle, in light', async () => {
  const { expected, dangerPaint, dangerPath } = await check('light')
  expect(dangerPaint.background).toBe(expected.danger.background)
  expect(dangerPaint.shadow).toContain(`${expected.danger.edge} 0px 0px 0px 1px inset`)
  expect(dangerPath.startsWith('m21.73 18')).toBe(true)
  expect(contrast(dangerPaint.colour, dangerPaint.background)).toBeGreaterThanOrEqual(4.5)
})

test('a danger banner turns to the dark tokens in dark', async () => {
  const { expected, dangerPaint, dangerPath } = await inDark(() => check('dark'))
  expect(dangerPaint.background).toBe(expected.danger.background)
  expect(dangerPaint.shadow).toContain(`${expected.danger.edge} 0px 0px 0px 1px inset`)
  expect(dangerPath.startsWith('m21.73 18')).toBe(true)
  expect(contrast(dangerPaint.colour, dangerPaint.background)).toBeGreaterThanOrEqual(4.5)
})

test('an info banner is accent-soft with no ring and an info circle, in light', async () => {
  const { expected, infoPaint, infoCircle, neutralPaint } = await check('light')
  expect(infoPaint.background).toBe(expected.info.background)
  expect(infoPaint.shadow).toBe('none')
  expect(infoPaint.colour).toBe(expected.info.colour)
  expect(infoCircle).toBe('10')
  expect(contrast(infoPaint.colour, infoPaint.background)).toBeGreaterThanOrEqual(4.5)
  expect(neutralPaint.background).toBe(expected.neutral.background)
  expect(neutralPaint.shadow).toContain(`${expected.neutral.edge} 0px 0px 0px 1px inset`)
})

test('an info banner turns to the dark tokens in dark', async () => {
  const { expected, infoPaint, infoCircle, neutralPaint } = await inDark(() => check('dark'))
  expect(infoPaint.background).toBe(expected.info.background)
  expect(infoPaint.shadow).toBe('none')
  expect(infoPaint.colour).toBe(expected.info.colour)
  expect(infoCircle).toBe('10')
  expect(contrast(infoPaint.colour, infoPaint.background)).toBeGreaterThanOrEqual(4.5)
  expect(neutralPaint.background).toBe(expected.neutral.background)
  expect(neutralPaint.shadow).toContain(`${expected.neutral.edge} 0px 0px 0px 1px inset`)
})

test('a banner with no tone is info', async () => {
  const el = await banner('<eb-banner>Note</eb-banner>')
  expect(painted(el).background).toBe(tokens.light.info.background)
  expect(icon(el).querySelector('circle')!.getAttribute('r')).toBe('10')
})

test('the icon is named in the language around the banner', async () => {
  const en = await banner('<eb-banner tone="danger">Pay</eb-banner>')
  expect(icon(en).getAttribute('aria-label')).toBe('Warning')
  const bn = await banner('<div lang="bn"><eb-banner tone="danger">Pay</eb-banner></div>')
  expect(icon(bn).getAttribute('aria-label')).toBe('সতর্কতা')
  const note = await banner('<eb-banner>Pay</eb-banner>')
  expect(icon(note).getAttribute('aria-label')).toBe('Note')
  const tothya = await banner('<div lang="bn"><eb-banner>Pay</eb-banner></div>')
  expect(icon(tothya).getAttribute('aria-label')).toBe('তথ্য')
})

test('the slotted message is laid out beside the icon', async () => {
  const el = await banner('<eb-banner tone="danger">Pay by Friday</eb-banner>')
  const slot = el.shadowRoot!.querySelector('slot')!
  expect(slot.assignedNodes().length).toBe(1)
  const range = document.createRange()
  range.selectNodeContents(el)
  expect(range.getBoundingClientRect().width).toBeGreaterThan(24)
})

// The shared tone list: neutral keeps the grey card and reads as info does otherwise; success is the grey card with a green check; warning is the
// amber soft fill of New with a triangle, in its own words.
async function look(html: string) {
  const el = await banner(html)
  const svg = icon(el).querySelector('svg')!
  return {
    ...painted(el),
    icon: getComputedStyle(icon(el)).color,
    drawing: svg.innerHTML.replaceAll(/<!--.*?-->/g, ''),
    label: icon(el).getAttribute('aria-label'),
  }
}

for (const theme of ['light', 'dark'] as const) {
  test(`in ${theme}, the tones draw their own banner`, async () => {
    const run = async () => {
      const root = getComputedStyle(document.documentElement)
      const token = (name: string) => root.getPropertyValue(name).trim()
      return {
        neutral: await look('<eb-banner tone="neutral">Pay</eb-banner>'),
        info: await look('<eb-banner tone="info">Pay</eb-banner>'),
        success: await look('<eb-banner tone="success">Paid</eb-banner>'),
        warning: await look('<eb-banner tone="warning">Pay</eb-banner>'),
        danger: await look('<eb-banner tone="danger">Pay</eb-banner>'),
        paid: token('--eb-color-paid'),
        newBg: token('--eb-color-new-bg'),
        newFg: token('--eb-color-new-fg'),
        text: token('--eb-color-text'),
      }
    }
    const found = theme === 'dark' ? await inDark(run) : await run()
    expect(found.neutral).toEqual({ ...found.info, background: found.neutral.background, shadow: found.neutral.shadow })
    expect(found.neutral.background).not.toBe(found.info.background)
    expect([found.success.background, found.success.shadow]).toEqual([found.neutral.background, found.neutral.shadow])
    expect(found.success.icon).toBe(found.paid)
    expect(found.success.drawing).toContain('m16 9-5.5 5.5L8 12')
    expect(found.success.label).toBe('Done')
    expect(found.warning.background).toBe(found.newBg)
    expect(found.warning.colour).toBe(found.text)
    expect(found.warning.icon).toBe(found.newFg)
    expect(found.warning.drawing).toBe(found.danger.drawing)
    expect(found.warning.label).toBe('Attention')
    expect(contrast(found.warning.colour, found.warning.background)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(found.warning.icon, found.warning.background)).toBeGreaterThanOrEqual(3)
  })
}

test('the success and warning icons are named in Bangla too', async () => {
  const success = await banner('<div lang="bn"><eb-banner tone="success">Pay</eb-banner></div>')
  expect(icon(success).getAttribute('aria-label')).toBe('সম্পন্ন')
  const warning = await banner('<div lang="bn"><eb-banner tone="warning">Pay</eb-banner></div>')
  expect(icon(warning).getAttribute('aria-label')).toBe('লক্ষ্য করুন')
})

test('a banner with no tone keeps the 1.0.0 default, info', async () => {
  const el = await banner('<eb-banner>Note</eb-banner>')
  expect(el.getAttribute('tone')).toBe('info')
})

function part(el: HTMLElement, selector: string): HTMLElement {
  return el.shadowRoot!.querySelector<HTMLElement>(selector)!
}

for (const theme of ['light', 'dark'] as const) {
  test(`in ${theme}, a heading is weight 600 in the text colour above the words`, async () => {
    const run = async () => {
      const el = await banner('<eb-banner heading="Payment failed">Try another card</eb-banner>')
      const heading = part(el, '.heading')
      const style = getComputedStyle(heading)
      const words = document.createRange()
      words.selectNodeContents(el.firstChild as Text)
      return {
        words: heading.textContent,
        weight: style.fontWeight,
        colour: style.color,
        text: getComputedStyle(document.documentElement).getPropertyValue('--eb-color-text').trim(),
        above: heading.getBoundingClientRect().bottom <= words.getBoundingClientRect().top + 1,
      }
    }
    const found = theme === 'dark' ? await inDark(run) : await run()
    expect(found.words).toBe('Payment failed')
    expect(found.weight).toBe('600')
    expect(found.colour).toBe(found.text)
    expect(found.above).toBe(true)
  })
}

test('a heading in Bangla is drawn as given', async () => {
  const el = await banner('<eb-banner heading="পেমেন্ট ব্যর্থ">চেষ্টা করুন</eb-banner>')
  expect(part(el, '.heading').textContent).toBe('পেমেন্ট ব্যর্থ')
})

test('an action child is laid out after the words', async () => {
  const el = await banner('<eb-banner>Pay by Friday<eb-button slot="action">Pay now</eb-button></eb-banner>')
  const words = document.createRange()
  words.selectNodeContents(el.firstChild as Text)
  const action = el.querySelector('eb-button')!
  expect(action.getBoundingClientRect().left).toBeGreaterThanOrEqual(words.getBoundingClientRect().right)
})

test('a banner without a heading, action or dismiss draws none of them', async () => {
  const el = await banner('<eb-banner>Note</eb-banner>')
  expect(el.shadowRoot!.querySelector('.heading')).toBeNull()
  expect(el.shadowRoot!.querySelector('eb-button')).toBeNull()
})

type Ready = HTMLElement & { updateComplete: Promise<unknown> }

function closer(el: HTMLElement): Ready {
  return part(el, 'eb-button') as Ready
}

async function accessibleName(button: Ready): Promise<string | null> {
  await button.updateComplete
  return button.shadowRoot!.querySelector('button')!.getAttribute('aria-label')
}

test('a dismissible banner has a close button named Dismiss, or বন্ধ করুন in Bangla', async () => {
  const en = await banner('<eb-banner dismissible>Note</eb-banner>')
  expect(await accessibleName(closer(en))).toBe('Dismiss')
  const bn = await banner('<div lang="bn"><eb-banner dismissible>Note</eb-banner></div>')
  expect(await accessibleName(closer(bn))).toBe('বন্ধ করুন')
})

test('clicking the close button hides the banner and fires one eb-dismiss that bubbles and is composed', async () => {
  const el = await banner('<eb-banner dismissible>Note</eb-banner>')
  const heard: Event[] = []
  document.body.addEventListener('eb-dismiss', (event) => heard.push(event), { once: true })
  await userEvent.click(closer(el))
  expect(el.hasAttribute('hidden')).toBe(true)
  expect(el.getBoundingClientRect().height).toBe(0)
  expect(heard.length).toBe(1)
  expect(heard[0]!.bubbles).toBe(true)
  expect(heard[0]!.composed).toBe(true)
  expect(heard[0]!.cancelable).toBe(true)
})

test('a listener that calls preventDefault keeps the banner', async () => {
  const el = await banner('<eb-banner dismissible>Note</eb-banner>')
  el.addEventListener('eb-dismiss', (event) => event.preventDefault())
  await userEvent.click(closer(el))
  expect(el.hasAttribute('hidden')).toBe(false)
})

test('pressing Enter on the close button dismisses and moves focus to the next focusable element', async () => {
  const el = await banner('<eb-banner dismissible>Note</eb-banner><button id="next">Next</button>')
  let count = 0
  el.addEventListener('eb-dismiss', () => count++)
  await closer(el).updateComplete
  await userEvent.tab()
  await userEvent.keyboard('{Enter}')
  expect(count).toBe(1)
  expect(el.hasAttribute('hidden')).toBe(true)
  expect(document.activeElement?.id).toBe('next')
})

test('with nothing after the banner, focus goes to the previous focusable element', async () => {
  const el = await banner('<button id="prev">Prev</button><eb-banner dismissible>Note</eb-banner>')
  await closer(el).updateComplete
  await userEvent.tab()
  await userEvent.tab()
  await userEvent.keyboard('{Enter}')
  expect(el.hasAttribute('hidden')).toBe(true)
  expect(document.activeElement?.id).toBe('prev')
})

test.for([
  ['an eb-text-field', '<eb-text-field label="Phone"></eb-text-field>', 'input'],
  ['an eb-link', '<eb-link href="#orders">Orders</eb-link>', 'a'],
  ['an eb-select', '<eb-select label="Courier"><option>Pathao</option></eb-select>', 'select'],
] as const)(
  'a keyboard dismiss hands the focus to %s after the banner, inside its shadow root',
  async ([, next, inner]) => {
    document.body.innerHTML = `<eb-banner dismissible>Saved</eb-banner>${next}<button id="last">Last</button>`
    const el = document.querySelector('eb-banner')!
    await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete
    const neighbour = el.nextElementSibling as HTMLElement & { updateComplete: Promise<unknown> }
    await neighbour.updateComplete
    const close = el.shadowRoot!.querySelector('eb-button')!
    await close.updateComplete
    close.shadowRoot!.querySelector('button')!.focus()
    await userEvent.keyboard('{Enter}')
    expect(document.activeElement).toBe(neighbour)
    expect(neighbour.shadowRoot!.activeElement?.localName).toBe(inner)
  },
)

test('a dismiss still moves the focus on when a listener takes the banner out of the page', async () => {
  document.body.innerHTML = '<eb-banner dismissible>Saved</eb-banner><button id="next">Next</button>'
  const el = document.querySelector('eb-banner')!
  await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete
  el.addEventListener('eb-dismiss', () => el.remove())
  const close = el.shadowRoot!.querySelector('eb-button')!
  await close.updateComplete
  close.shadowRoot!.querySelector('button')!.focus()
  await userEvent.keyboard('{Enter}')
  expect(document.activeElement?.id).toBe('next')
})
